/**
 * Prestige (SPEC.md §4.2).
 *
 * The one genuine either/or left in the design: at level 50 you may reset to
 * Drifter I and take a star, or press on and climb to names no prestige player
 * ever sees. Achievements, lifetime hours and the whole history survive either
 * way — only the level and the XP that drives it go back to zero.
 */

/** Sage V. Deliberately not level 100, which nobody would ever see (§4.2). */
export const PRESTIGE_LEVEL = 50;
export const MAX_STARS = 10;
export const XP_BONUS_PER_STAR = 0.05;
export const MAX_XP_BONUS = 0.5;

export type PrestigeState = {
  stars: number;
  /** When the current cycle began. */
  cycleStartedAt: number;
  /** When this cycle first hit level 50, if it has. */
  reachedFiftyAt: number | null;
  /** When the user chose to press on instead, if they did. */
  declinedAt: number | null;
};

/** Permanent XP bonus from stars, capped at +50% (§4.2). */
export function xpMultiplier(stars: number): number {
  return 1 + Math.min(stars * XP_BONUS_PER_STAR, MAX_XP_BONUS);
}

export function bonusPercent(stars: number): number {
  return Math.round((xpMultiplier(stars) - 1) * 100);
}

/** Session XP after the prestige bonus. */
export function applyBonus(baseXp: number, stars: number): number {
  return Math.round(baseXp * xpMultiplier(stars));
}

/**
 * `★3 Adept II`. At zero stars the title is just the title — the mark is the
 * point, so it should not appear before it has been earned.
 */
export function decorateTitle(title: string, stars: number): string {
  return stars > 0 ? `★${stars} ${title}` : title;
}

export type PrestigeOffer =
  | { available: false; reason: "below_gate" | "already_decided" }
  | { available: true; starsAfter: number; bonusAfter: number };

/**
 * Whether the choice is live. It is offered once per cycle: pressing on records
 * the decision so the app stops asking, and the offer returns only after the
 * next reset carries you back to fifty.
 */
export function prestigeOffer(level: number, state: PrestigeState): PrestigeOffer {
  if (level < PRESTIGE_LEVEL) return { available: false, reason: "below_gate" };
  if (state.declinedAt !== null) return { available: false, reason: "already_decided" };
  const starsAfter = Math.min(state.stars + 1, MAX_STARS);
  return { available: true, starsAfter, bonusAfter: bonusPercent(starsAfter) };
}

/** The exclusive title at ten stars (§4.2). */
export const ETERNAL_RECURRENCE = "Eternal Recurrence";

export function hasEternalRecurrence(stars: number): boolean {
  return stars >= MAX_STARS;
}
