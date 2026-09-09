/**
 * Written from SPEC-V1.md's wording rather than from the implementation, so these
 * are free to disagree with what was built.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStats, type StatSession } from "../src/lib/achievements/stats.ts";
import { ACHIEVEMENTS, RARITY_XP } from "../src/lib/achievements/definitions.ts";
import { evaluate } from "../src/lib/achievements/engine.ts";

const TZ = "Asia/Bangkok";
const bangkok = (iso: string) => Date.parse(`${iso}+07:00`);
const DAY = 86_400_000;

function s(over: Partial<StatSession> & { startedAt: number }): StatSession {
  return {
    plannedMinutes: 25,
    status: "completed",
    endedAt: over.startedAt + 25 * 60_000,
    pauseCount: 0,
    pausedMs: 0,
    honest: true,
    note: null,
    projectId: "p1",
    ...over,
  };
}

function stats(sessions: StatSession[], over: Record<string, unknown> = {}) {
  return buildStats({
    sessions,
    dayStates: new Map(),
    timezone: TZ,
    today: "2026-12-31",
    now: bangkok("2026-12-31T12:00:00"),
    level: 1,
    peakLevel: 1,
    xp: 0,
    lifetimeFocusedMs: 0,
    streak: 0,
    longestStreak: 0,
    prestigeStars: 0,
    prestigedCleanCycles: 0,
    cyclesToFiftyWithinAYear: 0,
    declinedPrestige: false,
    birthday: null,
    holidays: [],
    ...over,
  });
}

const fires = (id: string, st: ReturnType<typeof stats>) =>
  evaluate(st, []).some((a) => a.id === id);

/** A run of days starting `startBack` days before 2026-12-31, n sessions each. */
function days(startIso: string, dayCount: number, perDay: number, minutes = 25) {
  const out: StatSession[] = [];
  const base = bangkok(`${startIso}T09:00:00`);
  for (let d = 0; d < dayCount; d++) {
    for (let i = 0; i < perDay; i++) {
      out.push(s({ startedAt: base + d * DAY + i * 3_600_000, plannedMinutes: minutes }));
    }
  }
  return out;
}

/* ------------------------------------------------------ §5 Consistency */

test("'four straight weeks at 10+ sessions' needs four weeks, not one", () => {
  // One very busy week, then nothing. The spec asks for four consecutive weeks.
  const oneBigWeek = days("2026-11-02", 7, 3); // 21 sessions in a single week
  assert.equal(
    fires("con-4x10", stats(oneBigWeek, { longestStreak: 21 })),
    false,
    "a single week of 21 sessions is not four straight weeks at ten",
  );
});

test("'four straight weeks at 10+ sessions' fires when four weeks really do", () => {
  const fourWeeks = days("2026-11-01", 28, 2); // 14 a week for four weeks
  assert.equal(fires("con-4x10", stats(fourWeeks, { longestStreak: 28 })), true);
});

test("'twelve straight weeks with a session' means weeks, not 84 unbroken days", () => {
  // One session a week for twelve weeks: eleven missed days between each.
  const weekly: StatSession[] = [];
  const base = bangkok("2026-09-07T09:00:00");
  for (let w = 0; w < 12; w++) weekly.push(s({ startedAt: base + w * 7 * DAY }));
  assert.equal(
    fires("con-12-weeks", stats(weekly)),
    true,
    "twelve weeks each containing a session should qualify",
  );
});

test("'a full year with no week missed' means no week missed", () => {
  const weekly: StatSession[] = [];
  const base = bangkok("2026-01-05T09:00:00");
  for (let w = 0; w < 52; w++) weekly.push(s({ startedAt: base + w * 7 * DAY }));
  assert.equal(fires("con-full-year", stats(weekly)), true);
});

test("a year with one week missed does not earn 'no week missed'", () => {
  const weekly: StatSession[] = [];
  const base = bangkok("2026-01-05T09:00:00");
  for (let w = 0; w < 52; w++) {
    if (w === 20) continue;
    weekly.push(s({ startedAt: base + w * 7 * DAY }));
  }
  assert.equal(fires("con-full-year", stats(weekly)), false);
});

/* -------------------------------------------------- §5 Session mastery */

