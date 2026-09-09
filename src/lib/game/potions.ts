/**
 * What the potions do (SPEC-V2.md §15.4, Proposal C).
 *
 * §9 budgeted ~360 consumables and defined the effect of not one of them.
 * Alchemy was a full processing skill with a fuel cost and no customer anywhere
 * in the design, and rations were consumed only by failed kills — so a pure
 * gatherer bought nothing, ever. This is the file that fixes that, and it does
 * it in two halves.
 *
 * **Wards** are the entry gate. Six of the thirty lines are wards, and a biome
 * with a hazard will not let you in without one. Binary, named in the
 * greyed-out gate, spent on entry, no RNG — the same shape as every other
 * requirement.
 *
 * **Tonics** are the other twenty-four. One may be drunk with the activity, and
 * its effect folds into the session exactly as an equipped unique's does. That
 * reuse is the reason `effects.ts` is typed rather than a bag of booleans.
 *
 * What the proposal cut stays cut: no graded magnitudes on gear bands, no pace
 * modifier, and no luck effect — luck belongs on trinkets (§7).
 */
import { POTION_EFFECTS, POTION_TIERS } from "./items";
import { BIOMES, type Biome } from "./biomes";
import type { Effect } from "./effects";

/** The six ward lines. A ward has no effect of its own: it is a toll. */
export const WARDS = ["Warded", "Salt Ward", "Rot Ward", "Void Ward", "Kindled", "Still Water"] as const;
export type Ward = (typeof WARDS)[number];

export function isWard(effect: string): effect is Ward {
  return (WARDS as readonly string[]).includes(effect);
}

/**
 * What a tonic does at tier `t` (1–6).
 *
 * Every one is a kind the engine already reads, which is the point: a potion
 * that needed a seventeenth effect kind would be a potion that did nothing.
 */
export function tonicEffect(effect: string, t: number): Effect | null {
  const step = Math.min(Math.max(t, 1), POTION_TIERS);
  const pct = (n: number) => n * step;
  switch (effect) {
    case "Deep Vein":
      return { kind: "yield", pct: pct(5), skill: "mining" };
    case "Rich Seam":
      return { kind: "yield", pct: pct(4), skill: "mining" };
    case "Long Grain":
      return { kind: "yield", pct: pct(5), skill: "woodcutting" };
    case "Full Net":
      return { kind: "yield", pct: pct(5), skill: "fishing" };
    case "Green Hand":
      return { kind: "yield", pct: pct(5), skill: "foraging" };
    case "Clean Kill":
      return { kind: "yield", pct: pct(5), skill: "hunting" };
    case "Careful Dig":
      return { kind: "yield", pct: pct(5), skill: "excavation" };
    case "Fair Weather":
      return { kind: "yield", pct: pct(3) };
    case "Fine Thread":
      return { kind: "yield", pct: pct(3) };

    case "Keen Edge":
    case "Steady Aim":
    case "Sure Shot":
      return { kind: "offence", pct: pct(4) };
    case "Cold Blood":
      return { kind: "offence", pct: pct(3) };

    case "Hard Guard":
    case "Thick Skin":
      return { kind: "defence", pct: pct(5) };

    case "Quick Step":
    case "Deft Hand":
    case "Low Smoke":
      return { kind: "throughput", pct: pct(4) };
    case "Long Wind":
      return { kind: "throughput", pct: pct(3) };

    case "Bright Eye":
    case "Sharp Sense":
      return { kind: "dropRate", pct: pct(3) };

    case "Iron Gut":
      return { kind: "freeRations" };
    case "True Weight":
      return { kind: "freeDurability" };
    case "Coin Sense":
      return { kind: "characterXp", pct: pct(1) };

    default:
      return null;
  }
}

/** Every tonic line, so the wiki and the shop can list what they are for. */
export const TONICS = POTION_EFFECTS.filter((e) => !isWard(e));

/**
 * A biome's hazard, and the ward it demands.
 *
 * The first five biomes have none: an early game that asks for a potion before
 * Alchemy exists is a wall, not a gate. From tier 6 up every biome wants one,
 * grouped by the kind of place it is rather than one ward per biome — six lines
 * covering fifteen biomes keeps the shopping list short enough to remember.
 */
export type Hazard = { ward: Ward; hazard: string; qty: number };

const HAZARDS: Record<number, Hazard> = {
  6: { ward: "Salt Ward", hazard: "brackish water", qty: 1 },
  7: { ward: "Kindled", hazard: "ash and sulphur", qty: 1 },
  8: { ward: "Salt Ward", hazard: "salt spray", qty: 1 },
  9: { ward: "Still Water", hazard: "firedamp", qty: 1 },
  10: { ward: "Warded", hazard: "thorn venom", qty: 1 },
  11: { ward: "Still Water", hazard: "deep cold", qty: 2 },
  12: { ward: "Warded", hazard: "glass dust", qty: 2 },
  13: { ward: "Rot Ward", hazard: "spore bloom", qty: 2 },
  14: { ward: "Warded", hazard: "grave air", qty: 2 },
  15: { ward: "Kindled", hazard: "caldera heat", qty: 2 },
  16: { ward: "Warded", hazard: "storm charge", qty: 2 },
  17: { ward: "Rot Ward", hazard: "miasma", qty: 3 },
  18: { ward: "Still Water", hazard: "manufactured cold", qty: 3 },
  19: { ward: "Void Ward", hazard: "the unmaking", qty: 3 },
  20: { ward: "Void Ward", hazard: "first light", qty: 3 },
};

export function hazardOf(biome: Biome | number): Hazard | null {
  const index = typeof biome === "number" ? biome : biome.index;
  return HAZARDS[index] ?? null;
}

/**
 * The potion tier a biome's ward has to be.
 *
 * Potions come in six tiers sitting at item tiers 1, 5, 9, 13, 17 and 21, so a
 * biome takes the highest step at or below its floor. A tier-1 ward will not see
 * you through Voidscar.
 */
export const POTION_TIER_AT = [1, 5, 9, 13, 17, 21];

export function wardTierFor(biomeTier: number): number {
  let step = 1;
  for (let i = 0; i < POTION_TIER_AT.length; i++) {
    if (biomeTier >= POTION_TIER_AT[i]) step = i + 1;
  }
  return step;
}

/** The item id of a ward at a step, matching the generator in `items.ts`. */
export function wardItemId(ward: Ward, step: number): string {
  return `potion:${ward}:${step}`;
}

/** Which ward items satisfy a requirement: the named line, at that step or above. */
export function acceptableWards(ward: Ward, minStep: number): string[] {
  return POTION_TIER_AT.map((_, i) => i + 1)
    .filter((step) => step >= minStep)
    .map((step) => wardItemId(ward, step));
}

/** Every biome that wants a ward, for the wiki. */
export function hazards(): { biome: Biome; hazard: Hazard; step: number }[] {
  return BIOMES.flatMap((biome) => {
    const hazard = hazardOf(biome);
    return hazard ? [{ biome, hazard, step: wardTierFor(biome.tierLo) }] : [];
  });
}
