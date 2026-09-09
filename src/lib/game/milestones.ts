/**
 * What the game pays into V1's ladder (SPEC-V2.md §11).
 *
 * Beyond the per-minute rate, the game's own progress pays character XP in
 * lumps. This does not breach *"XP comes only from sessions the server timed"*:
 * a skill level and a biome unlock both advance only from timed sessions, so
 * milestone XP still derives entirely from timed focus — it is merely paid in
 * lumps rather than per minute.
 *
 * ## The budget, and why it is small
 *
 * The ladder runs to about **600,000 XP** — Mythic V *is* ten thousand focused
 * hours. V1 keeps its 131 achievements to ~27,000 XP, under 5% of that, on the
 * grounds that they must stay a garnish rather than a second income. The same
 * ceiling applies here, and it is the whole reason not every skill level pays:
 *
 * Twenty-two skills at 99 is **2,178 level-ups**. Paying each one enough to feel
 * like anything would run to hundreds of thousands of XP and turn the ladder
 * into a by-product of the game. Paying each one within budget would mean ~15 XP
 * a level, which is less than a fifteen-minute session and therefore not a
 * moment at all.
 *
 * So only six levels a skill pay, and they pay properly. The whole set comes to
 * roughly **37,000 XP**, about 6% of the ladder and in line with V1's
 * achievements.
 *
 * Accepted consequence, already recorded in §11: **Mythic V arrives sooner than
 * 10,000 literal focused hours.** V1 was already like this — achievements pay XP
 * — so the ten-thousand figure was always the shape of the curve rather than a
 * promise about the clock.
 */
import { MAX_TIER } from "./tiers";

/** The only skill levels that pay. Six a skill, 132 in all. */
export const SKILL_MILESTONE_LEVELS = [10, 25, 50, 75, 90, 99] as const;

const SKILL_MILESTONE_XP: Record<number, number> = {
  10: 20,
  25: 50,
  50: 130,
  75: 260,
  90: 380,
  99: 520,
};

/** Zero for a level that is not a milestone, which is most of them. */
export function skillLevelXp(level: number): number {
  return SKILL_MILESTONE_XP[level] ?? 0;
}

export function isSkillMilestone(level: number): boolean {
  return skillLevelXp(level) > 0;
}

/**
 * Every milestone level crossed by going from `from` to `to`.
 *
 * A single session can carry a skill through more than one — a 50-minute
 * session on a low-level skill can jump several levels at once — so this
 * returns all of them rather than only the level landed on.
 */
export function skillMilestonesCrossed(from: number, to: number): number[] {
  if (to <= from) return [];
  return SKILL_MILESTONE_LEVELS.filter((level) => level > from && level <= to);
}

/** A whole biome opening up. Twenty of them. */
export const BIOME_UNLOCK_XP = 250;

/** The first +10 in a material tier. Twenty-four of them, and the smallest lump. */
export const FIRST_REFINE_TEN_XP = 100;

/** What the whole set is worth, for arguing with the budget above. */
export function milestoneBudget(skills: number): number {
  const perSkill = SKILL_MILESTONE_LEVELS.reduce((n, l) => n + skillLevelXp(l), 0);
  return perSkill * skills + BIOME_UNLOCK_XP * 20 + FIRST_REFINE_TEN_XP * MAX_TIER;
}

export type MilestoneKind = "skill" | "biome" | "refine";

/**
 * The `world_progress` marker that records a milestone as paid.
 *
 * `applyDelta` does not deduplicate by reason — the reason it takes is for the
 * audit row — so idempotency lives here instead: the marker is inserted with
 * `onConflictDoNothing`, and the XP is only paid when the insert actually
 * created a row. A milestone that fires twice is a bug that inflates the ladder
 * silently, which is the worst shape a bug can take in this app.
 */
export function milestoneMarker(kind: MilestoneKind, key: string | number, at?: number): string {
  return at === undefined ? `milestone:${kind}:${key}` : `milestone:${kind}:${key}:${at}`;
}

export function milestoneLabel(kind: MilestoneKind, key: string, at?: number): string {
  if (kind === "skill") return `${key} ${at}`;
  if (kind === "biome") return `${key} opened`;
  return `first +10 at tier ${at ?? key}`;
}