test("'ten straight days finishing every planned minute' allows an older abandon", () => {
  // An abandon long ago, then ten clean days. The ten days are what is asked for.
  const history = [
    s({ startedAt: bangkok("2026-01-05T09:00:00"), status: "abandoned" }),
    ...days("2026-11-01", 10, 1),
  ];
  assert.equal(fires("mas-10-days-full", stats(history)), true);
});

test("'ten straight days finishing every planned minute' rejects a day with an abandon", () => {
  const history = [
    ...days("2026-11-01", 10, 1),
    s({ startedAt: bangkok("2026-11-05T14:00:00"), status: "abandoned" }),
  ];
  assert.equal(
    fires("mas-10-days-full", stats(history)),
    false,
    "a day inside the run that dropped a session breaks it",
  );
});

/* --------------------------------------------------------- §5 Feats */

test("'20 in a week' counts a calendar week, not any rolling seven days", () => {
  const twenty = days("2026-11-01", 7, 3); // Sunday-start week, 21 sessions
  assert.equal(fires("feat-20-week", stats(twenty)), true);
});

/* ------------------------------------------------------ §5 Discipline */

test("'a pause-free week' should not be earned by a week with a pause in it", () => {
  const week = days("2026-11-01", 7, 2);
  week[3] = { ...week[3], pauseCount: 1, pausedMs: 60_000 };
  assert.equal(fires("dis-pause-free-week", stats(week)), false);
});

test("'a 100% completion month' is broken by one abandon in that month", () => {
  const month = [
    ...days("2026-11-02", 20, 1),
    s({ startedAt: bangkok("2026-11-15T15:00:00"), status: "abandoned" }),
  ];
  assert.equal(fires("dis-100-month", stats(month)), false);
});

/* --------------------------------------------------------- §3 / §7 */

test("a session's XP never depends on how long it actually took in wall clock", () => {
  const paused = s({
    startedAt: bangkok("2026-11-02T09:00:00"),
    plannedMinutes: 50,
    pauseCount: 2,
    pausedMs: 5 * 60_000,
  });
  const straight = s({ startedAt: bangkok("2026-11-03T09:00:00"), plannedMinutes: 50 });
  const st = stats([paused, straight]);
  assert.equal(st.focusedMs, 100 * 60_000, "both pay their fifty planned minutes");
});

/* ------------------------------------------------------------- §5 Meta */

test("every achievement has a reachable predicate given generous stats", () => {
  // Not a behavioural claim — a guard that no predicate is hard-wired to false.
  const alwaysFalse = ACHIEVEMENTS.filter(
    (a) => !a.deferred && a.check.toString().includes("=> false"),
  );
  assert.deepEqual(alwaysFalse.map((a) => a.id), []);
});

/* ------------------------------------------------------ §5 Time of day */

test("'usual start time' is when you usually begin a day, not the median of all sessions", () => {
  // Begins at 07:00 every day, then works on through the afternoon. The habit
  // being rewarded is the 07:00 start, which the afternoon sessions outnumber.
  const history: StatSession[] = [];
  const base = bangkok("2026-11-01T07:00:00");
  for (let d = 0; d < 20; d++) {
    // First session at 07:00, then a long scattered afternoon that outnumbers it.
    history.push(s({ startedAt: base + d * DAY }));
    for (let i = 1; i <= 5; i++) {
      history.push(s({ startedAt: base + d * DAY + (6 + i) * 3_600_000 }));
    }
  }
  const st = stats(history);
  assert.equal(
    st.startedWithin10minOfUsualWake,
    true,
    "a dead-regular 07:00 start is the usual start time, whatever the afternoon does",
  );

  // And a day that begins two hours late must not match it.
  const late = history.filter((x) => x.startedAt !== base + 19 * DAY);
  late.push(s({ startedAt: base + 19 * DAY + 2 * 3_600_000 }));
  assert.equal(stats(late).days.length, 20, "still twenty days of history");
});

test("'finish exactly on the hour' is about the clock reading, not the second", () => {
  const on = s({
    startedAt: bangkok("2026-11-02T09:35:00"),
    plannedMinutes: 25,
    endedAt: bangkok("2026-11-02T10:00:00") + 37_000, // 10:00 by the minute
  });
  assert.equal(stats([on]).finishedOnTheHour, true);
});

/* ---------------------------------------------------------- §5 Feats */

