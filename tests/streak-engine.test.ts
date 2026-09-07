import assert from "node:assert/strict";
import { test } from "node:test";
import { dayRange } from "../src/lib/game-day.ts";
import {
  ABANDONS_THAT_BREAK,
  FREEZE_CAP,
  FREEZE_METER_TARGET,
  FREEZE_PURCHASE_XP,
  accrueMeter,
  creditDay,
  emptyState,
  grantFreeze,
  meterProgress,
  purchaseFreeze,
  walkDays,
  type DayActivity,
  type StreakState,
} from "../src/lib/streak-engine.ts";

const worked: DayActivity = { completed: 1, abandoned: 0 };

function walk(
  from: string,
  to: string,
  activity: Record<string, DayActivity>,
  over: Partial<StreakState> = {},
  restWeekdays: number[] = [],
  vacation: string[] = [],
) {
  const vac = new Set(vacation);
  return walkDays({
    days: dayRange(from, to),
    activity: (d) => activity[d],
    restWeekdays,
    isVacation: (d) => vac.has(d),
    state: { ...emptyState(), ...over },
  });
}

/* ------------------------------------------------------------- the streak */

test("consecutive worked days build the streak", () => {
  const days = dayRange("2026-09-01", "2026-09-03");
  const activity = Object.fromEntries(days.map((d) => [d, worked]));
  const { state, verdicts } = walk("2026-09-01", "2026-09-03", activity);
  assert.equal(state.streak, 3);
  assert.deepEqual(verdicts.map((v) => v.state), ["active", "active", "active"]);
});

test("a missed day with an empty bank ends the streak", () => {
  const { state, verdicts } = walk("2026-09-01", "2026-09-03", {
    "2026-09-01": worked,
    "2026-09-03": worked,
  });
  assert.deepEqual(verdicts.map((v) => v.state), ["active", "gap", "active"]);
  assert.equal(state.streak, 1);
  assert.equal(state.longestStreak, 1);
});

test("one abandon in a day does not cost the streak", () => {
  const { state } = walk("2026-09-01", "2026-09-02", {
    "2026-09-01": worked,
    "2026-09-02": { completed: 1, abandoned: 1 },
  });
  assert.equal(state.streak, 2);
});

test("the second abandon in one day breaks it, even on a worked day", () => {
  const { state, verdicts } = walk("2026-09-01", "2026-09-02", {
    "2026-09-01": worked,
    "2026-09-02": { completed: 1, abandoned: ABANDONS_THAT_BREAK },
  });
  assert.equal(verdicts[1].state, "active");
  assert.equal(verdicts[1].brokeStreak, true);
  assert.equal(state.streak, 0);
});

test("crediting a day is idempotent", () => {
  let s = creditDay(emptyState(), "2026-09-01");
  assert.equal(s.streak, 1);
  s = creditDay(s, "2026-09-01"); // a second session the same day
  assert.equal(s.streak, 1);
  s = creditDay(s, "2026-09-02");
  assert.equal(s.streak, 2);
});

test("a walk cannot re-credit a day already counted today", () => {
  // Today was credited live; tomorrow's walk revisits it as an elapsed day.
  const counted = creditDay(emptyState(), "2026-09-01");
  const { state } = walk("2026-09-01", "2026-09-01", { "2026-09-01": worked }, counted);
  assert.equal(state.streak, 1);
});

/* -------------------------------------------------------------- freezes */

test("five consecutive days pay one freeze", () => {
  const days = dayRange("2026-09-01", "2026-09-10");
  const activity = Object.fromEntries(days.map((d) => [d, worked]));
  const { state } = walk("2026-09-01", "2026-09-05", activity);
  assert.equal(state.freezes, 1);
  const ten = walk("2026-09-01", "2026-09-10", activity);
  assert.equal(ten.state.freezes, 2);
});

test("a banked freeze spends itself on a missed day, with no prompt", () => {
  const { state, verdicts } = walk(
    "2026-09-01",
    "2026-09-03",
    { "2026-09-01": worked, "2026-09-03": worked },
    { freezes: 1, streak: 2 },
  );
  assert.equal(verdicts[1].state, "frozen");
  assert.equal(state.freezes, 0, "the banked freeze was spent");
  assert.equal(state.streak, 4, "the streak survived the frozen day");
});

test("the day the streak reaches five pays for itself", () => {
  // Reaching a multiple of five grants a freeze on that very day, so the bank
  // can end a walk higher than it started even though a day was frozen.
  const { state } = walk(
    "2026-09-01",
    "2026-09-03",
    { "2026-09-01": worked, "2026-09-03": worked },
    { freezes: 1, streak: 4 },
  );
  assert.equal(state.streak, 6);
  assert.equal(state.freezes, 1, "one earned at streak 5, one spent on the gap");
});

test("fourteen banked freezes cover at most fourteen days away", () => {
  const { state, verdicts } = walk("2026-09-01", "2026-09-15", {}, { freezes: FREEZE_CAP });
  assert.equal(verdicts.filter((v) => v.state === "frozen").length, FREEZE_CAP);
  assert.equal(verdicts[14].state, "gap");
  assert.equal(state.freezes, 0);
  assert.equal(state.streak, 0);
});

