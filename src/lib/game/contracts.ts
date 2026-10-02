/**
 * Slaying contracts (SPEC-V2.md §7).
 *
 * One at a time, and it never expires. Its job is to be the voice that says
 * *go here next*: with 200 areas, ~709 monsters and open tier gating, the world
 * has no suggested order and something has to offer one.
 *
 * Pure, and seeded — the target is drawn from the contract number rather than
 * from a clock, so taking the same contract twice on a replay gives the same
 * target.
 */
import { BIOMES, BIOME_BY_INDEX } from "./biomes";
import { tierValue } from "./economy";
import { STONE_KINDS } from "./items";
import { rng, type Rng } from "./rng";
import { processingXp } from "./skills";
import { UNIQUES, type Unique } from "./uniques";
import { areasIn, variantsIn } from "./variants";

export type ContractOffer = {
  variantName: string;
  biome: number;
  tier: number;
  required: number;
};

/** How deep the ladder reaches at a Slaying level. */
export function contractDepth(slayingLevel: number): number {
  return Math.max(2, Math.min(BIOMES.length, Math.round(slayingLevel / 4) + 2));
}

/**
 * Draw a target.
 *
 * Deliberately biased toward the deepest biome the ladder has opened, because a
 * contract that keeps sending you back to the meadow is not a route through the
 * content — it is a chore.
 */
export function rollContract(seed: string, slayingLevel: number): ContractOffer | null {
  const depth = contractDepth(slayingLevel);
  const open = BIOMES.filter((b) => b.index <= depth);
  if (open.length === 0) return null;

  const r = rng(seed);
  const weighted = r.weighted(open, (b) => b.index * b.index);
  const roster = variantsIn(weighted);
  if (roster.length === 0) return null;

  const target = roster[r.int(0, roster.length - 1)];
  // Enough to want a session or two, and scaled down as targets get slower.
  const base = target.species.speed === "fast" ? 60 : target.species.speed === "medium" ? 40 : 25;
  return {
    variantName: target.name,
    biome: weighted.index,
    tier: target.tier,
    required: base + r.int(0, base / 2),
  };
}

/* --------------------------------- the purse ------------------------------- */

export type ContractPurse = {
  coins: number;
  stones: number;
  /** Which stone, at the contract's own tier. */
  stoneItemId: string;
  /** Slaying XP, which was the whole of the reward until this existed. */
  xp: number;
};

/**
 * What finishing a contract pays.
 *
 * §7 lists four rewards — "coins, Slaying XP, upgrade stones, and the skill's
 * own uniques" — and one of them was paid. A contract was a counter that filled
 * up and reset, with nothing on the other side of it that a player could see,
 * which is why nobody took one.
 *
 * Half a unit value a kill on top of what the kills themselves dropped: the
 * contract makes the hunting it points at worth about half as much again, which
 * is enough to follow and not enough to make undirected fighting a mistake.
 * `game-audit.mjs` prints it beside a session's net at the same tier.
 */
export function contractPurse(tier: number, required: number): ContractPurse {
  return {
    coins: Math.round(required * tierValue(tier) * 0.5),
    stones: Math.max(1, Math.round(required / 15)),
    stoneItemId: `stone:${STONE_KINDS[tier % STONE_KINDS.length]}:${tier}`,
    xp: processingXp(tier) * 4,
  };
}

/**
 * Where a contract's target actually lives.
 *
 * The contract's one job is to say "go here next", and it named a monster
 * without naming a place: the row stored the biome and no screen read it. The
 * area numbers come from the same roster the fight draws from, so the answer
 * cannot disagree with where the kills will count.
 */
export function contractAreas(variantName: string, biomeIndex: number): number[] {
  const biome = BIOME_BY_INDEX.get(biomeIndex);
  if (!biome) return [];
  return areasIn(biome)
    .filter((area) => area.roster.some((v) => v.name === variantName))
    .map((area) => area.index);
}

/* ------------------------------ the skill's uniques ------------------------ */

/** The uniques no boss gives up, which are therefore Slaying's to give. */
const LOOSE = UNIQUES.filter((u) => !u.source);

/**
 * One trinket a biome, named for the biome's own prefix.
 *
 * A ring or an amulet called "Brackish Vial" or "Rime Coldiron" was written for
 * every biome and sourced to nothing. The first contract finished in a biome
 * gives that biome's up — guaranteed, like a boss's signature and for the same
 * reason: a low roll on something you can attempt a few times a month is a tax.
 */
export const BIOME_TRINKET = new Map<number, Unique>(
  BIOMES.flatMap((b) => {
    const found = LOOSE.find(
      (u) => u.name.startsWith(`${b.prefix} `) && (u.slot === "ring" || u.slot === "amulet"),
    );
    return found ? [[b.index, found] as const] : [];
  }),
);

const TRINKETS = new Set(BIOME_TRINKET.values());

/** What is left: the named pieces a later contract can turn up. */
export const CONTRACT_UNIQUES = LOOSE.filter((u) => !TRINKETS.has(u));

export const CONTRACT_UNIQUE_CHANCE = 0.15;

/** The marker that makes a biome's trinket a first-time reward and never a second. */
export function trinketMarker(biomeIndex: number): string {
  return `contract:biome:${biomeIndex}`;
}

/**
 * A contract past the first in its biome may turn up one of the loose uniques,
 * never one deeper than the contract itself — a meadow contract does not hand
 * out a tier-24 blade.
 */
export function rollContractUnique(
  r: Rng,
  tier: number,
): { unique: Unique; percentile: number } | null {
  const eligible = CONTRACT_UNIQUES.filter((u) => u.tier <= tier);
  if (eligible.length === 0 || !r.chance(CONTRACT_UNIQUE_CHANCE)) return null;
  return { unique: eligible[r.int(0, eligible.length - 1)], percentile: r.next() };
}
