/**
 * What an activity asks for before it will let you in (SPEC-V2.md §7).
 *
 * Pure, and moved out of `activity-service` for two reasons. It is a rule, and
 * CLAUDE.md says rules have no database of their own. And it is the rule that
 * deadlocked a fresh account — every activity closed with no way through —
 * which no test could catch while it sat behind a `server-only` import.
 */
import { BIOME_BY_INDEX } from "./biomes";
import { bossesIn } from "./bosses";
import { hazardOf, wardTierFor } from "./potions";
import { skillUnlock, tierSkillRequirement } from "./skills";
import { areasIn } from "./variants";
import type { Requirement } from "./gate";
import type { Activity } from "./activity";

export function requirementFor(activity: Activity): Requirement {
  if (activity.kind === "gathering") {
    return {
      /*
       * The skill has to be open before its tiers mean anything (SPEC-V2.md
       * §11). This is the one requirement on the list that cannot be shopped
       * for, traded for or crafted around: it is paid in focused minutes, which
       * is the only currency this app actually mints.
       */
      characterLevel: skillUnlock(activity.skill),
      skill: { key: activity.skill, level: tierSkillRequirement(activity.tier) },
      /*
       * A tool reaches one tier past itself, and that is what makes the ladder
       * climbable without ever opening the shop.
       *
       * Asking for a tool of the same tier is a circular dependency at every
       * rung: bronze ore wants a bronze pickaxe, a bronze pickaxe wants a
       * bronze bar, and a bronze bar wants bronze ore. The shop was the only
       * way out of that loop, which made a convenience into a requirement.
       *
       * The deadlock was already found once, at the bottom, and patched with a
       * special case — "tier 1 needs no tool: a rock and a stick" — without
       * noticing it repeated all the way up. And `offers` has always built
       * gathering up to `bestTool + 1`, so the offer list carried exactly one
       * row the gate could never open. This is the gate agreeing with the list
       * that was already being shown.
       *
       * The skill requirement is untouched, and it is the real pacing: tier 3
       * still wants level 5, tier 12 level 41. What this removes is a materials
       * deadlock, not a difficulty curve.
       */
      toolTier: activity.tier > 1 ? activity.tier - 1 : undefined,
    };
  }

  const biome = BIOME_BY_INDEX.get(activity.biome);

  const hazard = biome ? hazardOf(biome) : null;
  const ward = hazard
    ? { ward: hazard.ward, step: wardTierFor(biome!.tierLo), qty: hazard.qty }
    : undefined;

  if (activity.kind === "boss") {
    const boss = bossesIn(activity.biome).find((b) => b.role === activity.role);
    const t = boss?.tier ?? 1;
    // A boss wants a full set AT its tier, not one below: it is the wall that
    // says come back better, and it should read that way in the gate.
    return {
      equipmentTier: t,
      rations: Math.max(2, Math.round(t / 3)),
      // A boss stands deeper in its biome, so it wants more of the ward.
      ward: ward ? { ...ward, qty: ward.qty + 1 } : undefined,
      keyItem: biome?.keyItem ?? undefined,
      characterLevel: Math.max(1, Math.round(t * 1.8)),
    };
  }

  const area = biome ? areasIn(biome)[activity.area - 1] : undefined;
  const t = area?.tier ?? 1;
  return {
    // Tiers 1-2 ask for no gear. `equipmentTier` is zero until all ten slots are
    // filled, so asking for any of it in the tutorial biome made combat
    // unreachable until ten pieces existed — and those needed materials that
    // needed gathering that needed the tool nobody could buy.
    equipmentTier: t <= 2 ? undefined : Math.max(1, t - 1),
    rations: Math.max(1, Math.round(t / 4)),
    ward,
    keyItem: biome?.keyItem ?? undefined,
    characterLevel: Math.max(1, Math.round(t * 1.5)),
  };
}
