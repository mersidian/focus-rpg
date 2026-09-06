import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACHIEVEMENTS,
  FAMILIES,
  RARITY_XP,
  achievementXp,
} from "../src/lib/achievements/definitions.ts";
import { evaluate, progressOf } from "../src/lib/achievements/engine.ts";
import { buildStats, type StatSession } from "../src/lib/achievements/stats.ts";

const TZ = "Asia/Bangkok";
const bangkok = (iso: string) => Date.parse(`${iso}+07:00`);

function session(over: Partial<StatSession> & { startedAt: number }): StatSession {
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
    today: "2026-09-06",
    now: bangkok("2026-09-06T12:00:00"),
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

/* ------------------------------------------------------- the catalogue */

test("there are 131 achievements in the thirteen families the spec names", () => {
  assert.equal(ACHIEVEMENTS.length, 131);
  const expected: Record<string, number> = {
    volume: 14, consistency: 14, feats: 15, time: 10, discipline: 12,
    recovery: 7, mastery: 9, journal: 8, calendar: 9, longhaul: 8,
    prestige: 10, meta: 7, hidden: 8,
  };
  for (const family of FAMILIES) {
    assert.equal(
      ACHIEVEMENTS.filter((a) => a.family === family).length,
      expected[family],
      family,
    );
  }
});

test("ids are unique and every one pays its rarity", () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 131);
  for (const a of ACHIEVEMENTS) assert.equal(achievementXp(a), RARITY_XP[a.rarity]);
});

test("roughly a third carry a wearable title", () => {
  const titled = ACHIEVEMENTS.filter((a) => a.title).length;
  assert.ok(titled >= 40 && titled <= 48, `${titled} titles is not roughly a third`);
  // No two achievements offer the same title to wear.
  const titles = ACHIEVEMENTS.filter((a) => a.title).map((a) => a.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("exactly eight are hidden", () => {
  assert.equal(ACHIEVEMENTS.filter((a) => a.hidden).length, 8);
});

test("freezes are granted only by the families about surviving time away", () => {
  for (const a of ACHIEVEMENTS.filter((x) => x.freezes)) {
    assert.ok(
      a.family === "consistency" || a.family === "recovery",
      `${a.id} grants freezes but is in ${a.family}`,
    );
  }
});

/* --------------------------------------------------------- evaluation */

test("nothing unlocks from an empty history", () => {
  const earned = evaluate(stats([]), []);
  assert.deepEqual(earned, []);
});

test("one finished session earns the first achievement", () => {
  const earned = evaluate(stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })]), []);
  assert.ok(earned.some((a) => a.id === "vol-first"));
});

test("an unlock is never handed out twice", () => {
  const s = stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })]);
  const first = evaluate(s, []);
  const second = evaluate(s, first.map((a) => a.id));
  assert.deepEqual(second, []);
});

test("the Meta family cascades in one pass", () => {
  // Ten unlocks should also earn "Ten Earned", which is itself an unlock.
  const many: StatSession[] = [];
  for (let i = 0; i < 60; i++) {
    many.push(session({ startedAt: bangkok("2026-09-05T08:00:00") + i * 60 * 60_000 }));
  }
  const earned = evaluate(stats(many), []);
  const ids = earned.map((a) => a.id);
  assert.ok(ids.includes("meta-10"), "ten earned did not cascade");
  assert.ok(ids.includes("vol-50"), "fifty sessions was not counted");
});

test("reaching fifty stays earned after the reset that follows it", () => {
  // Prestige puts the level back to 1; the peak is what the achievement reads.
  const afterReset = evaluate(
    stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], {
      level: 1,
      peakLevel: 50,
      prestigeStars: 1,
    }),
    [],
  );
  assert.ok(
    afterReset.some((a) => a.id === "pre-50"),
    "reaching level 50 must survive the prestige that immediately follows it",
  );
});

test("levels alone earn the two prestige achievements that are about levels", () => {
  const earned = evaluate(
    stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], {
      level: 100,
      peakLevel: 100,
    }),
    [],
  );
  assert.ok(earned.some((a) => a.id === "pre-50"));
  assert.ok(earned.some((a) => a.id === "pre-mythic"));
  // No stars and no declared decision, so these must not fire.
  assert.ok(!earned.some((a) => a.id === "pre-once"));
  assert.ok(
    !earned.some((a) => a.id === "pre-decline-75"),
    "reaching 75 is not the same as declining prestige and reaching 75",
  );
});

