/** Boundary and repeat-invocation cases, where the quiet bugs live. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, dayRange, gameDay, quarterOf } from "../src/lib/game-day.ts";
import {
  FREEZE_CAP,
  accrueMeter,
  creditDay,
  emptyState,
  grantFreeze,
  walkDays,
  type DayActivity,
  type StreakState,
} from "../src/lib/streak-engine.ts";
import { LEVEL_XP, describeLevel, levelForXp } from "../src/lib/levels.ts";
import { applyBonus, prestigeOffer, xpMultiplier } from "../src/lib/prestige.ts";
import { rankProject } from "../src/lib/projects.ts";
import {
  canPause,
  evaluate,
  focusedMs,
  requiredMs,
  type EngineSession,
} from "../src/lib/session-engine.ts";

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

/* ------------------------------------------------------- idempotency */

test("re-walking the same days changes nothing the second time", () => {
  const activity = { "2026-09-01": worked, "2026-09-03": worked };
  const first = walk("2026-09-01", "2026-09-04", activity, { freezes: 2 });

  // Replaying with the ledger's verdicts in hand must change nothing.
  const ledger = new Map(first.verdicts.map((v) => [v.day, v.state]));
  const second = walkDays({
    days: dayRange("2026-09-01", "2026-09-04"),
    activity: (d) => activity[d as keyof typeof activity],
    restWeekdays: [],
    isVacation: () => false,
    state: first.state,
    judged: (d) => ledger.get(d),
  });

  assert.equal(second.state.streak, first.state.streak, "the streak did not move");
  assert.equal(second.state.freezes, first.state.freezes, "no freeze was spent twice");
  assert.deepEqual(
    second.verdicts.map((v) => v.state),
    first.verdicts.map((v) => v.state),
    "every day kept its verdict",
  );
});

test("without the ledger, a replay would wrongly break a frozen streak", () => {
  // Guards the reason `judged` exists: with the bank now empty, re-deciding a
  // day that a freeze already covered turns it into a gap.
  const activity = { "2026-09-01": worked, "2026-09-03": worked };
  const first = walk("2026-09-01", "2026-09-04", activity, { freezes: 2 });
  const replayed = walkDays({
    days: dayRange("2026-09-01", "2026-09-04"),
    activity: (d) => activity[d as keyof typeof activity],
    restWeekdays: [],
    isVacation: () => false,
    state: first.state,
  });
  assert.equal(replayed.state.streak, 0);
  assert.notEqual(replayed.state.streak, first.state.streak);
});

test("a day already counted cannot be counted again by a later walk", () => {
  const counted = creditDay(emptyState(), "2026-09-03");
  const { state } = walk(
    "2026-09-01",
    "2026-09-03",
    { "2026-09-01": worked, "2026-09-02": worked, "2026-09-03": worked },
    counted,
  );
  assert.equal(state.streak, 1, "only the two uncounted days were behind it");
  assert.equal(state.lastCountedDay, "2026-09-03");
});

/* ---------------------------------------------------------- boundaries */

test("a rest day you actually worked counts as worked", () => {
  // 2026-09-06 is a Sunday, marked as rest.
  const { verdicts, state } = walk(
    "2026-09-06",
    "2026-09-06",
    { "2026-09-06": worked },
    {},
    [0],
  );
  assert.equal(verdicts[0].state, "active");
  assert.equal(state.streak, 1, "resting is permission, not a prohibition");
});

test("a rest day inside a vacation costs nothing twice", () => {
  const { state, verdicts } = walk(
    "2026-09-06",
    "2026-09-06",
    {},
    { freezes: 3 },
    [0],
    ["2026-09-06"],
  );
  assert.equal(verdicts[0].state, "vacation");
  assert.equal(state.freezes, 3);
});

test("a freeze granted at exactly the cap queues rather than vanishing", () => {
  const atCap = { ...emptyState(), freezes: FREEZE_CAP - 1 };
  const one = grantFreeze(atCap, 1);
  assert.equal(one.freezes, FREEZE_CAP);
  assert.equal(one.pendingFreezes, 0, "the last slot is filled, not queued");

  const two = grantFreeze(one, 1);
  assert.equal(two.freezes, FREEZE_CAP);
  assert.equal(two.pendingFreezes, 1, "past the cap it queues");
});

test("the meter converts the instant a slot opens, not a day later", () => {
  const full: StreakState = { ...emptyState(), freezes: FREEZE_CAP };
  const charged = accrueMeter(full, 1500); // exactly 300 FP retained at cap
  const afterSpend = walk("2026-09-01", "2026-09-01", {}, charged);
  assert.equal(afterSpend.state.freezes, FREEZE_CAP, "spent one, converted one");
  assert.equal(afterSpend.state.meter, 0);
});

test("the last freeze is spent before the streak breaks, never after", () => {
  const { verdicts, state } = walk("2026-09-01", "2026-09-02", {}, { freezes: 1, streak: 9 });
  assert.deepEqual(verdicts.map((v) => v.state), ["frozen", "gap"]);
  assert.equal(state.streak, 0);
});

/* ------------------------------------------------------------- levels */

test("every level threshold is reached at exactly its XP, not one over", () => {
  for (let level = 1; level <= 100; level++) {
    assert.equal(levelForXp(LEVEL_XP[level - 1]), level, `level ${level}`);
    if (level > 1) {
      assert.equal(levelForXp(LEVEL_XP[level - 1] - 1), level - 1, `just below ${level}`);
    }
  }
});

