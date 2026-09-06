import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LEVEL_XP,
  MAX_LEVEL,
  TIERS,
  describeLevel,
  levelForXp,
  rankProgress,
} from "../src/lib/levels.ts";
import { XP_BY_LENGTH } from "../src/lib/constants.ts";

test("the ladder is 100 levels of 20 named tiers", () => {
  assert.equal(MAX_LEVEL, 100);
  assert.equal(TIERS.length, 20);
  assert.equal(LEVEL_XP.length, 100);
});

test("every level costs strictly more than the one below it", () => {
  for (let i = 1; i < LEVEL_XP.length; i++) {
    assert.ok(LEVEL_XP[i] > LEVEL_XP[i - 1], `level ${i + 1} does not cost more than ${i}`);
  }
});

test("each tier's fifth rank lands on the hours the spec gives it", () => {
  TIERS.forEach((tier, k) => {
    assert.equal(
      LEVEL_XP[k * 5 + 4] / 60,
      tier.doneHours,
      `${tier.title} V should sit on ${tier.doneHours} h`,
    );
  });
});

test("the lower ten tiers enter at the hours the spec gives them", () => {
  // Above Sage the spec's "enter at" column restates the previous tier's rank V,
  // which cannot be a second threshold; those tiers are interpolated instead.
  TIERS.slice(0, 10).forEach((tier, k) => {
    assert.equal(LEVEL_XP[k * 5] / 60, tier.enterHours, `${tier.title} I`);
  });
});

test("the two anchors named in the spec's prose hold", () => {
  assert.equal(describeLevel(50).fullTitle, "Sage V");
  assert.equal(LEVEL_XP[49] / 60, 1008);
  assert.equal(describeLevel(100).fullTitle, "Mythic V");
  assert.equal(LEVEL_XP[99] / 60, 10_000);
});

test("Drifter V lands inside a first afternoon", () => {
  assert.equal(LEVEL_XP[4] / 60, 3);
  // Three hours of focus, whichever lengths you pick.
  assert.equal(XP_BY_LENGTH[50] * 3, 180);
});

test("titles read as tier plus rank", () => {
  assert.equal(describeLevel(1).fullTitle, "Drifter I");
  assert.equal(describeLevel(18).fullTitle, "Adept III");
  assert.equal(describeLevel(51).fullTitle, "Ascendant I");
});

test("levels follow XP", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(44), 1);
  assert.equal(levelForXp(45), 2);
  assert.equal(levelForXp(60_480), 50);
  assert.equal(levelForXp(999_999), 100);
});

test("XP never drives the level below 1, even after penalties", () => {
  assert.equal(levelForXp(-500), 1);
});

test("rank progress spans the current rank and pins at the cap", () => {
  assert.equal(rankProgress(LEVEL_XP[1], 2), 0);
  assert.equal(rankProgress(LEVEL_XP[2], 2), 1);
  assert.equal(rankProgress(0, 100), 1);
});

test("a 50-minute session pays the 20% bonus and the others pay flat", () => {
  assert.equal(XP_BY_LENGTH[15], 15);
  assert.equal(XP_BY_LENGTH[25], 25);
  assert.equal(XP_BY_LENGTH[50], 60);
});
