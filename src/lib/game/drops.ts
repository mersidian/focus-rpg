/**
 * What a kill actually gives you (SPEC-V2.md §7).
 *
 * Loot rarity comes from the MONSTER, never from your gear. A Legendary Fire
 * Drake drops Legendary-tier loot whether you killed it in steel or mythril —
 * gear works through access, conversion and throughput instead. That wiring is
 * deliberate: if gear boosted loot rarity, the optimal play would be full gear
 * in the easiest area, safe and fast and rich. Under this model the optimal play
 * is fighting the hardest thing you can reliably convert, which is where you
 * want the player.
 *
 * Parts are keyed to the species and biome materials to the biome, so a Rime
 * Wolf gives Wolf Pelt and Rime Salt. The variety is in the combination.
 */
import { QUALITIES, type Quality } from "./quality";
import type { Rng } from "./rng";
import { FAMILY_PARTS } from "./species";
import { sellPrice, tierValue } from "./economy";
import type { RarityDef } from "./combat";
import type { Variant } from "./variants";

export type Drop =
  | { kind: "item"; itemId: string; name: string; qty: number }
  | {
      kind: "equipment";
      itemId: string;
      slot: string;
      style: string;
      tier: number;
      quality: Quality;
      /** Band percentile, 0-1. The instance's rolled value is derived from it. */
      percentile: number;
    }
  | { kind: "coins"; amount: number };

/** How good a part a rarity gives up: commons give the cheap one. */
function partGrade(rarity: RarityDef, r: Rng): number {
  if (rarity.key === "common") return 0;
  if (rarity.key === "uncommon") return r.chance(0.3) ? 1 : 0;
  if (rarity.key === "elite") return r.chance(0.5) ? 1 : r.chance(0.4) ? 2 : 0;
  return r.chance(0.55) ? 2 : 1;
}

/** Equipment only falls from things worth fighting. */
const EQUIPMENT_CHANCE: Record<string, number> = {
  common: 0.02,
  uncommon: 0.05,
  elite: 0.14,
  rare: 0.3,
  legendary: 0.7,
};

const SLOT_POOL = [
  "weapon", "offhand", "head", "body", "legs", "boots", "gloves", "cape", "amulet", "ring",
];

export type DropInput = {
  variant: Variant;
  rarity: RarityDef;
  /** The style the player fought as; dropped gear favours it. */
  style: string;
  rng: Rng;
};

export function rollDrops(input: DropInput): Drop[] {
  const { variant, rarity, style, rng } = input;
  const out: Drop[] = [];
  const t = variant.tier;

  // A part, always. This is the reliable half of a kill.
  const grade = partGrade(rarity, rng);
  const suffix = FAMILY_PARTS[variant.species.family][grade];
  out.push({
    kind: "item",
    itemId: `part:${variant.species.name} ${suffix}`,
    name: `${variant.species.name} ${suffix}`,
    qty: 1 + (rarity.loot >= 6 ? rng.int(0, 2) : 0),
  });

  // A biome material, sometimes. This is what makes where you fought matter.
  if (rng.chance(0.45)) {
    const material = variant.biome.materials[rng.int(0, 2)];
    out.push({ kind: "item", itemId: `biome:${material}`, name: material, qty: 1 });
  }

  // Equipment, rarely, and its quality is rolled from the same table a
  // crafted item can never reach: quality above Plain is found, not made.
  if (rng.chance(EQUIPMENT_CHANCE[rarity.key] ?? 0)) {
    const slot = SLOT_POOL[rng.int(0, SLOT_POOL.length - 1)];
    const quality = rng.weighted(QUALITIES, (q) => q.weight);
    out.push({
      kind: "equipment",
      itemId: `${slot === "weapon" ? "weapon" : "armour"}:${style}:${slot}:${t}:${quality.key}`,
      slot,
      style,
      tier: t,
      quality: quality.key,
      percentile: rng.next(),
    });
  }

  // Coins scale with rarity, because a Legendary should be worth the trip even
  // when its table gives you nothing you needed.
  out.push({
    kind: "coins",
    amount: Math.max(1, Math.round(tierValue(t) * 0.25 * rarity.loot)),
  });

  return out;
}

/** What a whole session's spawns gave, folded into one list. */
export function foldDrops(drops: Drop[]): {
  items: Map<string, { name: string; qty: number }>;
  equipment: Extract<Drop, { kind: "equipment" }>[];
  coins: number;
} {
  const items = new Map<string, { name: string; qty: number }>();
  const equipment: Extract<Drop, { kind: "equipment" }>[] = [];
  let coins = 0;
  for (const drop of drops) {
    if (drop.kind === "coins") coins += drop.amount;
    else if (drop.kind === "equipment") equipment.push(drop);
    else {
      const prev = items.get(drop.itemId);
      if (prev) prev.qty += drop.qty;
      else items.set(drop.itemId, { name: drop.name, qty: drop.qty });
    }
  }
  return { items, equipment, coins };
}

/** What the auto-salvage rules do with a found piece, before it reaches the bank. */
export type SalvageRule = { salvageBelow: number; keepAbove: number };

export function salvageDecision(
  percentile: number,
  rule: SalvageRule,
): "keep" | "salvage" {
  const p = Math.round(percentile * 1000);
  if (p >= rule.keepAbove) return "keep";
  if (p < rule.salvageBelow) return "salvage";
  return "keep";
}

export function salvageValue(tierOf: number, percentile: number): number {
  return Math.max(1, Math.round(sellPrice(tierOf, "equipment") * (0.5 + percentile * 0.5)));
}
