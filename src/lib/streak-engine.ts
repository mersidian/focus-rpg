/**
 * Streaks and freezes (SPEC.md §7), as pure arithmetic over game days.
 *
 * The walk is the only thing allowed to spend a freeze, and it spends them one
 * elapsed day at a time, so the result is the same whether the user opened the
 * app every morning or came back after three weeks away.
 */

import { weekdayOf } from "./game-day";

/** Two weeks' worth. Also caps consecutive frozen days at 14 (§7). */
export const FREEZE_CAP = 14;
/** One freeze per five consecutive days. */
export const FREEZE_STREAK_INTERVAL = 5;
/** 20% of all XP drips into the meter; 300 FP converts to a freeze. */
export const FREEZE_METER_XP_SHARE = 0.2;
export const FREEZE_METER_TARGET_FP = 300;
/** Held in hundredths so 20% of an odd XP figure stays exact. */
export const FREEZE_METER_TARGET = FREEZE_METER_TARGET_FP * 100;
/** Direct purchase from the streak panel. */
export const FREEZE_PURCHASE_XP = 400;
/** Two abandons in one day break the streak; one slip does not (§3). */
export const ABANDONS_THAT_BREAK = 2;
/** Rest days and vacation limits. */
export const MAX_REST_DAYS = 2;
export const MAX_VACATION_DAYS = 21;

export type DayState = "active" | "frozen" | "rest" | "vacation" | "gap";

export type DayActivity = { completed: number; abandoned: number };

export type StreakState = {
  /** Days with a completed session in the current unbroken run. */
  streak: number;
  longestStreak: number;
  freezes: number;
  /** Granted while the bank was full; they land when it drops below cap (§7). */
  pendingFreezes: number;
  /** Freeze Meter, in hundredths of a freeze point. */
  meter: number;
  /** How many freezes this run has already paid out, so a redo cannot double up. */
  streakFreezesGranted: number;
  /**
   * The last day already credited to the streak. Crediting is guarded on this,
   * so a second session the same day — or the same day being walked again
   * tomorrow — cannot increment twice.
   */
  lastCountedDay: string | null;
  /** The last fully elapsed day the walk has judged. */
  lastEvaluatedDay: string | null;
};

export type DayVerdict = {
  day: string;
  state: DayState;
  /** True when the day cost the streak, whatever it looked like on the heatmap. */
  brokeStreak: boolean;
  streakAfter: number;
  freezesAfter: number;
};

export function emptyState(): StreakState {
  return {
    streak: 0,
    longestStreak: 0,
    freezes: 0,
    pendingFreezes: 0,
    meter: 0,
    streakFreezesGranted: 0,
    lastCountedDay: null,
    lastEvaluatedDay: null,
  };
}

/** Moves queued freezes into the bank as soon as there is room (§7). */
export function settleQueue(state: StreakState): StreakState {
  const next = { ...state };
  while (next.freezes < FREEZE_CAP && next.pendingFreezes > 0) {
    next.freezes += 1;
    next.pendingFreezes -= 1;
  }
  // The meter keeps its points at cap rather than wasting them, so it only
  // converts once there is somewhere for the freeze to go.
  while (next.freezes < FREEZE_CAP && next.meter >= FREEZE_METER_TARGET) {
    next.meter -= FREEZE_METER_TARGET;
    next.freezes += 1;
  }
  return next;
}

/** A freeze from the streak or an achievement. Queues if the bank is full. */
export function grantFreeze(state: StreakState, count = 1): StreakState {
  let next = { ...state, pendingFreezes: state.pendingFreezes + count };
  next = settleQueue(next);
  return next;
}

/** Twenty per cent of earned XP drips into the meter (§7). Penalties do not. */
export function accrueMeter(state: StreakState, xpEarned: number): StreakState {
  if (xpEarned <= 0) return state;
  const gained = Math.round(xpEarned * FREEZE_METER_XP_SHARE * 100);
  return settleQueue({ ...state, meter: state.meter + gained });
}

export type PurchaseResult =
  | { ok: true; state: StreakState; xpSpent: number }
  | { ok: false; reason: "at_cap" | "not_enough_xp" };