test("freezes granted at cap queue, then land when the bank drops", () => {
  let s: StreakState = { ...emptyState(), freezes: FREEZE_CAP };
  s = grantFreeze(s, 2);
  assert.equal(s.freezes, FREEZE_CAP);
  assert.equal(s.pendingFreezes, 2, "queued rather than wasted");

  const { state } = walk("2026-09-01", "2026-09-01", {}, s);
  assert.equal(state.freezes, FREEZE_CAP, "one spent, one queued freeze took its place");
  assert.equal(state.pendingFreezes, 1);
});

/* ---------------------------------------------------------- freeze meter */

test("the meter takes twenty per cent of earned XP", () => {
  const s = accrueMeter(emptyState(), 60);
  assert.equal(s.meter, 12 * 100, "60 XP gives 12 FP");
  assert.equal(meterProgress(s), 0.04);
});

test("penalties do not feed the meter", () => {
  assert.equal(accrueMeter(emptyState(), -30).meter, 0);
});

test("three hundred points convert to a freeze", () => {
  const s = accrueMeter(emptyState(), 1500); // 20% of 1500 XP = 300 FP
  assert.equal(s.freezes, 1);
  assert.equal(s.meter, 0);
});

test("at cap the meter keeps its points instead of wasting them", () => {
  const full: StreakState = { ...emptyState(), freezes: FREEZE_CAP };
  const s = accrueMeter(full, 1500);
  assert.equal(s.freezes, FREEZE_CAP);
  assert.equal(s.meter, FREEZE_METER_TARGET, "the points are retained, not burned");

  // Once a freeze is spent, the retained points convert.
  const after = walk("2026-09-01", "2026-09-01", {}, s);
  assert.equal(after.state.freezes, FREEZE_CAP);
  assert.equal(after.state.meter, 0);
});

/* ------------------------------------------------------------- purchase */

test("a freeze costs four hundred XP", () => {
  const result = purchaseFreeze(emptyState(), 400);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.xpSpent, FREEZE_PURCHASE_XP);
  assert.equal(result.ok && result.state.freezes, 1);
});

test("buying is refused without the XP, or at cap", () => {
  assert.deepEqual(purchaseFreeze(emptyState(), 399), {
    ok: false,
    reason: "not_enough_xp",
  });
  assert.deepEqual(purchaseFreeze({ ...emptyState(), freezes: FREEZE_CAP }, 10_000), {
    ok: false,
    reason: "at_cap",
  });
});

/* -------------------------------------------------- rest days and vacation */

test("a rest day neither breaks the streak nor spends a freeze", () => {
  // 2026-09-06 is a Sunday.
  const { state, verdicts } = walk(
    "2026-09-05",
    "2026-09-07",
    { "2026-09-05": worked, "2026-09-07": worked },
    { freezes: 3 },
    [0],
  );
  assert.equal(verdicts[1].state, "rest");
  assert.equal(state.freezes, 3, "no freeze was spent");
  assert.equal(state.streak, 2);
});

test("declared vacation days are greyed, not frozen, and cost nothing", () => {
  const { state, verdicts } = walk(
    "2026-09-01",
    "2026-09-04",
    { "2026-09-01": worked },
    { freezes: 2 },
    [],
    ["2026-09-02", "2026-09-03", "2026-09-04"],
  );
  assert.deepEqual(verdicts.map((v) => v.state), [
    "active",
    "vacation",
    "vacation",
    "vacation",
  ]);
  assert.equal(state.freezes, 2, "vacation costs no freezes");
  assert.equal(state.streak, 1, "and does not break the streak");
});

test("the first undeclared day after a vacation is judged normally", () => {
  const { verdicts } = walk(
    "2026-09-01",
    "2026-09-03",
    { "2026-09-01": worked },
    { freezes: 0 },
    [],
    ["2026-09-02"],
  );
  assert.deepEqual(verdicts.map((v) => v.state), ["active", "vacation", "gap"]);
});

test("working during a declared vacation still counts", () => {
  const { verdicts } = walk(
    "2026-09-01",
    "2026-09-02",
    { "2026-09-01": worked, "2026-09-02": worked },
    {},
    [],
    ["2026-09-02"],
  );
  assert.equal(verdicts[1].state, "active");
});

/* -------------------------------------------------------------- recovery */

test("coming back after three weeks away spends the bank, then breaks", () => {
  const { state, verdicts } = walk(
    "2026-09-01",
    "2026-09-21",
    {},
    { freezes: 5, streak: 30, longestStreak: 30 },
  );
  assert.equal(verdicts.filter((v) => v.state === "frozen").length, 5);
  assert.equal(state.streak, 0);
  assert.equal(state.longestStreak, 30, "the record survives the break");
});

test("the walk records how far it got", () => {
  const { state } = walk("2026-09-01", "2026-09-03", {});
  assert.equal(state.lastEvaluatedDay, "2026-09-03");
});

test("the meter takes its fifth from any earned XP, not only sessions", () => {
  // §7 says "20% of all XP earned". An achievement paying 700 XP is earned XP.
  const fromSession = accrueMeter(emptyState(), 60);
  const fromAchievement = accrueMeter(emptyState(), 60);
  assert.deepEqual(fromAchievement, fromSession, "the meter cannot tell them apart");
  assert.equal(accrueMeter(emptyState(), 700).meter, 140 * 100);
});
