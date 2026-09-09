/**
 * Farming (SPEC-V2.md §6).
 *
 * The one skill that had to be adapted rather than adopted, because it is
 * inherently clock-driven and this app has no clock but your focus. Plots
 * advance **one stage per completed session**, whatever that session was doing —
 * never per real hour.
 *
 * That is also what stops it being "the same thing but slower": Farming is the
 * only skill that is not an activity you can choose, so it competes for patience
 * and plot slots rather than for session time. And it is the only source of some
 * materials — above tier 8 cloth is farm-only, which finally gives Magic's
 * armour a real source line.
 */
import { tierValue } from "./economy";
import { MAX_TIER } from "./tiers";

export const STARTING_PLOTS = 4;
export const MAX_PLOTS = 12;

/** Sessions to maturity: 2 at tier 1, 30 at tier 24. */
export function growthStages(tier: number): number {
  const t = Math.min(Math.max(Math.trunc(tier), 1), MAX_TIER);
  return Math.round(2 + ((t - 1) / (MAX_TIER - 1)) * 28);
}

/** What one mature plot gives back. Less than a session, and it cost none. */
export function harvestYield(tier: number): number {
  return 3 + Math.floor(tier / 4);
}

/** Coins for the next plot, escalating. Another sink, and a small one. */
export function plotCost(owned: number): number {
  return Math.round(2_000 * Math.pow(1.6, Math.max(0, owned - STARTING_PLOTS)));
}

/** Which line a seed belongs to, read off its generated id. */
export function seedLine(seedItemId: string): string | null {
  const parts = seedItemId.split(":");
  return parts[0] === "seed" ? parts[1] : null;
}

/**
 * What a line's seed grows into.
 *
 * Each is something the wild cannot supply, which is the whole reason the line
 * exists: hardwood a tier above anything choppable, guaranteed-tier hides where
 * Hunting's roll, and the cloth ladder above tier 8.
 */
export const CROP_OUTPUT: Record<string, { itemLine: string; tierBonus: number; note: string }> = {
  Herb: { itemLine: "raw:Herb", tierBonus: 0, note: "reliable, rather than whatever biome you visited" },
  Fibre: { itemLine: "raw:Fibre", tierBonus: 0, note: "above tier 8 this is the only source" },
  Sapling: { itemLine: "raw:Log", tierBonus: 1, note: "a tier above anything choppable" },
  Stock: { itemLine: "raw:Hide", tierBonus: 0, note: "guaranteed tier, where Hunting rolls" },
};

export function cropOutputId(seedItemId: string, tier: number): string | null {
  const line = seedLine(seedItemId);
  if (!line) return null;
  const crop = CROP_OUTPUT[line];
  if (!crop) return null;
  return `${crop.itemLine}:${Math.min(MAX_TIER, tier + crop.tierBonus)}`;
}

/** A harvest is worth roughly a short session's gathering, for the same tier. */
export function harvestValue(tier: number): number {
  return harvestYield(tier) * tierValue(tier);
}
