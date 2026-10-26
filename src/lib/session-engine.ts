/**
 * Pure session arithmetic. No database, no clock of its own — every function
 * takes `now` so the server can pass its own clock and the client can pass a
 * server-corrected one. Client clocks never decide anything (SPEC-V1.md §2).
 */

import {
  HEARTBEAT_GRACE_MS,
  MAX_PAUSED_MS,
  MAX_PAUSES,
  type AbandonReason,
} from "./constants";

export type EngineSession = {
  plannedMinutes: number;
  ruleset: "desktop" | "mobile";
  status: "active" | "paused" | "awaiting_report" | "completed" | "abandoned";
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  pauseCount: number;
  lastHeartbeatAt: number;
};

export type Verdict =
  | {
      kind: "running";
      elapsedMs: number;
      remainingMs: number;
      completeAt: number;
      /** The page is quiet right now, past the grace. Desktop only. */
      quiet: boolean;
      /**
       * Set when the session is running because its pause budget ran out rather
       * than because anybody pressed Resume. The stored row still says
       * "paused", so `reconcile` writes the resume back at this moment; every
       * other reader can ignore it and simply see a running session.
       */
      resumedAt?: number;
    }
  | { kind: "paused"; elapsedMs: number; remainingMs: number; pauseExhaustAt: number }
  | {
      kind: "complete";
      at: number;
      /**
       * True when the page was quiet for longer than the grace before the time
       * ran out. A gap that opened and closed again earlier is recorded on the
       * row instead (`unfocused_at`), because the heartbeat that closes it
       * also overwrites the evidence.
       */
      lackedFocus: boolean;
    }
  | { kind: "settled" };

export function requiredMs(plannedMinutes: number): number {
  return plannedMinutes * 60_000;
}

/**
 * Paused milliseconds actually spent, which can never exceed the budget.
 *
 * The cap is what makes the budget a budget. A pause that runs past five
 * minutes does not keep banking paused time — the five minutes are spent and
 * the clock is running again, so everything after that counts as focus whether
 * or not anybody has pressed Resume.
 */
export function pausedMsUsed(s: EngineSession, now: number): number {
  const live = s.pausedAt !== null ? Math.max(0, now - s.pausedAt) : 0;
  return Math.min(MAX_PAUSED_MS, s.pausedMs + live);
}

/** Focused milliseconds banked so far, excluding paused time up to the budget. */
export function focusedMs(s: EngineSession, now: number): number {
  const gross = now - s.startedAt;
  return Math.max(0, Math.min(gross - pausedMsUsed(s, now), requiredMs(s.plannedMinutes)));
}

/**
 * Decides what a session has become as of `now`.
 *
 * Both failure modes are evaluated as *moments*, not as "has it happened yet",
 * so a tab that closes after the timer already ran out still completes: the
 * completion moment came first.
 */
export function evaluate(s: EngineSession, now: number): Verdict {
  if (s.status === "completed" || s.status === "abandoned" || s.status === "awaiting_report") {
    return { kind: "settled" };
  }

  const need = requiredMs(s.plannedMinutes);

  /**
   * Running out of pause time restarts the clock. It does not end the session.
   *
   * It used to abandon, at −30 XP and the loss of everything focused so far —
   * so stepping away for six minutes cost more than never having started, and
   * the punishment landed on somebody who had already told the app they were
   * taking a break. A budget that ends the session is not a budget, it is a
   * trap with a timer on it.
   *
   * Five minutes is still five minutes: `pausedMsUsed` caps what the pause can
   * bank, so the time past it counts as focus and the session finishes later
   * than it would have. That is the whole of the cost, and it is the shape the
   * rule was always described as having.
   */
  let resumedAt: number | undefined;
  if (s.status === "paused") {
    const pausedSince = s.pausedAt ?? now;
    const pauseExhaustAt = pausedSince + Math.max(0, MAX_PAUSED_MS - s.pausedMs);
    if (now < pauseExhaustAt) {
      const elapsed = focusedMs(s, now);
      return {
        kind: "paused",
        elapsedMs: elapsed,
        remainingMs: need - elapsed,
        pauseExhaustAt,
      };
    }
    resumedAt = pauseExhaustAt;
  }

  const completeAt = s.startedAt + need + pausedMsUsed(s, now);
  /*
   * The page going quiet no longer ends anything.
   *
   * It used to return an abandon at the moment of the gap, and the heartbeat
   * that brought the page back was the request that wrote it — so a session
   * forty minutes into a fifty, on a laptop that slept for three, came back to
   * find itself over and worth nothing. The gap is now a fact about the
   * session rather than its end: it finishes on time and pays half.
   *
   * The requirement is suspended while paused and absent on mobile (§3).
   */
  const quietAt =
    s.ruleset === "desktop" ? s.lastHeartbeatAt + HEARTBEAT_GRACE_MS : Infinity;

  if (now >= completeAt) {
    return { kind: "complete", at: completeAt, lackedFocus: quietAt < completeAt };
  }

  const elapsed = focusedMs(s, now);
  return {
    kind: "running",
    elapsedMs: elapsed,
    remainingMs: need - elapsed,
    completeAt,
    quiet: now >= quietAt,
    resumedAt,
  };
}

export type PauseCheck =
  | { ok: true }
  | { ok: false; reason: Extract<AbandonReason, "pause_count" | "pause_budget"> };

/** Whether a pause may be started. A third pause abandons the session (§3). */
export function canPause(s: EngineSession): PauseCheck {
  if (s.pauseCount >= MAX_PAUSES) return { ok: false, reason: "pause_count" };
  if (s.pausedMs >= MAX_PAUSED_MS) return { ok: false, reason: "pause_budget" };
  return { ok: true };
}

/** Paused milliseconds still available across the whole session. */
export function pauseBudgetLeftMs(s: EngineSession, now: number): number {
  const used = s.pausedMs + (s.pausedAt !== null ? now - s.pausedAt : 0);
  return Math.max(0, MAX_PAUSED_MS - used);
}
