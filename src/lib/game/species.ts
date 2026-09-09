/**
 * The 90 species archetypes (SPEC-V2.md §7).
 *
 * An archetype is a design; a monster is an archetype seen in a biome. "Wolf"
 * plus Frostbite Tundra is a Rime Wolf, and plus Ashfall Ridge an Ashen Wolf.
 * Ninety designs across twenty biomes is where ~1,800 monsters come from, and
 * the reason none of them is hand-written.
 *
 * `style` is the archetype's position on the wheel and `speed` sets its
 * kill-time, so both are fixed per design. What the BIOME adds is `wheelStep`
 * (see `variants.ts`) — without it, SPEC-V2 §15.1's complaint stands and 1,800
 * monsters are ninety fights in twenty coats of paint.
 *
 * Parts are keyed to the SPECIES, never to the variant: a Wolf drops Wolf Pelt
 * in every biome it lives in. Three parts each, generated from the family's
 * suffixes, which is 270 items instead of the 7,200 that per-variant parts would
 * have produced.
 */
import type { Style } from "./archetypes";

export type SpeciesFamily =
  | "beast"
  | "insectoid"
  | "undead"
  | "construct"
  | "elemental"
  | "draconic"
  | "aberration"
  | "humanoid"
  | "fungal"
  | "aquatic";

/** How long one kill takes, before gear. */
export type Speed = "fast" | "medium" | "slow";

export type Species = {
  name: string;
  family: SpeciesFamily;
  style: Style;
  speed: Speed;
  /** The tier band this archetype is found in; it appears in biomes overlapping it. */
  tierLo: number;
  tierHi: number;
};

/**
 * The three part nouns each family drops. A part is "{species} {suffix}", so the
 * whole 270-item part catalogue is this table crossed with the species list.
 */
export const FAMILY_PARTS: Record<SpeciesFamily, [string, string, string]> = {
  beast: ["Pelt", "Fang", "Sinew"],
  insectoid: ["Chitin", "Mandible", "Gland"],
  undead: ["Bone", "Shroud", "Grave Ember"],
  construct: ["Plating", "Core", "Gear"],
  elemental: ["Mote", "Residue", "Heart"],
  draconic: ["Scale", "Claw", "Ichor"],
  aberration: ["Tissue", "Eye", "Filament"],
  humanoid: ["Kit", "Token", "Cord"],
  fungal: ["Cap", "Fibre", "Spore"],
  aquatic: ["Roe", "Barb", "Oil"],
};

const S = (
  name: string,
  family: SpeciesFamily,
  style: Style,
  speed: Speed,
  tierLo: number,
  tierHi: number,
): Species => ({ name, family, style, speed, tierLo, tierHi });

