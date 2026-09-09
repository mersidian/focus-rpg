/**
 * The 40 bosses: a mid-boss and a biome lord in each of the 20 biomes
 * (SPEC-V2.md §7).
 *
 * A boss is fought as an ordinary focus session — there is no special mode and
 * no screen that wants attention. The difference is entirely in the gate and the
 * reward:
 *
 *   - A boss demands a tier band **two above its biome's floor**, so it is the
 *     wall that says "come back better" rather than a coin flip.
 *   - **The first kill always drops its signature unique.** Guaranteed, no roll.
 *     A 2% chance on a fight you can attempt once a week is not a reward, it is
 *     a tax — and `world_progress` remembers, so a guarantee cannot fire twice.
 *   - Repeat kills roll the boss table normally, with the unique at a low rate
 *     for a second copy at a better band.
 *   - Bosses have no rarity ladder. A boss is its own rarity.
 */
import { BIOMES, type Biome } from "./biomes";
import { MAX_TIER } from "./tiers";
import type { Style } from "./archetypes";
import { UNIQUE_BY_SOURCE, type Unique } from "./uniques";

export type BossRole = "mid" | "lord";

export type Boss = {
  name: string;
  biome: number;
  role: BossRole;
  tier: number;
  style: Style;
  /** What its first kill always gives up. */
  signature: Unique | null;
};

/** Two per biome, in biome order. */
const NAMES: [string, string][] = [
  ["Thistlemaw", "The Gilded Hare"],
  ["Oakenshade", "Hollow-Antler"],
  ["Brinescuttle", "The Pale Tide"],
  ["Bramblewretch", "Old Rootfang"],
  ["Cavelight", "The Third Shift"],
  ["Reedmother", "Fenlantern"],
  ["Cinderjaw", "Emberthrone"],
  ["Wrackmaiden", "The Drowned Choir"],
  ["Seamwyrm", "Blackvein"],
  ["Thornsovereign", "The Wild Hunt"],
  ["Rimehowl", "The White Elk"],
  ["Mirrorstride", "The Sand Sermon"],
  ["Sporecrown", "Mycelia Prime"],
  ["The Kneeling Saint", "Choirmaster Vell"],
  ["Glassflame", "The Obsidian Ordinal"],
  ["Skyfracture", "The Gale Warden"],
  ["Rotmother", "Plaguewright"],
  ["The Cold Engine", "Warden Null"],
  ["Scarborn", "The Unmaking"],
  ["Solmourn", "The Last Light"],
];

/**
 * A boss's style is fixed per biome so that the four styles are each the right
 * answer at ten of the forty, rather than clustering — the wheel should matter
 * as much at a wall as it does at a spawn.
 */
const STYLES: Style[] = ["melee", "ranged", "magic", "gun"];

/** Two above the biome's floor for the mid-boss, and one more for the lord. */
export function bossTier(biome: Biome, role: BossRole): number {
  return Math.min(MAX_TIER, biome.tierLo + (role === "mid" ? 2 : 3));
}

export const BOSSES: Boss[] = BIOMES.flatMap((biome, i) => {
  const [mid, lord] = NAMES[i];
  return ([
    ["mid", mid],
    ["lord", lord],
  ] as [BossRole, string][]).map(([role, name], n) => ({
    name,
    biome: biome.index,
    role,
    tier: bossTier(biome, role),
    // Guns cannot be the answer before the gun line opens, so early biomes get
    // a style the player can actually bring.
    style:
      biome.tierLo < 6 && STYLES[(i * 2 + n) % 4] === "gun"
        ? "magic"
        : STYLES[(i * 2 + n) % 4],
    signature: (UNIQUE_BY_SOURCE.get(name) ?? [])[0] ?? null,
  }));
});

export const BOSS_BY_NAME = new Map(BOSSES.map((b) => [b.name, b]));

export function bossesIn(biomeIndex: number): Boss[] {
  return BOSSES.filter((b) => b.biome === biomeIndex);
}

/** The marker `world_progress` stores, so a first kill is only ever first once. */
export function bossMarker(boss: Boss): string {
  return `boss:${boss.biome}:${boss.role}`;
}

/**
 * How much of a session a boss takes.
 *
 * A boss is one fight, not a roster, so it is resolved as a single long kill
 * rather than by the spawn loop. It wants most of a session at parity — which is
 * what makes it a commitment rather than something you clear on the way past.
 */
export const BOSS_KILL_SECONDS = 900;

export function bossKillSeconds(effectivePower: number, bossPower: number): number {
  const ratio = bossPower <= 0 ? 1 : bossPower / Math.max(1, effectivePower);
  return BOSS_KILL_SECONDS * Math.min(3, Math.max(0.5, ratio));
}

/** Bosses are their own rarity, so their power is set here rather than rolled. */
export const BOSS_POWER_MULTIPLIER = 2.2;
