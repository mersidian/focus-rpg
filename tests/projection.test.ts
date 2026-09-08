import assert from "node:assert/strict";
import { test } from "node:test";
import { measurePace, projectNextRank } from "../src/lib/projection.ts";

const daily = (minutes: number[]) =>
  minutes.map((m, i) => ({ day: `2026-08-${String(i + 1).padStart(2, "0")}`, minutes: m }));

test("pace counts the empty days, not only the worked ones", () => {
  // Four days, 100 minutes on two of them: 25 a day, not 50.
  const pace = measurePace(daily([50, 0, 50, 0]));
  assert.equal(pace.minutesPerDay, 25);
  assert.equal(pace.activeDays, 2);
  assert.equal(pace.windowDays, 4);
});

test("the window keeps only the most recent days", () => {
  const pace = measurePace(daily([500, 10, 10]), 2);
  assert.equal(pace.minutesPerDay, 10, "the old spike is outside the window");
  assert.equal(pace.windowDays, 2);
});

test("a projection converts minutes straight into XP", () => {
  const pace = measurePace(daily([60, 60, 60, 60]));
  const p = projectNextRank(600, pace, "2026-09-06");
  assert.equal(p.known, true);
  assert.equal(p.known && p.days, 10);
  assert.equal(p.known && p.date, "2026-09-16");
});

test("the prestige bonus shortens the projection", () => {
  const pace = measurePace(daily([60, 60, 60, 60]));
  const plain = projectNextRank(600, pace, "2026-09-06");
  const starred = projectNextRank(600, pace, "2026-09-06", 1.5);
  assert.equal(plain.known && plain.days, 10);
  assert.equal(starred.known && starred.days, 7);
});

test("no pace means no projection, rather than a fictional one", () => {
  assert.deepEqual(projectNextRank(600, measurePace(daily([0, 0, 0])), "2026-09-06"), {
    known: false,
    reason: "no_pace",
  });
});

test("there is nothing to project at the top of the ladder", () => {
  assert.deepEqual(projectNextRank(null, measurePace(daily([60])), "2026-09-06"), {
    known: false,
    reason: "at_cap",
  });
});

test("days before your first session are not days you missed", () => {
  // Two days of real use at the end of a 28-day series.
  const series = daily([...Array(26).fill(0), 120, 120]);
  const pace = measurePace(series);
  assert.equal(pace.minutesPerDay, 120, "the empty prehistory is not averaged in");
  assert.equal(pace.windowDays, 2);
  assert.equal(pace.activeDays, 2);
});

test("a gap after you have started still counts against you", () => {
  const pace = measurePace(daily([60, 0, 0, 60]));
  assert.equal(pace.minutesPerDay, 30, "the two idle days are real days you missed");
});

test("two days of use is not a pace to project from", () => {
  const p = projectNextRank(600, measurePace(daily([120, 120])), "2026-09-06");
  assert.equal(p.known, false);
  assert.equal(p.known === false && p.reason, "too_early");
  assert.equal(p.known === false && p.activeDays, 2);
});

test("once there is enough history the projection returns", () => {
  const p = projectNextRank(600, measurePace(daily([60, 60, 60, 60, 60])), "2026-09-06");
  assert.equal(p.known, true);
  assert.equal(p.known && p.days, 10);
});
