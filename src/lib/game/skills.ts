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
  /**
   * The character level that opens this skill (SPEC-V2.md §11, seam one).
   *
   * "Skills gate on character level, so V1's 100-level ladder acquires a new
   * meaning without being touched" was decided and then not built: `Skill` had
   * no such field and nothing asked for one, so all twenty-two were open from
   * the first minute. That is the shape CLAUDE.md keeps naming — a cost written
   * down that nothing charges.
   *
   * It does two jobs. It gives V1's ladder a consequence inside the game, which
   * is the only reason §11 exists. And it is the answer to twenty-two skills,
   * 2,178 recipes and 8,568 items arriving at once: five skills open at level 1,
   * which is a game you can hold in your head, and the rest arrive at a pace a
   * player sets by focusing.
   *
   * Every unlock is paid in focused minutes and nothing else, so no unlock can
   * deadlock — there is no material, no coin and no other skill standing in
   * front of it. That is the property that makes this safe to put in the gate,
   * and `tests/game.test.ts` holds it along with the ordering below.
   */
  unlock: number;
};

export const SKILLS: Skill[] = [
  { key: "woodcutting", label: "Woodcutting", kind: "gathering", note: "logs", unlock: 1 },
  { key: "fishing", label: "Fishing", kind: "gathering", note: "fish", unlock: 5 },
  { key: "mining", label: "Mining", kind: "gathering", note: "ore, gems, essence, sulphur", unlock: 1 },
  { key: "foraging", label: "Foraging", kind: "gathering", note: "herbs, silk, fibre", unlock: 3 },
  { key: "hunting", label: "Hunting", kind: "gathering", note: "hides, bone, sinew", unlock: 7 },
  { key: "excavation", label: "Excavation", kind: "gathering", note: "relics and artefacts", unlock: 12 },

  /*
   * Combat skills are open from the start because none of them is a thing you
   * choose. You pick an AREA, and an area already asks for a character level of
   * its own — `requirementFor` sets one at roughly 1.5x the area's tier. Gating
   * the style on top would be the same wall twice, and the second one would be
   * invisible: nothing in the picker names a combat skill.
   */
  { key: "melee", label: "Melee", kind: "combat", note: "melee-style kills", unlock: 1 },
  { key: "ranged", label: "Ranged", kind: "combat", note: "ranged-style kills", unlock: 1 },
  { key: "magic", label: "Magic", kind: "combat", note: "magic-style kills", unlock: 1 },
  { key: "gunplay", label: "Gunplay", kind: "combat", note: "firearm kills", unlock: 1 },
  { key: "slaying", label: "Slaying", kind: "combat", note: "contract targets", unlock: 1 },

  /*
   * Processing opens behind the gathering skill that feeds it, never in front
   * of it — a skill that unlocks with nothing to make is the `AMMO_COST`
   * mistake wearing a different hat. The test walks every recipe to prove it:
   * each skill has at least one it can actually run the minute it opens.
   */
  { key: "firemaking", label: "Firemaking", kind: "processing", note: "logs to charcoal", unlock: 1 },
  { key: "smelting", label: "Smelting", kind: "processing", note: "ore and charcoal to bars", unlock: 1 },
  { key: "smithing", label: "Smithing", kind: "processing", note: "bars to plate and tools", unlock: 2 },
  { key: "leatherworking", label: "Leatherworking", kind: "processing", note: "hides to leather and hide armour", unlock: 9 },
  { key: "fletching", label: "Fletching", kind: "processing", note: "logs to planks, bows, arrows", unlock: 8 },
  { key: "tailoring", label: "Tailoring", kind: "processing", note: "fibre to cloth and robes", unlock: 10 },
  { key: "cooking", label: "Cooking", kind: "processing", note: "fish and meat to rations", unlock: 6 },
  { key: "alchemy", label: "Alchemy", kind: "processing", note: "herbs to potions", unlock: 11 },
  { key: "runecrafting", label: "Runecrafting", kind: "processing", note: "essence to runes", unlock: 14 },
  { key: "jewelcrafting", label: "Jewelcrafting", kind: "processing", note: "gems to rings and amulets, relics to stones", unlock: 16 },
  { key: "gunsmithing", label: "Gunsmithing", kind: "processing", note: "gunpowder to cartridges and firearms", unlock: 20 },
];

/**
 * The character level that opens a skill. Unknown keys are open, because a gate
 * that shuts on a typo is worse than one that misses one.
 */
export function skillUnlock(key: string): number {
  return SKILL_BY_KEY.get(key)?.unlock ?? 1;
}

/** Which skills a character of this level may use. */
export function skillsOpenAt(characterLevel: number): Skill[] {
  return SKILLS.filter((s) => s.unlock <= characterLevel);
}

/**
 * The next skill to arrive, and the level it arrives at. Null once they are all
 * open — which is the honest answer, not a sixth copy of "maxed".
 */
export function nextSkillUnlock(characterLevel: number): Skill | null {
  return (
    SKILLS.filter((s) => s.unlock > characterLevel).sort((a, b) => a.unlock - b.unlock)[0] ?? null
  );
}

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
