/**
 * Everything the 131 achievement predicates need, computed once from the full
 * session history (SPEC.md §5).
 *
 * This is deliberately done in TypeScript over every row rather than as forty
 * SQL aggregates. It is a single-user app — ten years of eight sessions a day is
 * under 30,000 rows — and the rules are intricate enough ("four consecutive
 * hours each containing a session", "a day whose lengths read the same in both
 * directions") that they are far easier to get right, and to test, as ordinary
 * code.
 */

import { addDays, daysBetween, gameDay, quarterOf, weekdayOf } from "../game-day";

export type StatSession = {
  plannedMinutes: number;
  status: "completed" | "abandoned";
  startedAt: number;
  endedAt: number | null;
  pauseCount: number;
  pausedMs: number;
  honest: boolean | null;
  note: string | null;
  projectId: string | null;
};

/** A session with its local-time parts resolved once. */
type Marked = StatSession & {
  day: string;
  startHour: number;
  startMinute: number;
  endHour: number | null;
  endMinute: number | null;
  endSecond: number | null;
  /** Calendar date of the start in local time, which is not the game day. */
  calendarDay: string;
  month: string;
  year: number;
};

export type DayFacts = {
  day: string;
  completed: number;
  abandoned: number;
  focusedMs: number;
  lengths: number[];
  state?: "active" | "frozen" | "rest" | "vacation" | "gap";
};

export type Stats = {
  now: number;
  timezone: string;
  today: string;

  /* progression */
  level: number;
  /** Highest level ever reached, surviving every prestige reset. */
  peakLevel: number;
  xp: number;
  lifetimeFocusedMs: number;
  prestigeStars: number;
  prestigedCleanCycles: number;
  cyclesToFiftyWithinAYear: number;
  declinedPrestige: boolean;

  /* streaks */
  streak: number;
  longestStreak: number;

  /* volume */
  sessions: number;
  abandons: number;
  focusedMs: number;
  countByLength: Record<number, number>;

  /* days */
  days: DayFacts[];
  activeDays: number;
  maxSessionsInDay: number;
  maxFocusedMsInDay: number;
  maxSessionsInWeek: number;
  maxSessionsInMonth: number;
  maxFocusedMsInMonth: number;
  maxFocusedMsInQuarter: number;
  maxFocusedMsInWeekend: number;
  /** Consecutive calendar weeks that each contained at least one session. */
  maxConsecutiveWeeksWithSession: number;
  /** Consecutive calendar weeks that each held ten or more sessions. */
  maxConsecutiveWeeksWith10Plus: number;
  /** Consecutive days that each finished every session started on them. */
  maxConsecutiveCleanDays: number;

  /* patterns */
  maxConsecutiveHoursWithSession: number;
  allFiftyDays: number;
  allFifteenDays: number;
  allThreeLengthsDays: number;
  maxConsecutiveFifties: number;
  nineToFiveSweepDays: number;
  daysWithFiftyMinSession: number;
  maxConsecutiveDaysWithFifty: number;

  /* time of day */
  earliestStartHour: number | null;
  latestStartHour: number | null;
  sessionsBefore6am: number;
  sessionsBefore5am: number;
  sessionsAfter11pm: number;
  sessionsAfter2am: number;
  sessionsBefore8am: number;
  sessionsAfter10pm: number;
  hoursCovered: number;
  finishedOnTheHour: boolean;
  crossedMidnight: boolean;
  startedWithin10minOfUsualWake: boolean;

  /* discipline */
  zeroPauseSessions: number;
  untouchedPauseBudgetSessions: number;
  noPauseFiftySessions: number;
  maxConsecutiveHonest: number;
  sameDayRecoveries: number;
  pauseFreeWeeks: number;
  cleanMonths: number;
  perfectCompletionMonths: number;

  /* recovery */
  longestAbsenceDays: number;
  /** Every unbroken run of the streak, oldest first. */
  streakRuns: number[];
  rebuiltStreak7: boolean;
  rebuiltStreak30: boolean;
  beatOwnLongestStreak: boolean;

  /* journal */
  longNotes: number;
  maxSessionsOnOneProject: number;
  maxConsecutiveDaysWithNote: number;
  slackedAdmissions: number;

  /* calendar */
  calendarDaysCovered: Set<string>;
  monthsCovered: Set<number>;
  seasonsCovered: Set<string>;
  fullCalendarMonths: number;
  sundayMorning: boolean;
  birthdayWorked: boolean;
  holidayWorked: boolean;
  maxConsecutiveMondays: number;

  /* long haul */
  activeMonthsSpan: number;
  cleanFinalSessions: number;
  abandonsInLast200: number;

  /* hidden */
  mirrorDays: number;
  yearCrossingSession: boolean;
  fullPauseBudgetCompletions: number;
  coldOpens: number;
  exactMidnightFinish: boolean;
  sameMinuteStartRun: number;

  /* meta — filled in by the engine, which knows what is unlocked */
  unlockedCount: number;
  unlockedHidden: number;
  completedFamilies: number;
};

