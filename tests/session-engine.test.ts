import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPause,
  evaluate,
  focusedMs,
  pauseBudgetLeftMs,
  pausedMsUsed,
  type EngineSession,
} from "../src/lib/session-engine.ts";
import {
  ABANDON_REASON_LABEL,
  ABANDON_XP_PENALTY,
  abandonIsAFailure,
  abandonCounts,
  COUNTED_ABANDONS,
  abandonPenalty,
  type AbandonReason,
} from "../src/lib/constants.ts";

const REASONS = Object.keys(ABANDON_REASON_LABEL) as AbandonReason[];

const MIN = 60_000;
const T0 = 1_700_000_000_000;

function session(over: Partial<EngineSession> = {}): EngineSession {
  return {
    plannedMinutes: 25,
    ruleset: "desktop",
    status: "active",
    startedAt: T0,
    pausedAt: null,
    pausedMs: 0,
    pauseCount: 0,
    ...over,
  };
}

test("a running session counts down from wall-clock start", () => {
  const s = session({});
  const v = evaluate(s, T0 + 10 * MIN);
  assert.equal(v.kind, "running");
  assert.equal(v.kind === "running" && v.remainingMs, 15 * MIN);
});

test("it completes once the planned minutes have passed", () => {
  const s = session({});
  const v = evaluate(s, T0 + 25 * MIN);
  assert.equal(v.kind, "complete");
  assert.equal(v.kind === "complete" && v.at, T0 + 25 * MIN);
});

test("paused time pushes the finish line out but pays the same", () => {
  const s = session({ pausedMs: 3 * MIN});
  assert.equal(evaluate(s, T0 + 27 * MIN).kind, "running");
  assert.equal(evaluate(s, T0 + 28 * MIN).kind, "complete");
  assert.equal(focusedMs(s, T0 + 27 * MIN), 24 * MIN);
});

/*
 * The author's rule: "remove cron and no heartbeat anymore. my internet
 * connection sometimes not stable." Silence never ends a session now.
 */
test("a desktop page silent for as long as you like does not end the session", () => {
  const s = session();
  assert.equal(evaluate(s, T0 + 7 * MIN).kind, "running", "two minutes of silence ended it");
  assert.equal(evaluate(s, T0 + 24 * MIN).kind, "running");
});

test("a session nobody watched still finishes on time", () => {
  const v = evaluate(session(), T0 + 60 * MIN);
  assert.equal(v.kind, "complete");
  assert.equal(v.kind === "complete" && v.at, T0 + 25 * MIN);
});

test("desktop and phone sessions follow the same rule", () => {
  for (const at of [T0 + 7 * MIN, T0 + 25 * MIN, T0 + 90 * MIN]) {
    assert.deepEqual(
      evaluate(session({ ruleset: "desktop" }), at),
      evaluate(session({ ruleset: "mobile" }), at),
    );
  }
});

test("a phone session runs to its end", () => {
  const s = session({ ruleset: "mobile"});
  assert.equal(evaluate(s, T0 + 20 * MIN).kind, "running");
  assert.equal(evaluate(s, T0 + 25 * MIN).kind, "complete");
});

test("a tab closed after the timer ran out completes at the end", () => {
  // Last ping at minute 25.5; the session was already over at minute 25.
  const s = session({});
  const v = evaluate(s, T0 + 60 * MIN);
  assert.equal(v.kind, "complete");
  assert.equal(v.kind === "complete" && v.at, T0 + 25 * MIN);
});

test("a paused session stays paused while the page is gone", () => {
  const s = session({
    status: "paused",
    pausedAt: T0 + 5 * MIN,
    pauseCount: 1,
  });
  assert.equal(evaluate(s, T0 + 9 * MIN).kind, "paused");
});

test("running out of pause time restarts the clock", () => {
  /*
   * It used to abandon here, at −30 XP and the loss of everything focused so
   * far, so a six-minute break cost more than never having started. The budget
   * is a budget: it runs out, and the session is running again.
   *
   * Two minutes already spent, so the remaining three run out at T0+8.
   */
  const s = session({
    status: "paused",
    pausedAt: T0 + 5 * MIN,
    pausedMs: 2 * MIN,
    pauseCount: 2,
  });
  assert.equal(evaluate(s, T0 + 7.9 * MIN).kind, "paused");

  const v = evaluate(s, T0 + 8.1 * MIN);
  assert.equal(v.kind, "running");
  assert.equal(v.kind === "running" && v.resumedAt, T0 + 8 * MIN);
});

test("the pause budget is spent, never overspent", () => {
  // The whole cost of overrunning: the session finishes five minutes later than
  // it would have, and not a millisecond more however long the pause sat there.
  const s = session({ status: "paused", pausedAt: T0 + 1 * MIN, pausedMs: 0, pauseCount: 1 });
  assert.equal(pausedMsUsed(s, T0 + 3 * MIN), 2 * MIN);
  assert.equal(pausedMsUsed(s, T0 + 90 * MIN), 5 * MIN);

  // 25 minutes of focus plus the five it may bank, whenever anybody looks.
  const fresh = session({
    status: "paused",
    pausedAt: T0 + 1 * MIN,
    pausedMs: 0,
    pauseCount: 1,
  });
  const v = evaluate(fresh, T0 + 20 * MIN);
  assert.equal(v.kind === "running" && v.completeAt, T0 + 30 * MIN);
  assert.equal(focusedMs(fresh, T0 + 20 * MIN), 15 * MIN);
});

