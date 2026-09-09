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
import { BIOMES } from "./biomes";
import { rng } from "./rng";
import { variantsIn } from "./variants";

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