const partsCache = new Map<string, Intl.DateTimeFormat>();

function parts(timezone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timezone, f);
  }
  return f;
}

function localParts(ms: number, timezone: string) {
  const map: Record<string, string> = {};
  for (const p of parts(timezone).formatToParts(ms)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    date: `${map.year}-${map.month}-${map.day}`,
  };
}

function mark(s: StatSession, timezone: string): Marked {
  const start = localParts(s.startedAt, timezone);
  const end = s.endedAt === null ? null : localParts(s.endedAt, timezone);
  return {
    ...s,
    day: gameDay(s.startedAt, timezone),
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end?.hour ?? null,
    endMinute: end?.minute ?? null,
    endSecond: end?.second ?? null,
    calendarDay: start.date,
    month: `${start.year}-${String(start.month).padStart(2, "0")}`,
    year: start.year,
  };
}

function longestRun<T>(items: T[], ok: (item: T) => boolean): number {
  let best = 0;
  let run = 0;
  for (const item of items) {
    run = ok(item) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * A period only counts as clean if there was something in it to keep clean.
 *
 * "A calendar month without abandoning a single session" is a claim about a
 * month of work, not about a month you barely used: two sessions and no
 * abandons is an empty month, not a spotless one. Without a floor, a new
 * account earns three period achievements on its first evening.
 */
const MIN_SESSIONS_FOR_CLEAN_MONTH = 20;
const MIN_SESSIONS_FOR_CLEAN_WEEK = 5;

const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
function seasonOf(month: number): string {
  return SEASONS[Math.floor((month % 12) / 3)];
}

export type StatsInput = {
  sessions: StatSession[];
  dayStates: Map<string, DayFacts["state"]>;
  timezone: string;
  today: string;
  now: number;
  level: number;
  /** Highest level ever reached, surviving every prestige reset. */
  peakLevel: number;
  xp: number;
  lifetimeFocusedMs: number;
  streak: number;
  longestStreak: number;
  prestigeStars: number;
  prestigedCleanCycles: number;
  cyclesToFiftyWithinAYear: number;
  declinedPrestige: boolean;
  /** "MM-DD"; only the month and day matter. */
  birthday: string | null;
  /** Full "YYYY-MM-DD" dates the user keeps as holidays. */
  holidays: string[];
};

export function buildStats(input: StatsInput): Stats {
  const { timezone } = input;
  const all = input.sessions
    .map((s) => mark(s, timezone))
    .sort((a, b) => a.startedAt - b.startedAt);
  const done = all.filter((s) => s.status === "completed");

  /* ------------------------------------------------------------ by day */

  const dayMap = new Map<string, Marked[]>();
  for (const s of all) {
    const list = dayMap.get(s.day);
    if (list) list.push(s);
    else dayMap.set(s.day, [s]);
  }

  const days: DayFacts[] = [...dayMap.entries()]
    .map(([day, list]) => {
      const finished = list.filter((s) => s.status === "completed");
      return {
        day,
        completed: finished.length,
        abandoned: list.filter((s) => s.status === "abandoned").length,
        focusedMs: finished.reduce((n, s) => n + s.plannedMinutes * 60_000, 0),
        lengths: finished.map((s) => s.plannedMinutes),
        state: input.dayStates.get(day),
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day));

  const activeDayList = days.filter((d) => d.completed > 0);

  /* -------------------------------------------------- rolling windows */

  const byWeek = new Map<string, { sessions: number; focusedMs: number }>();
  const byMonth = new Map<string, { sessions: number; focusedMs: number; abandons: number }>();
  const byQuarter = new Map<string, number>();
  const weekendMs = new Map<string, number>();

  for (const d of days) {
    // Weeks are keyed by the Sunday they start on.
    const weekKey = addDays(d.day, -weekdayOf(d.day));
    const w = byWeek.get(weekKey) ?? { sessions: 0, focusedMs: 0 };
    w.sessions += d.completed;
    w.focusedMs += d.focusedMs;
    byWeek.set(weekKey, w);

    const monthKey = d.day.slice(0, 7);
    const m = byMonth.get(monthKey) ?? { sessions: 0, focusedMs: 0, abandons: 0 };
    m.sessions += d.completed;
    m.focusedMs += d.focusedMs;
    m.abandons += d.abandoned;
    byMonth.set(monthKey, m);

    byQuarter.set(quarterOf(d.day), (byQuarter.get(quarterOf(d.day)) ?? 0) + d.focusedMs);

    const wd = weekdayOf(d.day);
    if (wd === 6 || wd === 0) {
      // A weekend is the Saturday plus the Sunday that follows it.
      const key = wd === 6 ? d.day : addDays(d.day, -1);
      weekendMs.set(key, (weekendMs.get(key) ?? 0) + d.focusedMs);
    }
  }

  /* ------------------------------------------------------- hour sweeps */

  let maxConsecutiveHours = 0;
  let nineToFive = 0;
  for (const [, list] of dayMap) {
    const hours = new Set(list.filter((s) => s.status === "completed").map((s) => s.startHour));
    let run = 0;
    let best = 0;
    for (let h = 0; h < 24; h++) {
      run = hours.has(h) ? run + 1 : 0;
      if (run > best) best = run;
    }
    if (best > maxConsecutiveHours) maxConsecutiveHours = best;
    if ([9, 10, 11, 12, 13, 14, 15, 16].every((h) => hours.has(h))) nineToFive += 1;
  }

  /* ------------------------------------------------- consecutive runs */

  const dayKeys = days.map((d) => d.day);
  const consecutiveDayRuns = (ok: (d: DayFacts) => boolean): number => {
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of days) {
      const contiguous = prev !== null && daysBetween(prev, d.day) === 1;
      run = ok(d) ? (contiguous ? run + 1 : 1) : 0;
      if (run > best) best = run;
      prev = d.day;
    }
    return best;
  };

  // "Back to back" is a sitting, not a habit: three fifties on three separate
  // days are not consecutive in any sense the phrase carries.
  let maxConsecutiveFifties = 0;
  for (const [, list] of dayMap) {
    const run = longestRun(
      list.filter((x) => x.status === "completed"),
      (x) => x.plannedMinutes === 50,
    );
    if (run > maxConsecutiveFifties) maxConsecutiveFifties = run;
  }
  let honestRun = longestRun(done, (s) => s.honest === true);

  /* --------------------------------------------------------- absences */

  let longestAbsence = 0;
  for (let i = 1; i < activeDayList.length; i++) {
    const gap = daysBetween(activeDayList[i - 1].day, activeDayList[i].day) - 1;
    if (gap > longestAbsence) longestAbsence = gap;
  }
  if (activeDayList.length > 0) {
    const sinceLast = daysBetween(activeDayList.at(-1)!.day, input.today) - 1;
    if (sinceLast > longestAbsence) longestAbsence = sinceLast;
  }

  /* ------------------------------------------------- same-day recovery */

  let sameDayRecoveries = 0;
  for (const [, list] of dayMap) {
    const firstAbandon = list.findIndex((s) => s.status === "abandoned");
    if (firstAbandon >= 0 && list.slice(firstAbandon + 1).some((s) => s.status === "completed")) {
      sameDayRecoveries += 1;
    }
  }

  /* -------------------------------------------------------- calendar */

  const calendarDaysCovered = new Set(done.map((s) => s.calendarDay.slice(5)));
  const monthsCovered = new Set(done.map((s) => Number(s.month.slice(5))));
  const seasonsCovered = new Set([...monthsCovered].map(seasonOf));

  const monthDayCounts = new Map<string, Set<string>>();
  for (const s of done) {
    const key = s.calendarDay.slice(0, 7);
    const set = monthDayCounts.get(key) ?? new Set();
    set.add(s.calendarDay);
    monthDayCounts.set(key, set);
  }
  let fullCalendarMonths = 0;
  for (const [key, set] of monthDayCounts) {
    const [y, m] = key.split("-").map(Number);
    if (set.size === new Date(Date.UTC(y, m, 0)).getUTCDate()) fullCalendarMonths += 1;
  }

  const mondays = days.filter((d) => weekdayOf(d.day) === 1 && d.completed > 0).map((d) => d.day);
  let maxConsecutiveMondays = 0;
  {
    let run = 0;
    let prev: string | null = null;
    for (const d of mondays) {
      run = prev !== null && daysBetween(prev, d) === 7 ? run + 1 : 1;
      if (run > maxConsecutiveMondays) maxConsecutiveMondays = run;
      prev = d;
    }
  }

  /* ---------------------------------------------------------- journal */

  const projectCounts = new Map<string, number>();
  for (const s of done) {
    if (s.projectId) projectCounts.set(s.projectId, (projectCounts.get(s.projectId) ?? 0) + 1);
  }

  /* ----------------------------------------------------------- hidden */

  let mirrorDays = 0;
  for (const d of days) {
    if (d.lengths.length >= 3) {
      const reversed = [...d.lengths].reverse();
      if (d.lengths.every((n, i) => n === reversed[i])) mirrorDays += 1;
    }
  }

  /**
   * The habit being rewarded is the time you start your day, so the median is
   * taken over each day's *first* session. Averaging every session would let a
   * busy afternoon decide when you supposedly get up.
   */
  const firstOfDay = activeDayList
    .map((d) => dayMap.get(d.day)!.find((x) => x.status === "completed"))
    .filter((x): x is Marked => Boolean(x));
  const firstMinutes = firstOfDay.map((x) => x.startHour * 60 + x.startMinute);
  const usualWake =
    firstMinutes.length >= 10
      ? [...firstMinutes].sort((a, b) => a - b)[Math.floor(firstMinutes.length / 2)]
      : null;

  let sameMinuteRun = 0;
  {
    let run = 0;
    let prev: Marked | null = null;
    for (const s of firstOfDay) {
      const same =
        prev !== null &&
        daysBetween(prev.day, s.day) === 1 &&
        prev.startHour === s.startHour &&
        prev.startMinute === s.startMinute;
      run = same ? run + 1 : 1;
      if (run > sameMinuteRun) sameMinuteRun = run;
      prev = s;
    }
  }

  /* ---------------------------------------------------- runs of weeks */

  /**
   * Several achievements are stated in weeks — "four straight weeks at 10+
   * sessions", "twelve straight weeks with a session", "a full year with no
   * week missed". A week is a week: a run of daily sessions is neither
   * necessary nor sufficient for any of them.
   */
  const weekKeys = [...byWeek.keys()].sort();
  const weekRun = (ok: (w: { sessions: number }) => boolean): number => {
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const key of weekKeys) {
      const contiguous = prev !== null && daysBetween(prev, key) === 7;
      run = ok(byWeek.get(key)!) ? (contiguous ? run + 1 : 1) : 0;
      if (run > best) best = run;
      prev = key;
    }
    return best;
  };

  const maxConsecutiveWeeksWithSession = weekRun((w) => w.sessions > 0);
  const maxConsecutiveWeeksWith10Plus = weekRun((w) => w.sessions >= 10);

  /* ------------------------------------------------------ streak runs */

  // Each unbroken run of the streak, in order. A "rebuild" is any run that is
  // not the first — the user broke, and climbed back (§5, Recovery).
  const streakRuns: number[] = [];
  {
    let run = 0;
    let prev: string | null = null;
    for (const d of days) {
      const missedBetween = prev !== null && daysBetween(prev, d.day) > 1;
      const preserved = d.state === "frozen" || d.state === "rest" || d.state === "vacation";
      if (missedBetween && !preserved) {
        if (run > 0) streakRuns.push(run);
        run = 0;
      }
      if (d.completed > 0) {
        run += 1;
      } else if (!preserved) {
        if (run > 0) streakRuns.push(run);
        run = 0;
      }
      prev = d.day;
    }
    if (run > 0) streakRuns.push(run);
  }

  /* ------------------------------------------------------- long haul */

  const last200 = done.slice(-200);
  const finalRun = (() => {
    let n = 0;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].status === "completed") n += 1;
      else break;
    }
    return n;
  })();

  /**
   * Whole calendar months between the first and last session. Dividing by an
   * average month length and rounding made eleven weeks read as three months.
   */
  const spanMonths = (() => {
    if (done.length === 0) return 0;
    const a = localParts(done[0].startedAt, timezone);
    const b = localParts(done.at(-1)!.startedAt, timezone);
    let months = (b.year - a.year) * 12 + (b.month - a.month);
    if (b.day < a.day) months -= 1;
    return Math.max(0, months);
  })();

  const countByLength: Record<number, number> = {};
  for (const s of done) countByLength[s.plannedMinutes] = (countByLength[s.plannedMinutes] ?? 0) + 1;

  const pauseFreeWeeks = [...byWeek.entries()].filter(([key, w]) => {
    if (w.sessions < MIN_SESSIONS_FOR_CLEAN_WEEK) return false;
    return dayRangeSessions(dayMap, key).every((s) => s.pauseCount === 0);
  }).length;

  return {
    now: input.now,
    timezone,
    today: input.today,

    level: input.level,
    peakLevel: input.peakLevel,
    xp: input.xp,
    lifetimeFocusedMs: input.lifetimeFocusedMs,
    prestigeStars: input.prestigeStars,
    prestigedCleanCycles: input.prestigedCleanCycles,
    cyclesToFiftyWithinAYear: input.cyclesToFiftyWithinAYear,
    declinedPrestige: input.declinedPrestige,

    streak: input.streak,
    longestStreak: input.longestStreak,

    sessions: done.length,
    abandons: all.length - done.length,
    focusedMs: done.reduce((n, s) => n + s.plannedMinutes * 60_000, 0),
    countByLength,

    days,
    activeDays: activeDayList.length,
    maxSessionsInDay: Math.max(0, ...days.map((d) => d.completed)),
    maxFocusedMsInDay: Math.max(0, ...days.map((d) => d.focusedMs)),
    maxSessionsInWeek: Math.max(0, ...[...byWeek.values()].map((w) => w.sessions)),
    maxSessionsInMonth: Math.max(0, ...[...byMonth.values()].map((m) => m.sessions)),
    maxFocusedMsInMonth: Math.max(0, ...[...byMonth.values()].map((m) => m.focusedMs)),
    maxFocusedMsInQuarter: Math.max(0, ...byQuarter.values()),
    maxFocusedMsInWeekend: Math.max(0, ...weekendMs.values()),
    maxConsecutiveWeeksWithSession,
    maxConsecutiveWeeksWith10Plus,
    maxConsecutiveCleanDays: consecutiveDayRuns((d) => d.completed > 0 && d.abandoned === 0),

    maxConsecutiveHoursWithSession: maxConsecutiveHours,
    allFiftyDays: days.filter((d) => d.completed >= 2 && d.lengths.every((n) => n === 50)).length,
    allFifteenDays: days.filter((d) => d.completed >= 2 && d.lengths.every((n) => n === 15)).length,
    allThreeLengthsDays: days.filter(
      (d) => [15, 25, 50].every((n) => d.lengths.includes(n)),
    ).length,
    maxConsecutiveFifties,
    nineToFiveSweepDays: nineToFive,
    daysWithFiftyMinSession: days.filter((d) => d.lengths.includes(50)).length,
    maxConsecutiveDaysWithFifty: consecutiveDayRuns((d) => d.lengths.includes(50)),

    earliestStartHour: done.length ? Math.min(...done.map((s) => s.startHour)) : null,
    latestStartHour: done.length ? Math.max(...done.map((s) => s.startHour)) : null,
    sessionsBefore6am: done.filter((s) => s.startHour < 6).length,
    sessionsBefore5am: done.filter((s) => s.startHour < 5).length,
    sessionsAfter11pm: done.filter((s) => s.startHour >= 23).length,
    sessionsAfter2am: done.filter((s) => s.startHour >= 2 && s.startHour < 5).length,
    sessionsBefore8am: done.filter((s) => s.startHour < 8).length,
    sessionsAfter10pm: done.filter((s) => s.startHour >= 22).length,
    hoursCovered: new Set(done.map((s) => s.startHour)).size,
    finishedOnTheHour: done.some((s) => s.endMinute === 0),
    crossedMidnight: done.some(
      (s) => s.endHour !== null && s.endHour < s.startHour,
    ),
    startedWithin10minOfUsualWake:
      usualWake !== null &&
      firstOfDay.some((x) => Math.abs(x.startHour * 60 + x.startMinute - usualWake) <= 10),

    zeroPauseSessions: done.filter((s) => s.pauseCount === 0).length,
    untouchedPauseBudgetSessions: done.filter((s) => s.pausedMs === 0).length,
    noPauseFiftySessions: done.filter((s) => s.plannedMinutes === 50 && s.pauseCount === 0).length,
    maxConsecutiveHonest: honestRun,
    sameDayRecoveries,
    pauseFreeWeeks,
    cleanMonths: [...byMonth.values()].filter(
      (m) => m.sessions >= MIN_SESSIONS_FOR_CLEAN_MONTH && m.abandons === 0,
    ).length,
    perfectCompletionMonths: [...byMonth.values()].filter(
      (m) => m.sessions >= MIN_SESSIONS_FOR_CLEAN_MONTH && m.abandons === 0,
    ).length,

    longestAbsenceDays: longestAbsence,
    streakRuns,
    rebuiltStreak7: streakRuns.slice(1).some((r) => r >= 7),
    rebuiltStreak30: streakRuns.slice(1).some((r) => r >= 30),
    // A first run sets a record; it does not beat one.
    beatOwnLongestStreak:
      streakRuns.length >= 2 &&
      streakRuns.at(-1)! > Math.max(...streakRuns.slice(0, -1)),

    longNotes: done.filter((s) => (s.note?.length ?? 0) > 100).length,
    maxSessionsOnOneProject: Math.max(0, ...projectCounts.values()),
    maxConsecutiveDaysWithNote: consecutiveDayRuns((d) =>
      (dayMap.get(d.day) ?? []).some((s) => s.status === "completed" && Boolean(s.note)),
    ),
    slackedAdmissions: done.filter((s) => s.honest === false).length,

    calendarDaysCovered,
    monthsCovered,
    seasonsCovered,
    fullCalendarMonths,
    sundayMorning: done.some((s) => weekdayOf(s.day) === 0 && s.startHour < 12),
    birthdayWorked:
      input.birthday !== null && calendarDaysCovered.has(input.birthday.slice(-5)),
    holidayWorked: done.some((s) => input.holidays.includes(s.calendarDay)),
    maxConsecutiveMondays,

    activeMonthsSpan: spanMonths,
    cleanFinalSessions: finalRun,
    abandonsInLast200: last200.length === 0 ? 0 : all.slice(-200).filter((s) => s.status === "abandoned").length,

    mirrorDays,
    yearCrossingSession: done.some(
      (s) => s.endedAt !== null && localParts(s.endedAt, timezone).year !== s.year,
    ),
    fullPauseBudgetCompletions: done.filter(
      (s) => s.pauseCount === 2 && s.pausedMs >= 4 * 60_000 + 55_000,
    ).length,
    coldOpens: done.filter((s) => s.startHour === 4 && s.startMinute === 0).length,
    exactMidnightFinish: done.some((s) => s.endHour === 0 && s.endMinute === 0),
    sameMinuteStartRun: sameMinuteRun,

    unlockedCount: 0,
    unlockedHidden: 0,
    completedFamilies: 0,
  };
}

function dayRangeSessions(dayMap: Map<string, StatSession[]>, weekStart: string): StatSession[] {
  const out: StatSession[] = [];
  for (let i = 0; i < 7; i++) {
    const list = dayMap.get(addDays(weekStart, i));
    if (list) out.push(...list);
  }
  return out;
}