/**
 * Because levels ratchet, spending XP can never cost a rank — which is the
 * whole reason the purchase exists (§7).
 */
export function purchaseFreeze(state: StreakState, availableXp: number): PurchaseResult {
  if (state.freezes >= FREEZE_CAP) return { ok: false, reason: "at_cap" };
  if (availableXp < FREEZE_PURCHASE_XP) return { ok: false, reason: "not_enough_xp" };
  return {
    ok: true,
    state: { ...state, freezes: state.freezes + 1 },
    xpSpent: FREEZE_PURCHASE_XP,
  };
}

/**
 * Credits one day to the streak. Idempotent: a day at or before the last
 * counted day changes nothing, so a second session today, or tomorrow's walk
 * revisiting today, cannot increment twice.
 */
export function creditDay(state: StreakState, day: string): StreakState {
  if (state.lastCountedDay !== null && day <= state.lastCountedDay) return state;

  let next: StreakState = {
    ...state,
    streak: state.streak + 1,
    lastCountedDay: day,
  };
  if (next.streak > next.longestStreak) next.longestStreak = next.streak;

  const earned = Math.floor(next.streak / FREEZE_STREAK_INTERVAL);
  if (earned > next.streakFreezesGranted) {
    next = grantFreeze({ ...next, streakFreezesGranted: earned }, earned - next.streakFreezesGranted);
  }
  return next;
}

export type WalkInput = {
  /** Inclusive range of fully elapsed days to judge. Today is never in here. */
  days: string[];
  activity: (day: string) => DayActivity | undefined;
  restWeekdays: readonly number[];
  isVacation: (day: string) => boolean;
  state: StreakState;
  /**
   * A verdict already recorded for a day. Spending a freeze is a decision, not
   * a fact, so a day that has already been judged is never judged again — with
   * the bank now empty a re-walk would turn a legitimately frozen day into a
   * gap and break a streak that never broke.
   */
  judged?: (day: string) => DayState | undefined;
};

/**
 * Judges each elapsed day in order. Freezes apply automatically — miss a day
 * with one banked and it spends itself, with no prompt and no decision (§7).
 */
export function walkDays(input: WalkInput): { verdicts: DayVerdict[]; state: StreakState } {
  let state = settleQueue(input.state);
  const verdicts: DayVerdict[] = [];

  for (const day of input.days) {
    const activity = input.activity(day);
    const completed = activity?.completed ?? 0;
    const abandoned = activity?.abandoned ?? 0;

    let dayState: DayState;
    const previous = input.judged?.(day);

    if (previous !== undefined) {
      // Already settled. Re-credit is guarded by lastCountedDay, and no freeze
      // is spent a second time.
      dayState = previous;
      if (previous === "active") state = creditDay(state, day);
    } else if (completed > 0) {
      dayState = "active";
      state = creditDay(state, day);
    } else if (input.isVacation(day)) {
      dayState = "vacation";
    } else if (input.restWeekdays.includes(weekdayOf(day))) {
      dayState = "rest";
    } else if (state.freezes > 0) {
      dayState = "frozen";
      state = settleQueue({ ...state, freezes: state.freezes - 1 });
    } else {
      dayState = "gap";
    }

    // A second abandon in one day breaks the streak whatever else happened (§3).
    const brokeByAbandons = abandoned >= ABANDONS_THAT_BREAK;
    const brokeByGap = dayState === "gap";

    if (brokeByAbandons || brokeByGap) {
      state = { ...state, streak: 0, streakFreezesGranted: 0 };
    }

    verdicts.push({
      day,
      state: dayState,
      brokeStreak: brokeByAbandons || brokeByGap,
      streakAfter: state.streak,
      freezesAfter: state.freezes,
    });
  }

  if (input.days.length > 0) {
    state = { ...state, lastEvaluatedDay: input.days[input.days.length - 1] };
  }

  return { verdicts, state };
}

/** Progress toward the next freeze from the meter, 0-1. */
export function meterProgress(state: StreakState): number {
  return Math.min(1, state.meter / FREEZE_METER_TARGET);
}
