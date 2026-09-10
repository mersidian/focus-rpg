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

/**
 * The word a tier lends to a material line that is not metal, hide or cloth.
 *
 * The four equipment families name armour and weapons, and everything else in
 * the game borrowed `metal` because it was the default — so a fish was a
 * "Copper Catch", a log was a "Copper Log", a gemstone was a "Copper Gem" and a
 * dug-up artefact was a "Copper Relic". The tier was doing the naming and the
 * thing itself was not.
 *
 * Each list is 24 long and climbs the same arc the metals do: mundane at the
 * bottom, regional in the middle, cosmic at the top, taking its cue from the
 * tier's own creature — tier 7 is Cinderhound and Ashsteel, so its wood is
 * Cinderpine and its fish a Cinderfin.
 */
export const LINE_WORDS: Record<string, readonly string[]> = {
  wood: [
    "Pine", "Birch", "Oak", "Ash", "Yew", "Mangrove", "Cinderpine", "Driftoak",
    "Seamcedar", "Thornwood", "Hoarbirch", "Glasswillow", "Sporebeech", "Cryptcedar",
    "Slagoak", "Galepine", "Fenelm", "Rimewood", "Sablewood", "Barrowyew",
    "Voidwood", "Cometash", "Sunbough", "Dawnwood",
  ],
  fish: [
    "Minnow", "Perch", "Trout", "Pike", "Salmon", "Brinecarp", "Cinderfin", "Reefbass",
    "Seamling", "Thornray", "Hoarcod", "Glasseel", "Sporegill", "Cryptfish",
    "Slagmouth", "Galetail", "Fenlurker", "Rimeperch", "Sableshade", "Gravecarp",
    "Voidmaw", "Cometfin", "Pyrescale", "Dawnfish",
  ],
  gem: [
    "Quartz", "Agate", "Jasper", "Amethyst", "Garnet", "Brinestone", "Ember Opal",
    "Reef Pearl", "Seam Beryl", "Thorn Tourmaline", "Marrow Onyx", "Glass Diamond",
    "Spore Peridot", "Crypt Sapphire", "Slag Ruby", "Storm Topaz", "Pale Moonstone",
    "Rime Aquamarine", "Night Spinel", "Barrow Jet", "Void Obsidian", "Comet Zircon",
    "Sun Citrine", "Firstlight Star",
  ],
  herb: [
    "Marigold", "Comfrey", "Yarrow", "Foxglove", "Nightshade", "Saltwort", "Emberleaf",
    "Kelpflower", "Seamroot", "Briarbloom", "Frostbell", "Glassvine", "Sporecap",
    "Cryptmoss", "Slagthistle", "Stormpetal", "Blightweed", "Rimeflower", "Sableleaf",
    "Gravebloom", "Voidlily", "Starblossom", "Sunwort", "Dawnbloom",
  ],
  relic: [
    "Potsherd", "Bone Charm", "Clay Tablet", "Carved Seal", "Burial Mask",
    "Salt-crusted Idol", "Ash-glazed Urn", "Barnacled Reliquary", "Seam-cut Obelisk",
    "Thorn-wound Effigy", "Marrow Fetish", "Glass Astrolabe", "Spore-sealed Codex",
    "Crypt Diadem", "Slag Reliquary", "Storm-etched Bell", "Pale Sarcophagus",
    "Rime-locked Coffer", "Night-inked Scroll", "Barrow Crown", "Void Sigil",
    "Comet Fragment", "Solar Disc", "Firstlight Ark",
  ],
  food: [
    "Dried", "Salted", "Smoked", "Cured", "Honeyed", "Brined", "Ash-baked",
    "Sea-salted", "Deep-cured", "Spiced", "Frost-packed", "Glass-sealed",
    "Spore-wrapped", "Crypt-sealed", "Smoke-cured", "Storm-dried", "Fen-pickled",
    "Rime-packed", "Night-cured", "Barrow-sealed", "Void-sealed", "Star-cured",
    "Sun-dried", "Dawn-blessed",
  ],
};

/** A vocabulary is one of the four equipment families or one of the lists above. */
export type Vocab = Family | keyof typeof LINE_WORDS;

/**
 * The word tier `n` lends to vocabulary `v`.
 *
 * One lookup for both kinds, so nothing has to know whether a word comes from
 * the spine or from a line's own list.
 */
export function materialWord(n: number, v: string): string {
  const t = tier(n);
  const words = LINE_WORDS[v];
  if (words) return words[Math.min(Math.max(Math.trunc(n), 1), MAX_TIER) - 1];
  return (t[v as Family] as string | null) ?? t.metal;
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
