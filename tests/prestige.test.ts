import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ETERNAL_RECURRENCE,
  MAX_STARS,
  PRESTIGE_LEVEL,
  applyBonus,
  bonusPercent,
  decorateTitle,
  hasEternalRecurrence,
  prestigeOffer,
  xpMultiplier,
  type PrestigeState,
} from "../src/lib/prestige.ts";

const state = (over: Partial<PrestigeState> = {}): PrestigeState => ({
  stars: 0,
  cycleStartedAt: 0,
  reachedFiftyAt: null,
  declinedAt: null,
  ...over,
});

test("the gate is level 50, where Sage V sits", () => {
  assert.equal(PRESTIGE_LEVEL, 50);
  assert.deepEqual(prestigeOffer(49, state()), { available: false, reason: "below_gate" });
  assert.equal(prestigeOffer(50, state()).available, true);
});

test("pressing on is remembered, so the app stops asking", () => {
  assert.deepEqual(prestigeOffer(60, state({ declinedAt: 1 })), {
    available: false,
    reason: "already_decided",
  });
});

test("each star pays five per cent, capped at fifty", () => {
  assert.equal(bonusPercent(0), 0);
  assert.equal(bonusPercent(1), 5);
  assert.equal(bonusPercent(5), 25);
  assert.equal(bonusPercent(10), 50);
  assert.equal(bonusPercent(20), 50, "the cap holds past ten stars");
  assert.equal(xpMultiplier(3), 1.15);
});

test("the bonus is applied to session XP and rounded", () => {
  assert.equal(applyBonus(60, 0), 60);
  assert.equal(applyBonus(60, 1), 63);
  assert.equal(applyBonus(60, 10), 90);
  assert.equal(applyBonus(25, 1), 26);
});

test("the star only shows once it has been earned", () => {
  assert.equal(decorateTitle("Adept II", 0), "Adept II");
  assert.equal(decorateTitle("Adept II", 3), "★3 Adept II");
});

test("stars stop at ten, and ten unlocks the exclusive title", () => {
  assert.equal(MAX_STARS, 10);
  const at9 = prestigeOffer(50, state({ stars: 9 }));
  assert.equal(at9.available && at9.starsAfter, 10);
  const at10 = prestigeOffer(50, state({ stars: 10 }));
  assert.equal(at10.available && at10.starsAfter, 10, "stars do not go past ten");
  assert.equal(hasEternalRecurrence(9), false);
  assert.equal(hasEternalRecurrence(10), true);
  assert.equal(ETERNAL_RECURRENCE, "Eternal Recurrence");
});