test("a pause left until the session would have finished completes it", () => {
  // The clock has been running since the budget ran out, so one pass resumes
  // and settles: nobody has to come back and press Resume to be paid.
  const s = session({
    status: "paused",
    pausedAt: T0 + 1 * MIN,
    pausedMs: 0,
    pauseCount: 1,
  });
  const v = evaluate(s, T0 + 31 * MIN);
  assert.equal(v.kind, "complete");
  assert.equal(v.kind === "complete" && v.at, T0 + 30 * MIN);
});

test("a third pause is refused", () => {
  assert.deepEqual(canPause(session({ pauseCount: 1 })), { ok: true });
  assert.deepEqual(canPause(session({ pauseCount: 2 })), {
    ok: false,
    reason: "pause_count",
  });
});

test("pausing is refused once the five minutes are spent", () => {
  assert.deepEqual(canPause(session({ pauseCount: 1, pausedMs: 5 * MIN })), {
    ok: false,
    reason: "pause_budget",
  });
});

test("the pause budget counts the pause currently running", () => {
  const s = session({ status: "paused", pausedAt: T0, pausedMs: 60_000 });
  assert.equal(pauseBudgetLeftMs(s, T0 + 60_000), 3 * MIN);
});

test("settled sessions are left alone", () => {
  assert.equal(evaluate(session({ status: "awaiting_report" }), T0 + MIN).kind, "settled");
  assert.equal(evaluate(session({ status: "completed" }), T0 + MIN).kind, "settled");
  assert.equal(evaluate(session({ status: "abandoned" }), T0 + MIN).kind, "settled");
});

/* -------------------------------------------------------------------------- */
/*  What an abandon costs, and who decided it                                  */
/* -------------------------------------------------------------------------- */

test("an old lost-heartbeat abandon counts until it is cleared as a dropped connection", () => {
  /*
   * Nothing writes `heartbeat_lost` now that there is no heartbeat, but rows
   * from before still carry it, and the author's rule for them stands: "if i
   * lost heartbeat is abandon. unless lost connection and can make request to
   * change that is not my fault."
   */
  assert.equal(abandonPenalty("gave_up"), ABANDON_XP_PENALTY);
  assert.equal(abandonPenalty("superseded"), ABANDON_XP_PENALTY);
  assert.equal(abandonPenalty("heartbeat_lost"), ABANDON_XP_PENALTY);
  assert.equal(abandonIsAFailure("heartbeat_lost"), true, "a lost page is a start not finished");
  assert.equal(abandonPenalty("connection_lost"), 0);
  assert.equal(abandonIsAFailure("connection_lost"), false, "a dropped connection still counts");
  // Old labels a pause used to write; nothing produces them now.
  assert.equal(abandonPenalty("pause_budget"), 0);
  assert.equal(abandonPenalty("pause_count"), 0);
});

test("the SQL list of counted abandons is the rule's own list", () => {
  for (const reason of REASONS) {
    assert.equal(
      (COUNTED_ABANDONS as readonly string[]).includes(reason),
      abandonCounts(reason),
      `${reason} is counted in SQL and not in code, or the other way`,
    );
  }
});

test("charged, counted and streak-breaking are one question asked once", () => {
  // A free abandon that still broke a streak, or still dragged the completion
  // ratio down, would be the same punishment wearing a different name.
  for (const reason of REASONS) {
    assert.equal(
      abandonIsAFailure(reason),
      abandonPenalty(reason) > 0,
      `${reason} is charged and counted inconsistently`,
    );
    assert.equal(abandonIsAFailure(reason), abandonCounts(reason));
  }
});

test("every abandon reason has a label that does not accuse anyone", () => {
  // The log prints these. "Page went away for over two minutes" described a
  // decision the user had not made, next to a number it had cost them.
  for (const reason of REASONS) {
    const label = ABANDON_REASON_LABEL[reason];
    assert.ok(label && label.length > 0, `${reason} has no label`);
  }
  assert.ok(
    !ABANDON_REASON_LABEL.heartbeat_lost.includes("went away"),
    "the lost-heartbeat label still says the user left",
  );
});

test("every SQL that counts abandons counts the same ones", async () => {
  /*
   * Four queries spell the list as SQL rather than reading the constant, and a
   * rule changed in one place and not another survives until the next rebuild.
   * The streak walk, the dashboard and db:recompute all have to agree.
   */
  const { readFile } = await import("node:fs/promises");
  const list = `(${COUNTED_ABANDONS.map((r) => `'${r}'`).join(", ")})`;
  for (const file of [
    "src/lib/streak-service.ts",
    "src/lib/project-service.ts",
    "scripts/recompute-state.mjs",
  ]) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const lists = text.match(/abandon_reason\}?\s+in\s+\([^)]*\)/g) ?? [];
    assert.ok(lists.length > 0, `${file} no longer filters abandons by reason`);
    for (const found of lists) {
      assert.ok(found.endsWith(list), `${file} counts ${found}, not ${list}`);
    }
  }
});
