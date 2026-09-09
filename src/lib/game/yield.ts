/**
 * Gathering, resolved from timed minutes (SPEC-V2.md §3).
 *
 * The session IS the action, so minutes are the only input. Everything else —
 * tool tier above the requirement, skill level above it, the session chain — is
 * a multiplier on what those minutes produce, never a substitute for them.
 *
 * Deeper resources are worth more per unit rather than arriving in greater
 * numbers: a tier-20 ore is one ore, and it is worth what tier 20 is worth.
 * Otherwise late-game sessions would bury the bank in volume.
 */
import { tierValue } from "./economy";
import type { Rng } from "./rng";
import { tierSkillRequirement } from "./skills";
import { emptyModifiers, type Modifiers } from "./effects";

/** Units a minute at parity, before any bonus. A 25-minute session is ~12. */
export const BASE_UNITS_PER_MINUTE = 0.5;
/** Each tool tier above the requirement. */
export const TOOL_TIER_BONUS = 0.08;
/** Each skill level above the requirement, capped so it cannot run away. */
export const SKILL_LEVEL_BONUS = 0.004;
export const MAX_SKILL_BONUS = 0.4;

export type YieldInput = {
  focusedMs: number;
  /** The resource's tier. */
  tier: number;
  toolTier: number;
  skillLevel: number;
  /** From `chain.ts`; 1 when no links stand behind the session. */
  chainMultiplier: number;
  /** Folded from equipped uniques (`effects.ts`). */
  modifiers?: Modifiers;
  rng: Rng;
};

export type YieldResult = {
  units: number;
  /** Skill XP, which is focused minutes for a gathering skill. */
  skillXp: number;
  /** What the haul is worth if sold, for the session summary. */
  coinValue: number;
  /** The multiplier that was applied, so the summary can explain itself. */
  multiplier: number;
};

export function resolveYield(input: YieldInput): YieldResult {
  const minutes = input.focusedMs / 60_000;
  const required = tierSkillRequirement(input.tier);

  const toolAbove = Math.max(0, input.toolTier - input.tier);
  const skillAbove = Math.max(0, input.skillLevel - required);

  const mods = input.modifiers ?? emptyModifiers();
  const multiplier =
    (1 + toolAbove * TOOL_TIER_BONUS) *
    (1 + Math.min(MAX_SKILL_BONUS, skillAbove * SKILL_LEVEL_BONUS)) *
    (1 + mods.yieldPct / 100) *
    input.chainMultiplier;

  const expected = minutes * BASE_UNITS_PER_MINUTE * multiplier;
  // The fraction is a coin flip rather than a rounding, so short sessions are
  // not systematically robbed of it.
  const whole = Math.floor(expected);
  const units = whole + (input.rng.next() < expected - whole ? 1 : 0);

  return {
    units,
    skillXp: Math.round(minutes * (1 + mods.skillXpPct / 100)),
    coinValue: units * tierValue(input.tier),
    multiplier,
  };
}
