/**
 * Hue for kind, accent for standing — an amendment to §8.
 *
 * §8 says nothing but the earned accent may be saturated, and everything the
 * game section drew obeyed it: tier, rarity, level and progress were all one
 * hue at twenty-four dilutions. That is right for all of them, because every
 * one of those is a *quantity* — more of it is more of what you earned, and
 * the accent is the colour of what you earned.
 *
 * Class is not a quantity. An arrow is not more or less than a ration, and a
 * ramp cannot say so; a page of ore, hides, cloth and cartridges came out as
 * one grey list because the only colour in the system encoded a thing none of
 * those rows differ in. Categorical data wants categorical colour. That is not
 * decoration, it is the same argument §8 makes, applied to the axis §8 does
 * not cover.
 *
 * Three rules keep it honest, and they are what stop this becoming a second
 * palette competing with the first:
 *
 *   One lightness. Every hue below sits at 0.72, so no class can look more
 *   important than another — only different from it.
 *
 *   Chroma 0.10, under ACTION_FLOOR's 0.11. The primary action, the focus ring
 *   and the current tab are always at least as saturated as any category mark,
 *   so a control can never lose a shouting match with a label.
 *
 *   Kind only. Nothing here may encode how much, how deep, how far along or
 *   how good. Those are the accent's, and the accent stays the only thing in
 *   the app that grows.
 */

const LIGHT = 0.72;
/** Deliberately below ACTION_FLOOR in format.ts. A label never out-inks a control. */
const CHROMA = 0.1;

function kind(hue: number, chroma = CHROMA): string {
  return `oklch(${LIGHT} ${chroma} ${hue})`;
}

/**
 * The eleven item classes, spaced about thirty degrees apart.
 *
 * Ordered by where a thing sits in the game's own loop rather than by hue —
 * you gather raw, refine it, make a tool or a weapon, wear armour, and spend
 * consumables — so neighbours in the list are neighbours on the wheel and the
 * bank reads as a gradient when it is sorted by class.
 */
export const CLASS_HUE: Record<string, string> = {
  raw: kind(55),
  refined: kind(212),
  biomeMaterial: kind(185),
  part: kind(318),
  tool: kind(88),
  weapon: kind(25),
  armour: kind(248),
  ammo: kind(350),
  consumable: kind(155),
  stone: kind(285),
  seed: kind(128),
};

/** Anything the catalogue grows later, until someone gives it a hue. */
export const CLASS_FALLBACK = "var(--color-dim)";

export function classHue(cls: string): string {
  return CLASS_HUE[cls] ?? CLASS_FALLBACK;
}

/**
 * The three kinds of skill, which is the only grouping the skills page has and
 * the one it never showed: twenty-two rows under three headings, where the
 * heading was the only thing saying which was which.
 */
export const SKILL_KIND_HUE: Record<string, string> = {
  gathering: kind(145),
  combat: kind(25),
  processing: kind(212),
};

export function skillKindHue(k: string): string {
  return SKILL_KIND_HUE[k] ?? CLASS_FALLBACK;
}

/**
 * Rarity, in the colours every player of anything already knows.
 *
 * Common keeps almost no chroma on purpose: the commonest thing in the game
 * should not be the one drawing the eye, and the ladder upward should feel
 * like colour arriving.
 */
export const RARITY_HUE: Record<string, string> = {
  common: `oklch(0.66 0.012 268)`,
  uncommon: kind(145),
  elite: kind(248),
  rare: kind(300),
  legendary: kind(70, 0.12),
};

export function rarityHue(r: string): string {
  return RARITY_HUE[r] ?? CLASS_FALLBACK;
}

/** The same hue at the weight of a surface rather than a mark. */
export function wash(colour: string, percent = 16): string {
  return `color-mix(in oklch, ${colour} ${percent}%, var(--color-lift))`;
}