test("declining prestige is what earns The Road Not Taken, not the level", () => {
  const withoutDeclining = evaluate(
    stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], { level: 80 }),
    [],
  );
  assert.ok(!withoutDeclining.some((a) => a.id === "pre-decline-75"));

  const afterDeclining = evaluate(
    stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], {
      level: 80,
      declinedPrestige: true,
    }),
    [],
  );
  assert.ok(afterDeclining.some((a) => a.id === "pre-decline-75"));
});

test("stars earn their achievements once prestige has happened", () => {
  const earned = evaluate(
    stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], { prestigeStars: 3 }),
    [],
  );
  const ids = earned.map((a) => a.id);
  assert.ok(ids.includes("pre-once"));
  assert.ok(ids.includes("pre-2"));
  assert.ok(ids.includes("pre-3"));
  assert.ok(!ids.includes("pre-5"));
});

/* ------------------------------------------------- specific predicates */

test("a mirror day reads the same in both directions", () => {
  const base = bangkok("2026-09-05T08:00:00");
  const lengths = [15, 25, 50, 25, 15];
  const day = lengths.map((m, i) =>
    session({ startedAt: base + i * 60 * 60_000, plannedMinutes: m }),
  );
  assert.equal(stats(day).mirrorDays, 1);

  const notMirrored = [15, 25, 50].map((m, i) =>
    session({ startedAt: base + i * 60 * 60_000, plannedMinutes: m }),
  );
  assert.equal(stats(notMirrored).mirrorDays, 0);
});

test("the palindrome achievement needs three digits", () => {
  const palindrome = ACHIEVEMENTS.find((a) => a.id === "hid-palindrome")!;
  assert.equal(palindrome.check({ sessions: 22 } as never), false);
  assert.equal(palindrome.check({ sessions: 121 } as never), true);
  assert.equal(palindrome.check({ sessions: 123 } as never), false);
});

test("Not Found needs exactly 404, not merely more", () => {
  const notFound = ACHIEVEMENTS.find((a) => a.id === "hid-404")!;
  assert.equal(notFound.check({ sessions: 404 } as never), true);
  assert.equal(notFound.check({ sessions: 405 } as never), false);
});

test("Every Last Second needs both pauses and the whole five minutes", () => {
  const at = bangkok("2026-09-05T10:00:00");
  assert.equal(
    stats([session({ startedAt: at, pauseCount: 2, pausedMs: 5 * 60_000 })])
      .fullPauseBudgetCompletions,
    1,
  );
  assert.equal(
    stats([session({ startedAt: at, pauseCount: 1, pausedMs: 5 * 60_000 })])
      .fullPauseBudgetCompletions,
    0,
  );
});

test("Cold Open fires only in the first minute after the 4am rollover", () => {
  assert.equal(stats([session({ startedAt: bangkok("2026-09-05T04:00:30") })]).coldOpens, 1);
  assert.equal(stats([session({ startedAt: bangkok("2026-09-05T04:01:00") })]).coldOpens, 0);
});

test("a day's sessions bucket by the 4am game day, not the calendar day", () => {
  // 1am on the 6th belongs to the 5th, so these are one day of two sessions.
  const s = stats([
    session({ startedAt: bangkok("2026-09-05T22:00:00") }),
    session({ startedAt: bangkok("2026-09-06T01:00:00") }),
  ]);
  assert.equal(s.days.length, 1);
  assert.equal(s.maxSessionsInDay, 2);
});

test("the birthday achievement reads only the month and day", () => {
  const s = stats([session({ startedAt: bangkok("2026-09-05T10:00:00") })], {
    birthday: "1990-09-05",
  });
  assert.equal(s.birthdayWorked, true);
});

test("abandoned sessions never count toward volume", () => {
  const s = stats([
    session({ startedAt: bangkok("2026-09-05T10:00:00"), status: "abandoned" }),
  ]);
  assert.equal(s.sessions, 0);
  assert.equal(s.abandons, 1);
});

test("same-day recovery needs the abandon to come first", () => {
  const morning = bangkok("2026-09-05T09:00:00");
  const recovered = stats([
    session({ startedAt: morning, status: "abandoned" }),
    session({ startedAt: morning + 2 * 60 * 60_000 }),
  ]);
  assert.equal(recovered.sameDayRecoveries, 1);

  const gaveUpAfter = stats([
    session({ startedAt: morning }),
    session({ startedAt: morning + 2 * 60 * 60_000, status: "abandoned" }),
  ]);
  assert.equal(gaveUpAfter.sameDayRecoveries, 0);
});

test("progress reports each family", () => {
  const p = progressOf(new Set(["vol-first", "vol-10"]));
  assert.equal(p.unlockedCount, 2);
  assert.equal(p.total, 131);
  assert.equal(p.perFamily.volume.unlocked, 2);
  assert.equal(p.perFamily.volume.total, 14);
});
