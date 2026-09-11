/**
 * The requirement gate (SPEC-V2.md §7).
 *
 * Binary, checked before the timer starts, and it never rolls. If you cannot go,
 * the activity is not selectable and the gate says exactly what is missing — a
 * shopping list, not a refusal.
 *
 * This is why the activity is chosen BEFORE a session and not after: a gate
 * evaluated afterwards would be checking rations after the fight, and would let
 * a session be claimed as combat once its roll was known.
 *
 * One rule holds the whole thing together: **a gate is a tier number.** Nothing
 * — not handedness, not an archetype, not a quality — may move what a gate
 * requires, or the greyed-out list starts lying about what you are missing.
 */
import type { BiomeKey } from "./biomes";
import { acceptableWards, type Ward } from "./potions";
import type { Quality } from "./quality";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export type Requirement = {
  /** Skill and the level of it. */
  skill?: { key: string; level: number };
  /** Minimum equipped tier across the loadout. */
  equipmentTier?: number;
  /** Minimum tool tier, for gathering. */
  toolTier?: number;
  /** Rations that must be carried, and are spent on entry. */
  rations?: number;
  /**
   * A ward potion the biome's hazard demands, spent on entry (§15.4).
   *
   * This is what finally puts contents inside §7's already-decided but empty
   * "consumables spent on entry" clause — and the only thing that gives Alchemy
   * a customer.
   */
  ward?: { ward: string; step: number; qty: number };
  /** A key item, found elsewhere. */
  keyItem?: BiomeKey;
  /** V1 character level, the one seam into the shipped ladder. */
  characterLevel?: number;
};

export type GateState = {
  skills: Record<string, number>;
  equipmentTier: number;
  toolTier: Record<string, number>;
  /**
   * The grade of the best tool held for a skill, which the GATE never reads.
   *
   * "A gate is a tier number" is the rule directly above, and grade is exactly
   * the sort of thing that would quietly break it. It rides here because the
   * same query already walks the tools, and it is consumed by `resolveYield`
   * and nowhere else: a fine pickaxe digs more out of the same rock, it does
   * not open a rock that was shut.
   */
  toolGrade: Record<string, Quality>;
  rations: number;
  /** Potion holdings by item id, so a ward requirement can be checked. */
  potions: Map<string, number>;
  keyItems: BiomeKey[];
  characterLevel: number;
};

export type GateResult = {
  open: boolean;
  /** Human-readable, in the order a player would fix them. */
  missing: string[];
};

const KEY_LABEL: Record<BiomeKey, string> = {
  sulphurAndSaltpetre: "sulphur and saltpetre from Ashfall Ridge",
  rimeworksCipher: "a Rimeworks cipher from the Sunken Cathedral",
  voidscarSigil: "a Voidscar sigil",
};

export function checkGate(req: Requirement, state: GateState, skillLabel = (k: string) => k): GateResult {
  const missing: string[] = [];

  if (req.characterLevel && state.characterLevel < req.characterLevel) {
    missing.push(`character level ${req.characterLevel}`);
  }
  if (req.skill) {
    const have = state.skills[req.skill.key] ?? 1;
    if (have < req.skill.level) {
      missing.push(`${skillLabel(req.skill.key)} ${req.skill.level}`);
    }
  }
  if (req.toolTier && req.skill) {
    const have = state.toolTier[req.skill.key] ?? 0;
    if (have < req.toolTier) missing.push(`a tier ${req.toolTier} tool`);
  }
  if (req.equipmentTier && state.equipmentTier < req.equipmentTier) {
    missing.push(`tier ${req.equipmentTier} equipment`);
  }
  if (req.rations && state.rations < req.rations) {
    missing.push(`${req.rations} rations (you have ${state.rations})`);
  }
  if (req.ward) {
    const accepted = acceptableWards(req.ward.ward as Ward, req.ward.step);
    const held = accepted.reduce((n, id) => n + (state.potions.get(id) ?? 0), 0);
    if (held < req.ward.qty) {
      missing.push(
        `${req.ward.qty} × ${req.ward.ward} ${ROMAN[req.ward.step - 1] ?? req.ward.step}` +
          (held > 0 ? ` (you have ${held})` : ""),
      );
    }
  }
  if (req.keyItem && !state.keyItems.includes(req.keyItem)) {
    missing.push(KEY_LABEL[req.keyItem]);
  }

  return { open: missing.length === 0, missing };
}
