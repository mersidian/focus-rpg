import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  dayRange,
  daysBetween,
  gameDay,
  quarterOf,
  weekdayOf,
} from "../src/lib/game-day.ts";

const TZ = "Asia/Bangkok"; // UTC+7, no daylight saving

/** Build an instant from a local Bangkok wall-clock time. */
function bangkok(iso: string): number {
  return Date.parse(`${iso}+07:00`);
}

test("a mid-afternoon session belongs to that calendar day", () => {
  assert.equal(gameDay(bangkok("2026-09-06T15:00:00"), TZ), "2026-09-06");
});

test("a 1am session counts toward the day before, as the spec asks", () => {
  assert.equal(gameDay(bangkok("2026-09-07T01:00:00"), TZ), "2026-09-06");
});

test("the day turns over at 4am, not midnight", () => {
  assert.equal(gameDay(bangkok("2026-09-07T03:59:59"), TZ), "2026-09-06");
  assert.equal(gameDay(bangkok("2026-09-07T04:00:00"), TZ), "2026-09-07");
});

test("midnight belongs to the day that just ended", () => {
  assert.equal(gameDay(bangkok("2026-09-07T00:00:00"), TZ), "2026-09-06");
});

test("the timezone decides the day, not the server's UTC clock", () => {
  // 22:00 UTC on the 6th is 05:00 Bangkok on the 7th — already a new game day.
  const instant = Date.parse("2026-09-06T22:00:00Z");
  assert.equal(gameDay(instant, TZ), "2026-09-07");
  assert.equal(gameDay(instant, "UTC"), "2026-09-06");
});

test("day arithmetic crosses months and years", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
});

test("days between is signed and counts whole days", () => {
  assert.equal(daysBetween("2026-09-06", "2026-09-13"), 7);
  assert.equal(daysBetween("2026-09-13", "2026-09-06"), -7);
  assert.equal(daysBetween("2026-09-06", "2026-09-06"), 0);
});

test("weekdays match Date.getDay", () => {
  assert.equal(weekdayOf("2026-09-06"), 0); // a Sunday
  assert.equal(weekdayOf("2026-09-07"), 1);
});

test("a day range is inclusive at both ends", () => {
  assert.deepEqual(dayRange("2026-09-06", "2026-09-08"), [
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
  ]);
  assert.deepEqual(dayRange("2026-09-06", "2026-09-06"), ["2026-09-06"]);
  assert.deepEqual(dayRange("2026-09-07", "2026-09-06"), []);
});

test("quarters are calendar quarters", () => {
  assert.equal(quarterOf("2026-01-01"), "2026-Q1");
  assert.equal(quarterOf("2026-03-31"), "2026-Q1");
  assert.equal(quarterOf("2026-04-01"), "2026-Q2");
  assert.equal(quarterOf("2026-09-06"), "2026-Q3");
  assert.equal(quarterOf("2026-12-31"), "2026-Q4");
});
