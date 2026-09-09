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

/* -------------------------------------------------------------------------- */
/*  §8: "Fraunces sets the earned title and nothing else, so the name reads    */
/*  as a name."                                                                */
/* -------------------------------------------------------------------------- */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(import.meta.dirname, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * Where the earned face is allowed, and why, one entry per file.
 *
 * It had nineteen call sites and only six were the earned title: the rest were
 * ordinary page headings, and one of them — GameUi's Screen — put Fraunces on
 * all ten game screens at once. A face on every heading cannot mark the one
 * thing that was earned.
 *
 * The class is `.earned` and not `.display` for the same reason this test
 * exists: a class named after a typeface gets reached for whenever someone
 * wants that typeface, and a class named after the rule cannot be used without
 * making the claim.
 */
const EARNED_ALLOWED: Record<string, string> = {
  "components/TimerScreen.tsx": "the earned rank, on the timer",
  "components/LevelUpOverlay.tsx": "the rank as it arrives — the earned title itself",
  "app/character/page.tsx": "the earned rank, on the character sheet",
  "app/streak/page.tsx": "the streak headline, in the earned colour",
  "app/projects/page.tsx": "the biggest project, in the earned colour",
  "app/signin/page.tsx": "the wordmark, on the one screen with no character",
};

test("the earned face marks the earned title and nothing else", () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    /*
     * The class as the first token of a string, which is what every real use
     * looks like and what no English sentence does. Matching the bare word
     * anywhere caught prose ("the earned accent"); matching className= alone
     * missed the wiki, whose heading classes live in a lookup table.
     */
    if (!/["'`]earned[\s"'`]/.test(readFileSync(file, "utf8"))) continue;
    if (!(rel in EARNED_ALLOWED)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    `these wear Fraunces without being the earned title:\n  ${offenders.join("\n  ")}`,
  );
});