export const SPECIES: Species[] = [
  // Beasts — 12. Something ordinary at every tier.
  S("Hare", "beast", "ranged", "fast", 1, 4),
  S("Boar", "beast", "melee", "medium", 1, 5),
  S("Wolf", "beast", "melee", "fast", 2, 8),
  S("Elk", "beast", "ranged", "medium", 3, 9),
  S("Bear", "beast", "melee", "slow", 4, 10),
  S("Croc", "beast", "melee", "slow", 5, 11),
  S("Hound", "beast", "ranged", "fast", 6, 13),
  S("Tusker", "beast", "melee", "slow", 8, 15),
  S("Stag", "beast", "ranged", "medium", 9, 16),
  S("Ram", "beast", "melee", "medium", 11, 18),
  S("Lynx", "beast", "ranged", "fast", 13, 20),
  S("Shellback", "beast", "melee", "slow", 16, 24),

  // Insectoids — 10. Fast and numerous, so mostly cheap kills.
  S("Spider", "insectoid", "ranged", "fast", 1, 7),
  S("Weevil", "insectoid", "melee", "fast", 2, 8),
  S("Moth", "insectoid", "magic", "fast", 3, 18),
  S("Mantis", "insectoid", "melee", "medium", 5, 11),
  S("Burrower", "insectoid", "melee", "slow", 6, 12),
  S("Hornet", "insectoid", "ranged", "fast", 8, 14),
  S("Scarab", "insectoid", "gun", "medium", 9, 15),
  S("Hivedrone", "insectoid", "ranged", "fast", 11, 17),
  S("Tickmite", "insectoid", "ranged", "fast", 14, 20),
  S("Crawler", "insectoid", "melee", "medium", 15, 22),

  // Undead — 10. Slower, tougher, and the first place magic pays.
  S("Husk", "undead", "melee", "medium", 2, 10),
  S("Drowned", "undead", "melee", "slow", 6, 12),
  S("Revenant", "undead", "magic", "medium", 8, 15),
  S("Boneknight", "undead", "melee", "slow", 10, 17),
  S("Wight", "undead", "magic", "medium", 12, 19),
  S("Grasper", "undead", "melee", "fast", 13, 19),
  S("Barrowman", "undead", "ranged", "medium", 15, 24),
  S("Ashwalker", "undead", "magic", "slow", 16, 22),
  S("Choirghost", "undead", "magic", "medium", 18, 24),
  S("Gravemaw", "undead", "melee", "slow", 20, 24),

  // Constructs — 9. Armoured and slow: the family gunfire was priced for.
  S("Effigy", "construct", "gun", "slow", 3, 11),
  S("Golem", "construct", "gun", "slow", 7, 14),
  S("Lodestone", "construct", "gun", "slow", 9, 16),
  S("Sentinel", "construct", "gun", "medium", 11, 18),
  S("Clockwork", "construct", "gun", "fast", 12, 19),
  S("Bellcast", "construct", "magic", "slow", 14, 20),
  S("Pylon", "construct", "gun", "slow", 16, 22),
  S("Warden", "construct", "gun", "slow", 18, 23),
  S("Enginehulk", "construct", "gun", "slow", 19, 24),

  // Elementals — 9. One per biome idea, each a magic-shaped fight.
  S("Cinder", "elemental", "magic", "fast", 4, 13),
  S("Tide", "elemental", "magic", "medium", 4, 13),
  S("Rime", "elemental", "magic", "medium", 10, 17),
  S("Gale", "elemental", "magic", "fast", 12, 19),
  S("Sporecloud", "elemental", "magic", "slow", 13, 19),
  S("Slag", "elemental", "melee", "slow", 15, 21),
  S("Thunderhead", "elemental", "gun", "fast", 16, 22),
  S("Nullwisp", "elemental", "magic", "medium", 20, 24),
  S("Dawnmote", "elemental", "magic", "fast", 22, 24),

  // Draconic — 8. Late, slow, and the best parts in the game.
  S("Scalebrood", "draconic", "melee", "medium", 9, 15),
  S("Drake", "draconic", "magic", "slow", 11, 18),
  S("Coilserpent", "draconic", "melee", "medium", 13, 19),
  S("Wyvern", "draconic", "ranged", "medium", 14, 20),
  S("Basilisk", "draconic", "magic", "slow", 16, 22),
  S("Pyrewing", "draconic", "magic", "slow", 18, 23),
  S("Sablewyrm", "draconic", "melee", "slow", 19, 24),
  S("Wyrm", "draconic", "melee", "slow", 21, 24),

  // Aberrations — 8. The Voidscar register, and the worst matchups.
  S("Gloomworm", "aberration", "melee", "medium", 9, 16),
  S("Watcher", "aberration", "magic", "slow", 12, 19),
  S("Mirrorkin", "aberration", "ranged", "fast", 13, 24),
  S("Ichorspawn", "aberration", "ranged", "fast", 15, 21),
  S("Hollowthing", "aberration", "magic", "medium", 17, 23),
  S("Nullborn", "aberration", "gun", "medium", 19, 24),
  S("Scarborn", "aberration", "melee", "slow", 20, 24),
  S("Unmadeling", "aberration", "magic", "fast", 21, 24),

  // Humanoids — 10. Present at every tier, and they shoot back.
  S("Poacher", "humanoid", "ranged", "medium", 1, 8),
  S("Bandit", "humanoid", "melee", "medium", 3, 10),
  S("Cultist", "humanoid", "magic", "medium", 4, 16),
  S("Scavenger", "humanoid", "ranged", "fast", 5, 12),
  S("Pitboss", "humanoid", "melee", "slow", 7, 14),
  S("Deserter", "humanoid", "gun", "medium", 10, 17),
  S("Tollman", "humanoid", "gun", "slow", 12, 19),
  S("Chorister", "humanoid", "magic", "medium", 14, 21),
  S("Rimewarden", "humanoid", "gun", "medium", 18, 23),
  S("Spirekeeper", "humanoid", "magic", "slow", 22, 24),

  // Fungal and plant — 7. Slow, and mostly a Foraging story.
  S("Sporeling", "fungal", "ranged", "fast", 1, 9),
  S("Thornling", "fungal", "ranged", "medium", 4, 11),
  S("Barkent", "fungal", "melee", "slow", 6, 13),
  S("Rotvine", "fungal", "melee", "medium", 12, 19),
  S("Bloomhusk", "fungal", "magic", "medium", 13, 20),
  S("Mycelhulk", "fungal", "melee", "slow", 15, 22),
  S("Lightbloom", "fungal", "magic", "slow", 22, 24),

  // Aquatic — 7. Coastal biomes, and why Fishing feeds Combat.
  S("Brineeel", "aquatic", "ranged", "fast", 1, 9),
  S("Reeflurker", "aquatic", "melee", "medium", 4, 11),
  S("Tidefang", "aquatic", "ranged", "fast", 6, 13),
  S("Drownweed", "aquatic", "magic", "slow", 8, 15),
  S("Anglerhorror", "aquatic", "magic", "slow", 12, 19),
  S("Siren", "aquatic", "magic", "medium", 14, 21),
  S("Krakenspawn", "aquatic", "melee", "slow", 18, 24),
];

export const SPECIES_BY_NAME = new Map(SPECIES.map((s) => [s.name, s]));

/** Every monster part in the game: 90 species x 3. */
export const PARTS = SPECIES.flatMap((s) =>
  FAMILY_PARTS[s.family].map((suffix, n) => ({
    name: `${s.name} ${suffix}`,
    species: s.name,
    family: s.family,
    /** 0 common, 1 uncommon, 2 the one worth the trip. */
    grade: n,
    tier: s.tierLo,
  })),
);

/** Species whose band overlaps a tier, i.e. what can live in a biome. */
export function speciesAt(tierLo: number, tierHi: number): Species[] {
  return SPECIES.filter((s) => s.tierLo <= tierHi && s.tierHi >= tierLo);
}