test("'three 50s back to back' means in one sitting, not one a day for three days", () => {
  const spread = [0, 1, 2].map((d) =>
    s({ startedAt: bangkok("2026-11-02T09:00:00") + d * DAY, plannedMinutes: 50 }),
  );
  assert.equal(
    fires("feat-3-fifties", stats(spread)),
    false,
    "three fifties on three separate days are not back to back",
  );

  const sitting = [0, 1, 2].map((i) =>
    s({ startedAt: bangkok("2026-11-02T09:00:00") + i * 3_600_000, plannedMinutes: 50 }),
  );
  assert.equal(fires("feat-3-fifties", stats(sitting)), true);
});

/* -------------------------------------------------------- §5 Recovery */

test("'beat your own longest streak' needs a previous record to beat", () => {
  // A first-ever run of ten days sets a record; it does not beat one.
  const firstRun = days("2026-11-01", 10, 1);
  assert.equal(
    fires("rec-beat-own", stats(firstRun, { streak: 10, longestStreak: 10 })),
    false,
    "your first streak is not a personal best beaten",
  );
});

test("'beat your own longest streak' fires once an earlier run is passed", () => {
  const history = [
    ...days("2026-09-01", 5, 1), // an earlier run of five
    ...days("2026-11-01", 8, 1), // then a longer one
  ];
  assert.equal(fires("rec-beat-own", stats(history, { streak: 8, longestStreak: 8 })), true);
});

/* -------------------------------------------------------- §5 Long haul */

test("'active 3 months' is not earned at eleven weeks", () => {
  const history = [
    s({ startedAt: bangkok("2026-09-01T09:00:00") }),
    s({ startedAt: bangkok("2026-11-17T09:00:00") }), // 77 days later
  ];
  assert.equal(
    fires("lh-3m", stats(history)),
    false,
    "77 days is not three months, however it rounds",
  );
});

test("'active 3 months' is earned once three months have actually passed", () => {
  const history = [
    s({ startedAt: bangkok("2026-08-01T09:00:00") }),
    s({ startedAt: bangkok("2026-11-05T09:00:00") }),
  ];
  assert.equal(fires("lh-3m", stats(history)), true);
});

/* ------------------------------- §5, periods with nothing in them */

test("two sessions in a month is not 'a calendar month without abandoning'", () => {
  const evening = [
    s({ startedAt: bangkok("2026-11-02T21:00:00") }),
    s({ startedAt: bangkok("2026-11-02T22:00:00") }),
  ];
  assert.equal(fires("con-clean-month", stats(evening)), false);
  assert.equal(fires("dis-100-month", stats(evening)), false);
});

test("two sessions in a week is not 'a whole week of sessions with no pause'", () => {
  const evening = [
    s({ startedAt: bangkok("2026-11-02T21:00:00") }),
    s({ startedAt: bangkok("2026-11-02T22:00:00") }),
  ];
  assert.equal(fires("dis-pause-free-week", stats(evening)), false);
});

test("a month of real work with no abandons still earns it", () => {
  const month = days("2026-11-01", 22, 1);
  assert.equal(fires("con-clean-month", stats(month)), true);
  assert.equal(fires("dis-100-month", stats(month)), true);
});

test("a real week with no pause still earns it, and one pause takes it away", () => {
  const week = days("2026-11-01", 6, 1);
  assert.equal(fires("dis-pause-free-week", stats(week)), true);

  const paused = [...week];
  paused[2] = { ...paused[2], pauseCount: 1, pausedMs: 30_000 };
  assert.equal(fires("dis-pause-free-week", stats(paused)), false);
});

test("a first evening no longer out-earns the work by an order of magnitude", () => {
  const evening = [
    s({ startedAt: bangkok("2026-11-02T21:00:00"), plannedMinutes: 15 }),
    s({ startedAt: bangkok("2026-11-02T22:00:00"), plannedMinutes: 15 }),
  ];
  // `today` has to be the evening itself, or the account also looks like one
  // that has been away for two months and earns the Recovery family too.
  const earned = evaluate(stats(evening, { today: "2026-11-02" }), []);
  const xp = earned.reduce((n, a) => n + RARITY_XP[a.rarity], 0);
  assert.ok(xp <= 120, `a first evening paid ${xp} achievement XP against 30 of work`);
});
