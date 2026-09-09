/**
 * The 20 biomes (SPEC-V2.md §7, §16.3).
 *
 * A biome carries three things: a tier band, a gathering skill affinity so the
 * economy interlocks rather than running in parallel lanes, and the prefix that
 * names its monster variants. A wolf in Frostbite Tundra is a "Rime Wolf"; the
 * same archetype in Ashfall Ridge is an "Ashen Wolf".
 *
 * `materials` are the three biome materials anything living there can drop. They
 * are keyed to the BIOME, while parts are keyed to the SPECIES — the split that
 * keeps 1,800 monster variants from generating 7,200 near-identical pelts.
 *
 * `keyItem` marks the three points where the world visibly changes shape, rather
 * than merely getting harder.
 */

export type BiomeKey =
  | "sulphurAndSaltpetre"
  | "rimeworksCipher"
  | "voidscarSigil";

export type Biome = {
  index: number;
  name: string;
  /** Names monster variants: "{prefix} {species}". */
  prefix: string;
  tierLo: number;
  tierHi: number;
  /** Gathering skills this biome favours. */
  affinity: string[];
  /** Three biome materials, dropped by anything living here. */
  materials: [string, string, string];
  /** A key item found here, which gates content elsewhere. */
  keyItem: BiomeKey | null;
};

export const BIOMES: Biome[] = [
  { index: 1, name: "Sunlit Meadow", prefix: "Hedgerow", tierLo: 1, tierHi: 2, affinity: ["foraging"], materials: ["Meadow Chalk", "Sunwort Sprig", "Clover Pollen"], keyItem: null },
  { index: 2, name: "Whispering Wood", prefix: "Hushwood", tierLo: 2, tierHi: 4, affinity: ["woodcutting"], materials: ["Loamstone Chip", "Hushbark Strip", "Whisper Resin"], keyItem: null },
  { index: 3, name: "Tidepool Flats", prefix: "Tidal", tierLo: 3, tierHi: 5, affinity: ["fishing"], materials: ["Reefchalk", "Bladderweed Frond", "Tidefoam"], keyItem: null },
  { index: 4, name: "Rootdeep Thicket", prefix: "Rootbound", tierLo: 4, tierHi: 6, affinity: ["woodcutting", "hunting"], materials: ["Rootflint", "Deadfall Fibre", "Thicket Musk"], keyItem: null },
  { index: 5, name: "Abandoned Mine", prefix: "Deadlamp", tierLo: 5, tierHi: 7, affinity: ["mining"], materials: ["Tailings Grit", "Pitprop Splinter", "Lampsoot"], keyItem: null },
  { index: 6, name: "Saltmarsh", prefix: "Brackish", tierLo: 6, tierHi: 8, affinity: ["fishing", "foraging"], materials: ["Brack Salt", "Reed Cord", "Marshgas Bladder"], keyItem: null },
  { index: 7, name: "Ashfall Ridge", prefix: "Ashen", tierLo: 7, tierHi: 9, affinity: ["mining"], materials: ["Ridge Sulphur", "Scorchbark Char", "Cinderglass Flake"], keyItem: "sulphurAndSaltpetre" },
  { index: 8, name: "Sunken Shore", prefix: "Wrackshore", tierLo: 8, tierHi: 10, affinity: ["fishing"], materials: ["Shell Grit", "Wrackweed Coil", "Saltbloom"], keyItem: null },
  { index: 9, name: "Deep Seam", prefix: "Deepvein", tierLo: 9, tierHi: 11, affinity: ["mining"], materials: ["Seamcoal", "Blindmoss Mat", "Firedamp Flask"], keyItem: null },
  { index: 10, name: "Bramblewild", prefix: "Briar", tierLo: 10, tierHi: 12, affinity: ["foraging", "hunting"], materials: ["Briarflint", "Thornvine Cord", "Bramble Honey"], keyItem: null },
  { index: 11, name: "Frostbite Tundra", prefix: "Rime", tierLo: 11, tierHi: 13, affinity: ["hunting"], materials: ["Rime Salt", "Frostfur Tuft", "Blue Ice Core"], keyItem: null },
  { index: 12, name: "Glasswaste", prefix: "Glasscut", tierLo: 12, tierHi: 14, affinity: ["excavation"], materials: ["Fulgur Sand", "Sunbleached Sinew", "Mirrorshard"], keyItem: null },
  { index: 13, name: "Fungal Hollow", prefix: "Sporelit", tierLo: 13, tierHi: 15, affinity: ["foraging"], materials: ["Damp Chalk", "Mycelium Mat", "Spore Amber"], keyItem: null },
  { index: 14, name: "Sunken Cathedral", prefix: "Sanctum", tierLo: 14, tierHi: 16, affinity: ["excavation"], materials: ["Votive Lead", "Vestment Scrap", "Choir Ash"], keyItem: "rimeworksCipher" },
  { index: 15, name: "Obsidian Caldera", prefix: "Emberglass", tierLo: 15, tierHi: 17, affinity: ["mining"], materials: ["Caldera Obsidian", "Blistered Hide", "Emberglass Bead"], keyItem: null },
  { index: 16, name: "Stormcrag Peaks", prefix: "Stormworn", tierLo: 16, tierHi: 18, affinity: ["hunting"], materials: ["Cragslate", "Windfeather Quill", "Thunderglass"], keyItem: null },
  { index: 17, name: "Blightfen", prefix: "Fenrot", tierLo: 17, tierHi: 19, affinity: ["foraging"], materials: ["Bogiron Nodule", "Rotweed Bundle", "Miasma Flask"], keyItem: null },
  { index: 18, name: "The Rimeworks", prefix: "Coldwrought", tierLo: 19, tierHi: 21, affinity: ["excavation", "mining"], materials: ["Enginesteel Scrap", "Gasket Leather", "Null Coolant"], keyItem: null },
  { index: 19, name: "Voidscar", prefix: "Unmade", tierLo: 21, tierHi: 23, affinity: ["mining", "hunting", "foraging", "fishing", "woodcutting", "excavation"], materials: ["Scarstone", "Unmade Marrow", "Hollow Ichor"], keyItem: "voidscarSigil" },
  { index: 20, name: "Sunspire", prefix: "Spirelit", tierLo: 23, tierHi: 24, affinity: ["excavation"], materials: ["Spirestone", "Lightburnt Hide", "Firstlight"], keyItem: null },
];

export const BIOME_BY_INDEX = new Map(BIOMES.map((b) => [b.index, b]));

/** Every biome material in the game: 20 biomes x 3. */
export const BIOME_MATERIALS = BIOMES.flatMap((b) =>
  b.materials.map((name) => ({ name, biome: b.index, tier: b.tierLo })),
);

/** Areas per biome. 20 x 10 = 200. */
export const AREAS_PER_BIOME = 10;

export function areaTier(biome: Biome, area: number): number {
  // Areas walk the biome's band, so area 1 is its floor and area 10 its ceiling.
  const span = biome.tierHi - biome.tierLo;
  return biome.tierLo + Math.round((span * (area - 1)) / (AREAS_PER_BIOME - 1));
}

export function biomesOpenAt(maxTier: number): Biome[] {
  return BIOMES.filter((b) => b.tierLo <= maxTier);
}
