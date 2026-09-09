/**
 * What an item is worth, and how its three axes compose (SPEC-V2.md §8).
 *
 *     power = slotBase x tier.power x styleAffinity x quality.window x refine
 *
 * Three axes, deliberately independent so they can be read apart: the tier is
 * where you are, the quality window is what you were handed, the rolled band is
 * how it landed inside that window, and refinement is what you paid for on top.
 *
 * The style affinities carry the ammunition cost ladder of §7 into the numbers
 * rather than leaving it as prose: gunfire has the highest offence and the
 * thinnest coat, melee the lowest offence and the heaviest plate. A style's
 * upkeep and its ceiling move together.
 */
import { ARCHETYPES, type Archetype, type Style } from "./archetypes";
import { quality, type Quality } from "./quality";
import { tier } from "./tiers";

export type Slot =
  | "weapon"
  | "offhand"
  | "head"
  | "body"
  | "legs"
  | "boots"
  | "gloves"
  | "cape"
  | "amulet"
  | "ring";

export const SLOTS: Slot[] = [
  "weapon",
  "offhand",
  "head",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
  "amulet",
  "ring",
];

export type SlotKind = "offence" | "defence" | "modifier";

export const SLOT_KIND: Record<Slot, SlotKind> = {
  weapon: "offence",
  offhand: "offence",
  head: "defence",
  body: "defence",
  legs: "defence",
  boots: "defence",
  gloves: "defence",
  cape: "defence",
  amulet: "modifier",
  ring: "modifier",
};

/**
 * How much of a loadout each slot is. Body and weapon carry the weight; boots
 * and rings are the trim. They sum to 5.35, which is the divisor that turns a
 * full set into a single comparable number.
 */
export const SLOT_BASE: Record<Slot, number> = {
  weapon: 1.0,
  offhand: 0.45,
  head: 0.55,
  body: 1.0,
  legs: 0.75,
  boots: 0.4,
  gloves: 0.35,
  cape: 0.3,
  amulet: 0.25,
  ring: 0.2,
};

export const TOTAL_SLOT_BASE = SLOTS.reduce((n, s) => n + SLOT_BASE[s], 0);

/**
 * Offence and defence per style. The spread is the cost ladder made numeric:
 * gun 1.35/0.70 against melee 1.00/1.15. A gun kills faster and folds sooner,
 * and it pays for cartridges to do it.
 */
export const STYLE_AFFINITY: Record<Style, { offence: number; defence: number; modifier: number }> = {
  melee: { offence: 1.0, defence: 1.15, modifier: 1.0 },
  ranged: { offence: 1.1, defence: 0.95, modifier: 1.05 },
  magic: { offence: 1.2, defence: 0.8, modifier: 1.15 },
  gun: { offence: 1.35, defence: 0.7, modifier: 1.0 },
};

export function affinity(style: Style, slot: Slot): number {
  return STYLE_AFFINITY[style][SLOT_KIND[slot]];
}

/** +1 to +10, five percent a level, so +10 is half again. */
export const REFINE_STEP = 0.05;
export const MAX_REFINE = 10;

export function refineMultiplier(refine: number): number {
  const r = Math.min(Math.max(Math.trunc(refine), 0), MAX_REFINE);
  return 1 + r * REFINE_STEP;
}

export type ItemSpec = {
  slot: Slot;
  style: Style;
  tier: number;
  quality: Quality;
  refine: number;
  /** Weapons only; carries the damage coefficient and band width. */
  archetype?: Archetype;
};

/** The centre of an item's band, before the roll. */
export function centre(spec: ItemSpec): number {
  const t = tier(spec.tier);
  const base =
    spec.slot === "weapon" && spec.archetype
      ? spec.archetype.damage * 10
      : SLOT_BASE[spec.slot] * 10;
  return (
    base * t.power * affinity(spec.style, spec.slot) * quality(spec.quality).window * refineMultiplier(spec.refine)
  );
}

/**
 * The band a roll is drawn from. Weapons take their half-width from the
 * archetype, so a fast shallow weapon rolls wide and a slow final one rolls
 * tight; everything else uses a flat twelve percent.
 */
export const DEFAULT_BAND_PCT = 12;

