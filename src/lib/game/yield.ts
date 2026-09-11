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

/**
 * Gems per unit of ore, as a chance rolled per unit.
 *
 * Mining's note has always said "ore, gems, essence, sulphur" and a mining
 * session produced ore. Gem was declared as a mining line in the catalogue and
 * runecrafting was written to consume it, so the only skill that could not be
 * started was the one whose input nothing produced — twenty-four refining
 * recipes and the twenty-four rune recipes downstream of them, unreachable.
 *
 * A quarter is not arbitrary, and the figure is measured rather than guessed: a
 * fifty-minute mine at tier 12 turns up 25 ore and 6.1 gems, which refine to
 * 6.1 essence and make 61 runes — and magic spends one rune a kill against the
 * ~104 kills a fifty-minute fight lands. So mining your own ammunition covers
 * about six tenths of your fighting.
 *
 * That is deliberately short of self-sufficiency. Runes can also be bought, so
 * the gem line is the cheaper-but-slower path rather than the only one, which
 * is the shape every other upkeep line in the game already has. `game-audit`
 * prints the rate, because a number that decides an economy should not live
 * only in a comment.
 */
export const BYPRODUCT_PER_UNIT = 0.25;

/**
 * What a gathering session turns up besides its main line, and how often.
 *
 * Declared here rather than inside the resolver so a test can ask the question
 * "is every recipe input obtainable" without importing a database module — the
 * question that would have caught runecrafting before it shipped.
 *
 * Both lines existed in the catalogue and in a recipe before anything produced
 * them. Mining's note has always read "ore, gems, essence, sulphur" and mining
 * gave ore; Cooking's has always read "fish and meat to rations" and there was
 * no meat in the game at all. The rate is per unit of the main line, so a
 * better tool digs more ore and therefore more chances at a gem — the tool
 * bonus compounding once rather than squared.
 */
export const BYPRODUCT: Record<string, { line: string; per: number }> = {
  mining: { line: "Gem", per: BYPRODUCT_PER_UNIT },
  hunting: { line: "Meat", per: BYPRODUCT_PER_UNIT },
};

export type YieldInput = {
  focusedMs: number;
  /** Which gathering skill is working; only mining has a byproduct. */
  skill?: string;
  /** The resource's tier. */
  tier: number;
  toolTier: number;
  /**
   * The grade of that tool, as its quality window.
   *
   * Three grades of every tool existed for as long as the game did and nothing
   * read one, so a Crude and a Fine pickaxe were the same pickaxe at the same
   * price. This is the one thing grade moves, and it is deliberately not the
   * gate: `gate.ts` says a gate is a tier number, so a better tool digs more
   * out of the same rock rather than opening a rock that was shut.
   *
   * It reuses `QUALITIES.window` — the same 0.85 / 1.0 / 1.12 that shifts an
   * equipment stat band — because grade should mean one thing in this game, not
   * two.
   */
  toolWindow?: number;
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
  /**
   * The factors behind that multiplier, in the order they applied.
   *
   * `multiplier` alone could not explain itself — it is the product of four
   * things and the screen has to be able to name them. The house rule: a figure
   * that is the product of a multiplier has to show its parts.
   */
  parts: { label: string; factor: number }[];
  /** The units before the roll, so a lucky one reads as luck. */
  expected: number;
  /**
   * The second line this session turned up — gems from mining, meat from
   * hunting. Zero for the skills that have none.
   */
  byproduct: number;
};

export function resolveYield(input: YieldInput): YieldResult {
  const minutes = input.focusedMs / 60_000;
  const required = tierSkillRequirement(input.tier);

  const toolAbove = Math.max(0, input.toolTier - input.tier);
  const skillAbove = Math.max(0, input.skillLevel - required);

  const mods = input.modifiers ?? emptyModifiers();
  const parts = [
    { label: "a tool above the tier", factor: 1 + toolAbove * TOOL_TIER_BONUS },
    { label: "how good that tool is", factor: input.toolWindow ?? 1 },
    {
      label: "skill above the requirement",
      factor: 1 + Math.min(MAX_SKILL_BONUS, skillAbove * SKILL_LEVEL_BONUS),
    },
    { label: "what you are wearing", factor: 1 + mods.yieldPct / 100 },
    { label: "the chain", factor: input.chainMultiplier },
  ];
  const multiplier = parts.reduce((n, p) => n * p.factor, 1);

  const expected = minutes * BASE_UNITS_PER_MINUTE * multiplier;
  // The fraction is a coin flip rather than a rounding, so short sessions are
  // not systematically robbed of it.
  const whole = Math.floor(expected);
  const units = whole + (input.rng.next() < expected - whole ? 1 : 0);

  /*
   * Rolled per unit off the same seeded stream, so a recompute reproduces the
   * gems exactly as it reproduces the ore. The multiplier is deliberately not
   * applied twice: a better tool digs more ore, and more ore is more chances at
   * a gem, which is the bonus compounding once rather than squared.
   */
  let gems = 0;
  const byproduct = input.skill ? BYPRODUCT[input.skill] : undefined;
  if (byproduct) {
    for (let i = 0; i < units; i++) {
      if (input.rng.next() < byproduct.per) gems += 1;
    }
  }

  return {
    units,
    skillXp: Math.round(minutes * (1 + mods.skillXpPct / 100)),
    coinValue: units * tierValue(input.tier),
    multiplier,
    parts,
    expected,
    byproduct: gems,
  };
}
