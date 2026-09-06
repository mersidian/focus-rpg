/**
 * Pure session arithmetic. No database, no clock of its own — every function
 * takes `now` so the server can pass its own clock and the client can pass a
 * server-corrected one. Client clocks never decide anything (SPEC.md §2).
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
  | { kind: "running"; elapsedMs: number; remainingMs: number; completeAt: number }
  | { kind: "paused"; elapsedMs: number; remainingMs: number; pauseExhaustAt: number }
  | { kind: "complete"; at: number }
  | { kind: "abandon"; reason: AbandonReason; at: number }
  | { kind: "settled" };

export function requiredMs(plannedMinutes: number): number {
  return plannedMinutes * 60_000;
}

/** Focused milliseconds banked so far, excluding all paused time. */
export function focusedMs(s: EngineSession, now: number): number {
  const gross = now - s.startedAt;
  const paused = s.pausedMs + (s.pausedAt !== null ? now - s.pausedAt : 0);
  return Math.max(0, Math.min(gross - paused, requiredMs(s.plannedMinutes)));
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

  if (s.status === "paused") {
    const pausedSince = s.pausedAt ?? now;
    const pauseExhaustAt = pausedSince + (MAX_PAUSED_MS - s.pausedMs);
    if (now >= pauseExhaustAt) {
      return { kind: "abandon", reason: "pause_budget", at: pauseExhaustAt };
    }
    const elapsed = focusedMs(s, now);
    return {
      kind: "paused",
      elapsedMs: elapsed,
      remainingMs: need - elapsed,
      pauseExhaustAt,
    };
  }

  const completeAt = s.startedAt + need + s.pausedMs;
  // The heartbeat requirement is suspended while paused and absent on mobile (§3).
  const abandonAt =
    s.ruleset === "desktop" ? s.lastHeartbeatAt + HEARTBEAT_GRACE_MS : Infinity;

  if (abandonAt < completeAt && now >= abandonAt) {
    return { kind: "abandon", reason: "heartbeat_lost", at: abandonAt };
  }
  if (now >= completeAt) {
    return { kind: "complete", at: completeAt };
  }

  const elapsed = focusedMs(s, now);
  return {
    kind: "running",
    elapsedMs: elapsed,
    remainingMs: need - elapsed,
    completeAt,
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
