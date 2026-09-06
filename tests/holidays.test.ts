import assert from "node:assert/strict";
import { test } from "node:test";
import {
  THAI_HOLIDAYS,
  knownThaiYears,
  lastKnownThaiYear,
  thaiHolidaysFor,
} from "../src/lib/holidays/thailand.ts";
import { gameDay } from "../src/lib/game-day.ts";

test("every date is well-formed and sits in the year that lists it", () => {
  for (const [year, days] of Object.entries(THAI_HOLIDAYS)) {
    for (const holiday of days) {
      assert.match(holiday.date, /^\d{4}-\d{2}-\d{2}$/, holiday.name);
      assert.equal(holiday.date.slice(0, 4), year, `${holiday.name} is filed under ${year}`);
      assert.ok(!Number.isNaN(Date.parse(`${holiday.date}T12:00:00Z`)), holiday.date);
      assert.ok(holiday.name.length > 0);
    }
  }
});

test("no year lists the same date twice", () => {
  for (const [year, days] of Object.entries(THAI_HOLIDAYS)) {
    const dates = days.map((d) => d.date);
    assert.equal(new Set(dates).size, dates.length, `${year} has a duplicate`);
  }
});

test("each year's dates are in order", () => {
  for (const [year, days] of Object.entries(THAI_HOLIDAYS)) {
    const dates = days.map((d) => d.date);
    assert.deepEqual(dates, [...dates].sort(), `${year} is out of order`);
  }
});

test("the fixed-date holidays appear in every year covered", () => {
  // These never move, so their absence would mean a transcription slip.
  const fixed = ["01-01", "04-06", "04-13", "05-04", "06-03", "08-12", "12-10", "12-31"];
  for (const year of knownThaiYears()) {
    const suffixes = new Set(thaiHolidaysFor(year).map((h) => h.date.slice(5)));
    for (const day of fixed) {
      assert.ok(suffixes.has(day), `${year} is missing ${day}`);
    }
  }
});

test("Songkran is three days in every year covered", () => {
  for (const year of knownThaiYears()) {
    const songkran = thaiHolidaysFor(year).filter((h) => h.name === "Songkran");
    assert.equal(songkran.length, 3, `${year}`);
  }
});

test("a year with no table returns nothing rather than a guess", () => {
  assert.deepEqual(thaiHolidaysFor(2035), []);
  assert.ok(lastKnownThaiYear() >= 2027);
});

test("the dates match the game day a session on them would fall in", () => {
  // A holiday is a calendar date; the achievement compares it against a
  // session's local calendar day, so a midday session must land on it.
  const noon = Date.parse("2026-12-10T12:00:00+07:00");
  assert.equal(gameDay(noon, "Asia/Bangkok"), "2026-12-10");
  assert.ok(thaiHolidaysFor(2026).some((h) => h.date === "2026-12-10"));
});