export function band(spec: ItemSpec): { lo: number; hi: number; centre: number } {
  const c = centre(spec);
  const pct = (spec.slot === "weapon" && spec.archetype ? spec.archetype.bandPct : DEFAULT_BAND_PCT) / 100;
  return { lo: c * (1 - pct), hi: c * (1 + pct), centre: c };
}

/** Where a rolled value sits in its band, 0-1. This is the number the card shows. */
export function percentile(spec: ItemSpec, rolled: number): number {
  const { lo, hi } = band(spec);
  if (hi <= lo) return 1;
  return Math.min(1, Math.max(0, (rolled - lo) / (hi - lo)));
}

/** Draw a value from an item's band. */
export function roll(spec: ItemSpec, r: { next(): number }): number {
  const { lo, hi } = band(spec);
  return lo + r.next() * (hi - lo);
}

export type Equipped = Partial<Record<Slot, { spec: ItemSpec; rolled: number }>>;

/**
 * A loadout is TWO numbers, not one.
 *
 * The first version of this collapsed everything into a single figure, and the
 * balance audit caught the consequence immediately: because armour carries most
 * of the slot weight, a gun loadout — the style with the highest offence and the
 * thinnest coat — came out as the *weakest* in the game. Exactly backwards from
 * the cost ladder §7 states in prose.
 *
 * So offence and defence are kept apart, and each does one job:
 *
 *   - **offence** decides kill speed and the conversion chance.
 *   - **defence** decides what a failure COSTS: a thin coat burns more rations
 *     per failed kill.
 *
 * That makes the style affinities mean what they say. Gunfire kills fastest and
 * eats most; melee kills slowest and shrugs. Both are on the same scale as
 * `spawnPower`, each normalised by the slot bases actually available to it — so
 * a two-handed weapon is not simply worse for holding one fewer item, and what
 * it buys back is throughput and conversion, never access.
 */
export type LoadoutPower = { offence: number; defence: number };

const OFFENCE_SLOTS = SLOTS.filter((s) => SLOT_KIND[s] === "offence");
const GUARD_SLOTS = SLOTS.filter((s) => SLOT_KIND[s] !== "offence");

function normalised(equipped: Equipped, slots: Slot[], skipOffhand: boolean): number {
  const usable = slots.filter((s) => !(skipOffhand && s === "offhand"));
  const available = usable.reduce((n, s) => n + SLOT_BASE[s], 0);
  if (available <= 0) return 0;
  const got = usable.reduce((n, s) => n + (equipped[s]?.rolled ?? 0), 0);
  return (got / available) * TOTAL_SLOT_BASE;
}

export function loadoutPower(equipped: Equipped): LoadoutPower {
  const twoHanded = equipped.weapon?.spec.archetype?.hands === 2;
  return {
    offence: normalised(equipped, OFFENCE_SLOTS, twoHanded),
    defence: normalised(equipped, GUARD_SLOTS, false),
  };
}

/** The style a loadout fights as, taken from its weapon. */
export function loadoutStyle(equipped: Equipped): Style | null {
  return equipped.weapon?.spec.style ?? null;
}

export const ARCHETYPE_COUNT = ARCHETYPES.length;

/**
 * A full set at one tier, every slot filled, every roll at its band centre.
 *
 * The yardstick the whole curve is calibrated against — `SPAWN_BASE` is the
 * number that puts this at rough parity with a Common spawn of the same tier.
 * It lives here rather than in the audit script so that the balance audit, the
 * tests and the wiki all measure the same thing.
 */
export function referenceLoadout(
  style: Style,
  atTier: number,
  quality: Quality = "plain",
  refine = 0,
): { equipped: Equipped; power: LoadoutPower } {
  const archetype = ARCHETYPES.find((a) => a.style === style);
  const twoHanded = archetype?.hands === 2;
  const equipped: Equipped = {};
  for (const slot of SLOTS) {
    if (slot === "offhand" && twoHanded) continue;
    const spec: ItemSpec = {
      slot,
      style,
      tier: atTier,
      quality,
      refine,
      archetype: slot === "weapon" ? archetype : undefined,
    };
    equipped[slot] = { spec, rolled: band(spec).centre };
  }
  return { equipped, power: loadoutPower(equipped) };
}
