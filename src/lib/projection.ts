/**
 * "Projection for next rank" (SPEC.md §9).
 *
 * Pace is measured in focused minutes per calendar day over a recent window,
 * counting the empty days too — a projection that only averages the days you
 * worked would flatter you and be wrong. Days you have declared as rest are the
 * exception: those are scheduled, not missed.
 */

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
  const window = daily.slice(-windowDays);
  const total = window.reduce((n, d) => n + d.minutes, 0);
  return {
    minutesPerDay: window.length === 0 ? 0 : total / window.length,
    activeDays: window.filter((d) => d.minutes > 0).length,
    windowDays: window.length,
  };
}

export type Projection =
  | { known: false; reason: "no_pace" | "at_cap" }
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

  const xpPerDay = pace.minutesPerDay * xpMultiplier;
  const days = Math.ceil(xpNeeded / xpPerDay);

  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return { known: true, days, date: date.toISOString().slice(0, 10) };
}
