/**
 * The 22 skills and their curves (SPEC-V2.md §6).
 *
 * Three kinds, and the kind decides where XP comes from. Gathering and combat
 * skills earn from focused minutes, because the session IS the action.
 * Processing skills earn per action paid for with fuel, so their XP is priced
 * off the tier of what was made — otherwise a skill you never spend a session on
 * could never level at all.
 *
 * Curve: cumulative XP to reach level L is `A x L^2.4`, fitted so that a
 * favoured gathering skill reaches 99 at about 600 focused hours on that skill.
 * Level 2 arrives in three minutes and level 50 at ~116 h, which is the shape
 * the character ladder already uses — fast at the bottom, a monument at the top.
 *
 * Twenty-two skills at 600 h each is 13,200 hours, so nobody maxes everything.
 * That is deliberate, and it is why there is no achievement for doing so.
 */

export type SkillKind = "gathering" | "combat" | "processing";

export type Skill = {
  key: string;
  label: string;
  kind: SkillKind;
  /** For processing skills, what it turns into what. */
  note: string;
};

export const SKILLS: Skill[] = [
  { key: "woodcutting", label: "Woodcutting", kind: "gathering", note: "logs" },
  { key: "fishing", label: "Fishing", kind: "gathering", note: "fish" },
  { key: "mining", label: "Mining", kind: "gathering", note: "ore, gems, essence, sulphur" },
  { key: "foraging", label: "Foraging", kind: "gathering", note: "herbs, silk, fibre" },
  { key: "hunting", label: "Hunting", kind: "gathering", note: "hides, bone, sinew" },
  { key: "excavation", label: "Excavation", kind: "gathering", note: "relics and artefacts" },

  { key: "melee", label: "Melee", kind: "combat", note: "melee-style kills" },
  { key: "ranged", label: "Ranged", kind: "combat", note: "ranged-style kills" },
  { key: "magic", label: "Magic", kind: "combat", note: "magic-style kills" },
  { key: "gunplay", label: "Gunplay", kind: "combat", note: "firearm kills" },
  { key: "slaying", label: "Slaying", kind: "combat", note: "contract targets" },

  { key: "firemaking", label: "Firemaking", kind: "processing", note: "logs to charcoal" },
  { key: "smelting", label: "Smelting", kind: "processing", note: "ore and charcoal to bars" },
  { key: "smithing", label: "Smithing", kind: "processing", note: "bars to plate and tools" },
  { key: "leatherworking", label: "Leatherworking", kind: "processing", note: "hides to leather and hide armour" },
  { key: "fletching", label: "Fletching", kind: "processing", note: "logs to planks, bows, arrows" },
  { key: "tailoring", label: "Tailoring", kind: "processing", note: "fibre to cloth and robes" },
  { key: "cooking", label: "Cooking", kind: "processing", note: "fish and meat to rations" },
  { key: "alchemy", label: "Alchemy", kind: "processing", note: "herbs to potions" },
  { key: "runecrafting", label: "Runecrafting", kind: "processing", note: "essence to runes" },
  { key: "jewelcrafting", label: "Jewelcrafting", kind: "processing", note: "gems to rings and amulets" },
  { key: "gunsmithing", label: "Gunsmithing", kind: "processing", note: "gunpowder to cartridges and firearms" },
];

export const SKILL_BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));
export const MAX_SKILL_LEVEL = 99;

/** Fitted so level 99 costs ~36,000 XP, which is 600 focused hours. */
const CURVE_A = 0.583;
const CURVE_P = 2.4;

/** Cumulative XP required to have reached a level. Level 1 is free. */
export const SKILL_XP: number[] = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) =>
  i === 0 ? 0 : Math.round(CURVE_A * Math.pow(i + 1, CURVE_P)),
);

export function skillLevel(xp: number): number {
  const capped = Math.max(0, xp);
  let level = 1;
  for (let i = 0; i < SKILL_XP.length; i++) {
    if (capped >= SKILL_XP[i]) level = i + 1;
    else break;
  }
  return level;
}

export function skillFloorXp(level: number): number {
  return SKILL_XP[Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1];
}

/** XP for the next level, or null at 99. */
export function skillNextXp(level: number): number | null {
  return level < MAX_SKILL_LEVEL ? SKILL_XP[level] : null;
}

/**
 * The skill level that gates a material tier. Tier 1 is open, tier 24 wants a
 * maxed skill — so the last tier of anything is the end of a skill's own road,
 * not a step on it.
 */
export function tierSkillRequirement(t: number): number {
  const clamped = Math.min(Math.max(Math.trunc(t), 1), 24);
  if (clamped === 1) return 1;
  return Math.max(1, Math.round(MAX_SKILL_LEVEL * Math.pow((clamped - 1) / 23, 1.2)));
}

/** A processing action's XP, priced off the tier of what was made. */
export function processingXp(t: number): number {
  return Math.round(6 * Math.pow(1.2, Math.max(0, t - 1)));
}
