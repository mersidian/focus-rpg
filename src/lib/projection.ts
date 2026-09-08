/**
 * "Projection for next rank" (SPEC.md §9).
 *
 * Pace is measured in focused minutes per calendar day over a recent window,
 * counting the empty days too — a projection that only averages the days you
 * worked would flatter you and be wrong.
 *
 * The window starts at your first session, not a fixed number of days back.
 * Counting days before you had an account as days you did nothing is how two
 * days of use produced "26 days to Novice II": twenty-six of the twenty-eight
 * days averaged in had not happened to you yet.
 *
 * And a few days is not a pace. Below `MIN_ACTIVE_DAYS` there is no projection
 * at all, because a number with no evidence behind it is worse than silence.
 */

/** Days with a completed session before a projection is offered. */
export const MIN_ACTIVE_DAYS = 4;

export type Pace = {
  /** Focused minutes per day across the window, empty days included. */
  minutesPerDay: number;
  /** Days in the window that had a completed session. */
  activeDays: number;
  windowDays: number;
};

export function measurePace(
  daily: { day: string; minutes: number }[],
  windowDays = 28,
): Pace {
  // Everything before the first session is not a day you missed.
  const firstActive = daily.findIndex((d) => d.minutes > 0);
  const since = firstActive === -1 ? [] : daily.slice(firstActive);
  const window = since.slice(-windowDays);
  const total = window.reduce((n, d) => n + d.minutes, 0);
  return {
    minutesPerDay: window.length === 0 ? 0 : total / window.length,
    activeDays: window.filter((d) => d.minutes > 0).length,
    windowDays: window.length,
  };
}

export type Projection =
  | { known: false; reason: "no_pace" | "at_cap" | "too_early"; activeDays?: number }
  | { known: true; days: number; date: string };

/**
 * Days until the next rank at the current pace. XP is one per focused minute,
 * so minutes convert directly — the prestige bonus is folded in by the caller
 * passing the multiplier it actually earns.
 */
export function projectNextRank(
  xpNeeded: number | null,
  pace: Pace,
  today: string,
  xpMultiplier = 1,
): Projection {
  if (xpNeeded === null) return { known: false, reason: "at_cap" };
  if (pace.minutesPerDay <= 0) return { known: false, reason: "no_pace" };
  if (pace.activeDays < MIN_ACTIVE_DAYS) {
    return { known: false, reason: "too_early", activeDays: pace.activeDays };
  }

  const xpPerDay = pace.minutesPerDay * xpMultiplier;
  const days = Math.ceil(xpNeeded / xpPerDay);

  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return { known: true, days, date: date.toISOString().slice(0, 10) };
}
