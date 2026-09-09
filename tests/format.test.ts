import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCENT_FLOOR,
  ACCENT_RANGE,
  ACTION_FLOOR,
  accentChroma,
  tierAccent,
  tierAction,
} from "../src/lib/format.ts";
import { TIERS } from "../src/lib/levels.ts";

/**
 * §8: "hierarchy is carried by tier colour… a Drifter's app is nearly
 * colourless… nothing else on the page may be saturated."
 *
 * Two sentences that pull against each other, and the code used to resolve them
 * by honouring only the second: at intensity 0.10 the accent came out at chroma
 * 0.036, against --color-dim's 0.021. So these are written from the wording and
 * are free to disagree with the implementation.
 */

/** Pull the chroma back out of an oklch() string. */
function chromaOf(color: string): number {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(color);
  assert.ok(m, `not a plain oklch colour: ${color}`);
  return Number(m[2]);
}

const DIM_CHROMA = 0.021;

test("the decorative accent is a colour at every tier, not just the top ones", () => {
  for (const tier of TIERS) {
    const c = chromaOf(tierAccent(tier.hue, tier.intensity));
    assert.ok(
      c > DIM_CHROMA * 2,
      `${tier.title} draws at chroma ${c}, which is grey next to --color-dim`,
    );
  }
});

test("the accent still grows across the whole ladder", () => {
  // "Nearly colourless" at the bottom only means anything if the top is not.
  const ladder = TIERS.map((t) => accentChroma(t.intensity));
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(
      ladder[i] >= ladder[i - 1],
      `${TIERS[i].title} is less saturated than ${TIERS[i - 1].title}`,
    );
  }
  assert.ok(
    ladder[ladder.length - 1] > ladder[0] * 2.5,
    "the top of the ladder does not burn any brighter than the bottom",
  );
});

test("a control is legible before it is earned", () => {
  // The Start button, the focus ring and a chosen chip all draw in --action.
  for (const tier of TIERS) {
    const c = chromaOf(tierAction(tier.hue, tier.intensity));
    assert.ok(
      c >= ACTION_FLOOR,
      `${tier.title}'s controls draw at chroma ${c}, below the floor`,
    );
  }
});

test("the functional accent never becomes a second, louder palette", () => {
  for (const tier of TIERS) {
    const decorative = chromaOf(tierAccent(tier.hue, tier.intensity));
    const functional = chromaOf(tierAction(tier.hue, tier.intensity));
    assert.ok(
      functional <= Math.max(ACTION_FLOOR, decorative) + 1e-9,
      `${tier.title}'s controls out-colour the rank itself`,
    );
  }
  // Past the point where the floor stops biting they are the same colour, so
  // there is only ever one accent on screen.
  const high = TIERS.filter((t) => accentChroma(t.intensity) >= ACTION_FLOOR);
  assert.ok(high.length > 0, "the floor bites for the entire ladder");
  for (const tier of high) {
    assert.equal(
      tierAction(tier.hue, tier.intensity),
      tierAccent(tier.hue, tier.intensity),
      `${tier.title} has two accents at once`,
    );
  }
});

test("the floor bites early and lets go", () => {
  // It exists for the first few tiers. If it reached halfway up the ladder it
  // would be flattening the thing being earned.
  const biting = TIERS.filter((t) => accentChroma(t.intensity) < ACTION_FLOOR);
  assert.ok(biting.length > 0, "the floor never applies, so nothing was fixed");
  assert.ok(
    biting.length <= TIERS.length / 3,
    `the floor overrides ${biting.length} of ${TIERS.length} tiers`,
  );
  assert.equal(biting[0].title, TIERS[0].title, "the floor skips the first tier");
});

test("nothing else on the page is more saturated than what a beginner earns", () => {
  // The rule, executable. Every fixed colour in the app measured against the
  // quietest accent a control is ever allowed to be.
  const beginner = chromaOf(tierAction(TIERS[0].hue, TIERS[0].intensity));
  const others = {
    "--color-warn": 0.105,
    "--color-ice": 0.04,
    "--color-ice-deep": 0.03,
    "--color-dim": DIM_CHROMA,
    "--color-faint": 0.022,
    "the prestige frame at ten stars": 0.125,
  };
  for (const [name, chroma] of Object.entries(others)) {
    assert.ok(
      chroma <= beginner + 0.02,
      `${name} draws at ${chroma}, louder than the ${beginner} a beginner gets`,
    );
  }
});

test("the accent curve is described by its own constants", () => {
  // A number written in a comment is not a number. If someone retunes the
  // curve, the constants and the output have to move together.
  assert.equal(accentChroma(0), ACCENT_FLOOR);
  assert.equal(accentChroma(1), ACCENT_FLOOR + ACCENT_RANGE);
  assert.equal(chromaOf(tierAccent(250, 0)), Number(ACCENT_FLOOR.toFixed(3)));
});