test("describeLevel never throws outside the ladder", () => {
  assert.equal(describeLevel(0).fullTitle, "Drifter I");
  assert.equal(describeLevel(9999).fullTitle, "Mythic V");
  assert.equal(describeLevel(-5).fullTitle, "Drifter I");
});

/* ----------------------------------------------------------- prestige */

test("ten cycles of prestige stop adding bonus but never break", () => {
  let stars = 0;
  for (let i = 0; i < 15; i++) {
    const offer = prestigeOffer(50, {
      stars,
      cycleStartedAt: 0,
      reachedFiftyAt: null,
      declinedAt: null,
    });
    assert.equal(offer.available, true, `cycle ${i + 1} is still offered`);
    stars = offer.available ? offer.starsAfter : stars;
  }
  assert.equal(stars, 10);
  assert.equal(xpMultiplier(stars), 1.5);
});

test("the bonus never turns a 15-minute session into a 50-minute one", () => {
  assert.ok(applyBonus(15, 10) < 25, "a boosted fifteen is still worth less than a plain 25");
});

/* ----------------------------------------------------------- projects */

test("a project's rank never goes backwards as hours accumulate", () => {
  let previous = 0;
  for (let h = 0; h <= 600; h += 1) {
    const index = rankProject(h * 3_600_000).index;
    assert.ok(index >= previous, `rank fell at ${h} h`);
    previous = index;
  }
});

/* --------------------------------------------------------- game days */

test("the game day is stable across a year boundary", () => {
  assert.equal(gameDay(Date.parse("2027-01-01T02:00:00+07:00"), "Asia/Bangkok"), "2026-12-31");
  assert.equal(gameDay(Date.parse("2027-01-01T05:00:00+07:00"), "Asia/Bangkok"), "2027-01-01");
});

test("quarters do not drift across a year boundary", () => {
  assert.equal(quarterOf("2026-12-31"), "2026-Q4");
  assert.equal(quarterOf(addDays("2026-12-31", 1)), "2027-Q1");
});

/* ----------------------------------------------------- session engine */

test("a zero-length gap between heartbeat and completion still completes", () => {
  const T0 = 1_700_000_000_000;
  const session: EngineSession = {
    plannedMinutes: 25,
    ruleset: "desktop",
    status: "active",
    startedAt: T0,
    pausedAt: null,
    pausedMs: 0,
    pauseCount: 0,
    // The last ping lands exactly two minutes before the end: the abandon
    // moment and the completion moment coincide.
    lastHeartbeatAt: T0 + requiredMs(25) - 2 * 60_000,
  };
  const verdict = evaluate(session, T0 + requiredMs(25) + 1000);
  assert.equal(verdict.kind, "complete", "a tie must go to completion");
});

/* ------------------------------------------- session engine, harder cases */

const T = 1_700_000_000_000;
function sess(over: Partial<EngineSession> = {}): EngineSession {
  return {
    plannedMinutes: 25,
    ruleset: "desktop",
    status: "active",
    startedAt: T,
    pausedAt: null,
    pausedMs: 0,
    pauseCount: 0,
    lastHeartbeatAt: T,
    ...over,
  };
}

test("a paused session cannot complete while it is paused", () => {
  // Paused at minute 24 and left there past the nominal finish.
  const paused = sess({
    status: "paused",
    pausedAt: T + 24 * 60_000,
    pauseCount: 1,
    lastHeartbeatAt: T + 24 * 60_000,
  });
  const verdict = evaluate(paused, T + 27 * 60_000);
  assert.equal(verdict.kind, "paused", "time spent paused is not focused time");
  assert.equal(verdict.kind === "paused" && verdict.remainingMs, 60_000);
});

test("pausing pushes the finish line out by exactly the pause", () => {
  const resumed = sess({ pausedMs: 3 * 60_000, lastHeartbeatAt: T + 28 * 60_000 });
  assert.equal(evaluate(resumed, T + 27.9 * 60_000).kind, "running");
  assert.equal(evaluate(resumed, T + 28 * 60_000).kind, "complete");
});

test("focused time never exceeds the session that was planned", () => {
  const overrun = sess({ lastHeartbeatAt: T + 100 * 60_000 });
  const verdict = evaluate(overrun, T + 100 * 60_000);
  assert.equal(verdict.kind, "complete");
  assert.equal(focusedMs(overrun, T + 100 * 60_000), requiredMs(25));
});

test("a mobile session left paused still blows its budget", () => {
  const paused = sess({
    ruleset: "mobile",
    status: "paused",
    pausedAt: T,
    pauseCount: 1,
    lastHeartbeatAt: T,
  });
  const verdict = evaluate(paused, T + 6 * 60_000);
  assert.equal(verdict.kind, "abandon");
  assert.equal(verdict.kind === "abandon" && verdict.reason, "pause_budget");
});

test("a heartbeat from a clock running fast does not abandon early", () => {
  const skewed = sess({ lastHeartbeatAt: T + 60 * 60_000 });
  assert.equal(evaluate(skewed, T + 5 * 60_000).kind, "running");
});

test("a session paused twice for five minutes in total is at its limit", () => {
  const spent = sess({ pauseCount: 2, pausedMs: 5 * 60_000 });
  assert.deepEqual(canPause(spent), { ok: false, reason: "pause_count" });
  const oncePaused = sess({ pauseCount: 1, pausedMs: 5 * 60_000 });
  assert.deepEqual(canPause(oncePaused), { ok: false, reason: "pause_budget" });
});
