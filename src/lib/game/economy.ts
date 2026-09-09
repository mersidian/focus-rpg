/**
 * Prices, fuel and the sinks (SPEC-V2.md §2, §9).
 *
 * Everything is priced off one curve, so a tier's whole economy moves together
 * and no class of item can drift out of line with the rest:
 *
 *     V(T) = round(10 x 1.20^(T-1))
 *
 * which runs 10 coins at tier 1 to 662 at tier 24. The same 1.20 per tier as the
 * power curve, so value and strength climb at one rate.
 */
import { tier } from "./tiers";
import type { Style } from "./archetypes";

/** The value of one unit of tier-T raw material, in coins. */
export function tierValue(t: number): number {
  return Math.round(10 * Math.pow(1.2, Math.min(Math.max(Math.trunc(t), 1), 24) - 1));
}

/** What the shop pays for a thing, by class. Selling is always below buying. */
export const SELL_MULTIPLIER: Record<string, number> = {
  raw: 1,
  part: 1.4,
  refined: 2.6,
  consumable: 2,
  equipment: 9,
  unique: 40,
};

export function sellPrice(t: number, cls: keyof typeof SELL_MULTIPLIER | string): number {
  return Math.max(1, Math.round(tierValue(t) * (SELL_MULTIPLIER[cls] ?? 1) * 0.4));
}

export function buyPrice(t: number, cls: keyof typeof SELL_MULTIPLIER | string): number {
  return Math.max(1, Math.round(tierValue(t) * (SELL_MULTIPLIER[cls] ?? 1)));
}

/* --------------------------------- fuel ---------------------------------- */

/** Fuel a completed session pays, by length. Longer sessions pay proportionally. */
export const FUEL_BY_LENGTH: Record<number, number> = { 15: 12, 25: 20, 50: 48 };

export const FUEL_CAP_BASE = 500;
export const FUEL_CAP_MAX = 2000;
export const FUEL_CAP_STEP = 250;

/** Coins to raise the fuel cap by one step, escalating. */
export function fuelCapCost(step: number): number {
  return Math.round(9000 * Math.pow(1.85, Math.max(0, step)));
}

/** Fuel to process one unit at a tier. Cheap early, real later. */
export function processFuelCost(t: number): number {
  return Math.max(1, Math.round(1.6 * Math.pow(1.14, Math.max(0, t - 1))));
}

/* ------------------------------ refinement ------------------------------- */

/** Upgrade stones for the step from `level - 1` to `level`. */
export function refineStoneCost(level: number): number {
  return Math.ceil(Math.pow(Math.min(Math.max(level, 1), 10), 1.6));
}

/** Coins for that same step, scaled by the item's tier. */
export function refineCoinCost(level: number, t: number): number {
  return Math.round(tierValue(t) * Math.pow(Math.min(Math.max(level, 1), 10), 2) * 3);
}

/** Everything it takes to walk an item from +0 to +10. */
export function refineTotal(t: number): { stones: number; coins: number } {
  let stones = 0;
  let coins = 0;
  for (let l = 1; l <= 10; l++) {
    stones += refineStoneCost(l);
    coins += refineCoinCost(l, t);
  }
  return { stones, coins };
}

/**
 * Refinement never fails and never downgrades, so the cost curve carries the
 * entire axis. That is the trade recorded in §8: every item reaches +10
 * eventually, and what stands between you and it is only ever the bill.
 */
export const REFINE_ALWAYS_SUCCEEDS = true;

/* -------------------------------- upkeep --------------------------------- */

/** Ammunition per shot, by style. Melee pays nothing; guns pay most. */
export const AMMO_COST: Record<Style, number> = {
  melee: 0,
  ranged: 0.35,
  magic: 0.8,
  gun: 2.2,
};

export function ammoUnitPrice(t: number, style: Style): number {
  return Math.max(1, Math.round(tierValue(t) * AMMO_COST[style] * 0.3));
}

/** A ration, eaten by a failed kill. */
export function rationPrice(t: number): number {
  return Math.max(1, Math.round(tierValue(t) * 0.5));
}

/** Coins to bring one Worn item back, by tier. */
export function repairCost(t: number): number {
  return Math.max(2, Math.round(tierValue(t) * 1.5));
}

/* ------------------------------ bank slots ------------------------------- */

export const BANK_SLOTS_BASE = 60;
export const BANK_SLOTS_MAX = 1500;

/**
 * The largest coin sink in the game, and the reason late-game income has
 * somewhere to go. Priced per block of ten so the shop is not a thousand
 * identical purchases.
 */
export const BANK_SLOT_BLOCK = 10;

/**
 * Polynomial, not exponential.
 *
 * The first version compounded at 11% a block and the audit priced the walk from
 * 60 slots to 1,500 at twelve BILLION coins — a sink so deep it is not a goal,
 * it is a wall with a number painted on it. A 1.35 power curve puts the same
 * walk near twenty million: still comfortably the largest sink in the game, and
 * still years of play, but a thing a player can see the end of.
 */
export function bankSlotCost(slotsOwned: number): number {
  const blocks = Math.max(0, Math.floor((slotsOwned - BANK_SLOTS_BASE) / BANK_SLOT_BLOCK));
  return Math.round(400 * Math.pow(1 + blocks, 1.35));
}

/** What it costs to go from 60 slots to the 1,500 cap. */
export function bankSlotsTotalCost(): number {
  let total = 0;
  for (let s = BANK_SLOTS_BASE; s < BANK_SLOTS_MAX; s += BANK_SLOT_BLOCK) {
    total += bankSlotCost(s);
  }
  return total;
}

/** Salvage pays stones instead of coins, downward-only (SPEC-V2.md §15.5). */
export function salvageStones(t: number, targetTier: number): number {
  if (targetTier > t) return 0;
  const drop = t - targetTier;
  return Math.max(1, Math.round((tier(t).power / tier(targetTier).power) * Math.pow(0.82, drop)));
}
