/**
 * The 24-tier material spine (SPEC-V2.md §8, §16.1).
 *
 * One ladder, worn by four naming families. Tier N is tier N in power whatever
 * you wear, which is the decision that lets a gate be a bare tier number
 * instead of a per-style mapping table.
 *
 * `gateHours` is not decoration. The spine is pinned to V1's own character
 * ladder: tier 1 opens at 0 h, tier 12 at 1,094 h just past Sage V, and tier 24
 * at exactly 10,000 h, where Mythic V also lands. Material progress and rank
 * progress are the same climb seen twice.
 *
 * The gun line has no composite material below tier 6: firearms need sulphur and
 * saltpetre, and those come out of Ashfall Ridge.
 */

export const MAX_TIER = 24;
/** Below this tier there is no composite material, so no firearms and no coats. */
export const GUN_ENTRY_TIER = 6;

export type Family = "metal" | "hide" | "cloth" | "composite";
export const FAMILIES: Family[] = ["metal", "hide", "cloth", "composite"];

export type Tier = {
  tier: number;
  metal: string;
  hide: string;
  cloth: string;
  /** Null below GUN_ENTRY_TIER. */
  composite: string | null;
  /** Focused hours at which this tier opens. */
  gateHours: number;
  /** Power multiplier against tier 1. */
  power: number;
};

export const TIERS: Tier[] = [
  { tier: 1, metal: "Copper", hide: "Hare", cloth: "Flax", composite: null, gateHours: 0, power: 1.0 },
  { tier: 2, metal: "Bronze", hide: "Boar", cloth: "Hemp", composite: null, gateHours: 1, power: 1.2 },
  { tier: 3, metal: "Iron", hide: "Wolf", cloth: "Wool", composite: null, gateHours: 7, power: 1.4 },
  { tier: 4, metal: "Steel", hide: "Elk", cloth: "Linen", composite: null, gateHours: 22, power: 1.7 },
  { tier: 5, metal: "Crucible Steel", hide: "Bear", cloth: "Silk", composite: null, gateHours: 53, power: 2.1 },
  { tier: 6, metal: "Brineiron", hide: "Saltcroc", cloth: "Reedweave", composite: "Tarred Canvas", gateHours: 103, power: 2.5 },
  { tier: 7, metal: "Ashsteel", hide: "Cinderhound", cloth: "Emberlinen", composite: "Fire-cured Duckcloth", gateHours: 178, power: 3.0 },
  { tier: 8, metal: "Wracksteel", hide: "Reefjaw", cloth: "Tidesilk", composite: "Waxed Sailcloth", gateHours: 282, power: 3.6 },
  { tier: 9, metal: "Seamsteel", hide: "Longtusk", cloth: "Coalsilk", composite: "Pitched Twill", gateHours: 421, power: 4.3 },
  { tier: 10, metal: "Barbsteel", hide: "Thornstag", cloth: "Briarweave", composite: "Resined Moleskin", gateHours: 599, power: 5.2 },
  { tier: 11, metal: "Marrowiron", hide: "Hoarback", cloth: "Frostlace", composite: "Boiled Fustian", gateHours: 822, power: 6.2 },
  { tier: 12, metal: "Glasscast", hide: "Shardmoth", cloth: "Mirrorsilk", composite: "Quilted Ticking", gateHours: 1094, power: 7.4 },
  { tier: 13, metal: "Hollowcast", hide: "Sporecrawler", cloth: "Mycelweave", composite: "Silvered Buckram", gateHours: 1420, power: 8.9 },
  { tier: 14, metal: "Vaultsteel", hide: "Cryptwyvern", cloth: "Choirsilk", composite: "Lacquered Gabardine", gateHours: 1806, power: 10.7 },
  { tier: 15, metal: "Slagsteel", hide: "Firescale", cloth: "Smokesilk", composite: "Riveted Kersey", gateHours: 2255, power: 12.8 },
  { tier: 16, metal: "Thundercast", hide: "Galeroc", cloth: "Cloudsilk", composite: "Bone-lined Melton", gateHours: 2774, power: 15.4 },
  { tier: 17, metal: "Palesteel", hide: "Fenbasilisk", cloth: "Blightweave", composite: "Wire-stitched Drill", gateHours: 3367, power: 18.5 },
  { tier: 18, metal: "Coldcast", hide: "Rimehorn", cloth: "Winterweave", composite: "Glazed Oilskin", gateHours: 4038, power: 22.2 },
  { tier: 19, metal: "Nightiron", hide: "Sablewyrm", cloth: "Hushweave", composite: "Varnished Sateen", gateHours: 4793, power: 26.6 },
  { tier: 20, metal: "Barrowsteel", hide: "Gravemaw", cloth: "Shroudsilk", composite: "Plate-backed Damask", gateHours: 5637, power: 31.9 },
  { tier: 21, metal: "Voidcast", hide: "Scarborn", cloth: "Nullweave", composite: "Hollow-plied Brocade", gateHours: 6575, power: 38.3 },
  { tier: 22, metal: "Cometiron", hide: "Starcoil", cloth: "Meteorsilk", composite: "Cold-pressed Grosgrain", gateHours: 7612, power: 46.0 },
  { tier: 23, metal: "Solsteel", hide: "Pyrewing", cloth: "Sunlace", composite: "Glass-set Sarcenet", gateHours: 8752, power: 55.2 },
  { tier: 24, metal: "Firstlight Steel", hide: "Dawnmane", cloth: "Morrowsilk", composite: "Ninefold Poplin", gateHours: 10000, power: 66.2 },
];

export function tier(n: number): Tier {
  const found = TIERS[Math.min(Math.max(Math.trunc(n), 1), MAX_TIER) - 1];
  return found;
}

/** The material word for a tier in a family, or null where the family has none. */
export function materialName(n: number, family: Family): string | null {
  return tier(n)[family];
}

/** Which families exist at a tier. Composite is absent below GUN_ENTRY_TIER. */
export function familiesAt(n: number): Family[] {
  return FAMILIES.filter((f) => tier(n)[f] !== null);
}

/** The highest tier a character with this many focused hours may equip. */
export function tierForHours(hours: number): number {
  let open = 1;
  for (const t of TIERS) if (hours >= t.gateHours) open = t.tier;
  return open;
}
