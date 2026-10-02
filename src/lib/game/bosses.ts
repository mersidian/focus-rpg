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
import { GUN_ENTRY_TIER, MAX_TIER } from "./tiers";
import type { Style } from "./archetypes";
import { UNIQUE_BY_SOURCE, type Unique } from "./uniques";
import { RARITIES, spawnPower, successChance, wheelFactor } from "./combat";
import { tierValue } from "./economy";
import type { Rng } from "./rng";

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
 * answer at about ten of the forty, rather than clustering — the wheel should
 * matter as much at a wall as it does at a spawn.
 */
const STYLES: Style[] = ["melee", "ranged", "magic", "gun"];

/** Two above the biome's floor for the mid-boss, and one more for the lord. */
export function bossTier(biome: Biome, role: BossRole): number {
  return Math.min(MAX_TIER, biome.tierLo + (role === "mid" ? 2 : 3));
}

/**
 * No boss below the gun line may be a gun fight — in either direction.
 *
 * The rule here read "guns cannot be the answer before the gun line opens" and
 * then swapped out bosses whose own style was gun. But the answer to a boss is
 * the style that BEATS it, and gunfire beats melee: so the melee bosses were
 * the ones nobody could answer, and the very first boss in the game,
 * Thistlemaw at tier 3, asked for a firearm that does not exist until tier 6.
 * A melee boss down there becomes a ranged one, which melee answers — the one
 * style every new character has.
 */
function styleFor(tier: number, wanted: Style): Style {
  if (tier >= GUN_ENTRY_TIER) return wanted;
  if (wanted === "gun") return "magic";
  if (wanted === "melee") return "ranged";
  return wanted;
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
    style: styleFor(bossTier(biome, role), STYLES[(i * 2 + n) % 4]),
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

export function bossPower(boss: Boss): number {
  return spawnPower(boss.tier, { ...RARITIES[0], power: BOSS_POWER_MULTIPLIER });
}

/**
 * What a loadout brings to one boss, before anything is rolled.
 *
 * One function, because the fight was being described in three places that had
 * each worked it out differently. Resolution asked `bossKillSeconds(offence, 1)`
 * — a boss of power one — which the clamp turned into 450 seconds for every
 * boss against every loadout. The result screen asked
 * `bossKillSeconds(boss.tier, offence)`, arguments swapped and a tier where a
 * power belonged, which came to 2,700 seconds every time; so any fight that
 * reached its roll and lost it inside 45 minutes was reported as "not long
 * enough", and the advice printed under it — more offence shortens the fight —
 * described a mechanism that was not running.
 *
 * The wheel is in `effective`, so the right style shortens the fight as well as
 * improving the roll at the end of it. Both screens and the resolver read this,
 * and `game-audit.mjs` prints it, which is the only reason anyone would have
 * noticed that the number never moved.
 */
export function bossFight(
  boss: Boss,
  offence: number,
  style: Style,
): { power: number; effective: number; seconds: number; chance: number } {
  const power = bossPower(boss);
  const effective = offence * wheelFactor(style, boss.style);
  return {
    power,
    effective,
    seconds: bossKillSeconds(effective, power),
    chance: successChance(effective, power),
  };
}

/* ---------------------------------- the table ------------------------------ */

/**
 * Everything a boss can give up: its signature first, then the rest.
 *
 * `uniques.ts` sources between four and eight uniques to every boss, and the
 * only one any of them ever dropped was the first. §7 has always said "repeat
 * kills roll normally against the boss table" — there was no table. A second
 * kill paid skill XP and nothing else, 177 of the 250 uniques were obtainable
 * by nothing, and three of the five "find N uniques" achievements asked for
 * more than the game could hand out.
 */
export function bossTable(boss: Boss): Unique[] {
  return UNIQUE_BY_SOURCE.get(boss.name) ?? [];
}

/** One repeat kill in four gives up something off the table. */
export const BOSS_REPEAT_UNIQUE_CHANCE = 0.25;

/**
 * What a kill after the first drops, if anything.
 *
 * Seeded by the caller from the session id, like every other roll. The whole
 * table is eligible, signature included — §7's "a second copy at a better stat
 * band" — and the band is rolled rather than pinned to its top, because only
 * the guaranteed first copy has nothing to be unlucky about.
 */
export function rollBossRepeat(boss: Boss, r: Rng): { unique: Unique; percentile: number } | null {
  const table = bossTable(boss);
  if (table.length === 0 || !r.chance(BOSS_REPEAT_UNIQUE_CHANCE)) return null;
  return { unique: table[r.int(0, table.length - 1)], percentile: r.next() };
}

/**
 * Coins for a kill, first or repeat.
 *
 * A boss takes most of a fifty and used to pay nothing for it, so past the
 * first kill the wall was strictly worse than the field beside it. Fifty unit
 * values is about what those minutes would have netted in an area of the same
 * tier: the purse makes a repeat kill break even, and the table is the reason
 * to prefer it.
 */
export function bossPurse(boss: Boss): number {
  return Math.round(tierValue(boss.tier) * 50);
}
