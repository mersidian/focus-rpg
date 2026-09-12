import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { equipmentInstances, skillStates, worldProgress } from "./db/schema";
import {
  append,
  adjustWallet,
  bankUsage,
  have,
  loadWallet,
  logCollected,
  type Grant,
} from "./inventory-service";
import { applyDelta, loadState } from "./game-state";
import { allRecipes, canCraft, type Recipe } from "./game/recipes";
import { skillLevel } from "./game/skills";
import { milestoneMarker, skillLevelXp, skillMilestonesCrossed } from "./game/milestones";
import { band, type ItemSpec, type Slot } from "./game/power";
import { ARCHETYPE_BY_NAME, type Style } from "./game/archetypes";
import type { Quality } from "./game/quality";
import { MAX_CRAFT_AT_ONCE } from "./constants";

/**
 * Crafting: spend fuel and inputs, get an output (SPEC-V2.md §4).
 *
 * Fuel is what pays for all of it, and that is fuel's entire job — every
 * *meaningful* action is a session, and fuel covers the trivia that should never
 * cost twenty-five real minutes.
 *
 * Crafted equipment always lands at Plain quality. Quality above that is found,
 * never made, which is what keeps a dropped item worth something in a game where
 * you can build anything you have the materials for.
 */

const RECIPES = new Map(allRecipes().map((r) => [r.id, r]));

export type CraftResult =
  | {
      ok: true;
      made: string;
      times: number;
      fuelSpent: number;
      xp: number;
      milestones: { label: string; xp: number }[];
    }
  | { ok: false; missing: string[] };

/** Whether a slot exists for a stack or an instance that does not exist yet. */
async function hasRoom(userId: string, itemId: string, stackable: boolean): Promise<boolean> {
  const usage = await bankUsage(userId);
  if (usage.used < usage.slots) return true;
  if (!stackable) return false;
  // A stack that already exists takes no new slot.
  const held = await have(userId, [itemId]);
  return (held.get(itemId) ?? 0) > 0;
}

export async function craftItem(
  userId: string,
  recipeId: string,
  times = 1,
): Promise<CraftResult> {
  const recipe = RECIPES.get(recipeId);
  if (!recipe) return { ok: false, missing: ["that recipe"] };

  const runs = Math.max(1, Math.min(MAX_CRAFT_AT_ONCE, Math.trunc(times)));
  const [held, wallet, levelRow, state] = await Promise.all([
    have(userId, recipe.inputs.map((i) => i.itemId)),
    loadWallet(userId),
    db
      .select({ xp: skillStates.xp })
      .from(skillStates)
      .where(and(eq(skillStates.userId, userId), eq(skillStates.skill, recipe.skill)))
      .limit(1),
    // The character level, because the skill itself is gated on it. Checked
    // here and not only on the page: a server action is reachable without one.
    loadState(userId),
  ]);
  const level = skillLevel(levelRow[0]?.xp ?? 0);

  // Gated the same way an area is: binary, and it names what is short.
  const scaled: Recipe = {
    ...recipe,
    fuel: recipe.fuel * runs,
    inputs: recipe.inputs.map((i) => ({ ...i, qty: i.qty * runs })),
  };
  const check = canCraft(scaled, (id) => held.get(id) ?? 0, wallet.fuel, {
    skill: level,
    character: state.level,
  });
  if (!check.ok) return { ok: false, missing: check.missing };

  const makesEquipment =
    recipe.outputId.startsWith("armour:") || recipe.outputId.startsWith("weapon:");

  if (!(await hasRoom(userId, recipe.outputId, !makesEquipment))) {
    return { ok: false, missing: ["a free bank slot"] };
  }

  const grants: Grant[] = scaled.inputs.map((i) => ({
    itemId: i.itemId,
    delta: -i.qty,
    reason: "craft_input",
  }));

  if (makesEquipment) {
    // Equipment is an instance, not a stack: it needs a rolled value, and a
    // crafted one rolls at the centre of its band rather than being lucky.
    const [, ...rest] = recipe.outputId.split(":");
    const isWeapon = recipe.outputId.startsWith("weapon:");
    const spec: ItemSpec = isWeapon
      ? {
          slot: "weapon",
          style: (ARCHETYPE_BY_NAME.get(rest[0])?.style ?? "melee") as Style,
          tier: Number(rest[1]),
          quality: rest[2] as Quality,
          refine: 0,
          archetype: ARCHETYPE_BY_NAME.get(rest[0]),
        }
      : {
          slot: rest[1] as Slot,
          style: rest[0] as Style,
          tier: Number(rest[2]),
          quality: rest[3] as Quality,
          refine: 0,
        };
    const { centre } = band(spec);
    for (let n = 0; n < runs; n++) {
      await db.insert(equipmentInstances).values({
        userId,
        itemId: recipe.outputId,
        slot: spec.slot,
        style: spec.style,
        tier: spec.tier,
        quality: spec.quality,
        archetype: spec.archetype?.name ?? null,
        rolled: Math.round(centre * 1000),
      });
    }
  } else {
    grants.push({
      itemId: recipe.outputId,
      delta: recipe.outputQty * runs,
      reason: "craft_output",
    });
  }

  await append(userId, grants);
  if (makesEquipment) {
    // An instance never passes through the ledger, so the log is written
    // directly. Crafted gear rolls at its band centre, which is the 50th
    // percentile — quality above Plain is found, not made.
    await logCollected(userId, recipe.outputId, 0.5);
  }
  await adjustWallet(userId, { fuel: -scaled.fuel });

  const xp = recipe.xp * runs;
  const [updated] = await db
    .insert(skillStates)
    .values({ userId, skill: recipe.skill, xp })
    .onConflictDoUpdate({
      target: [skillStates.userId, skillStates.skill],
      set: { xp: sql`${skillStates.xp} + ${xp}` },
    })
    .returning({ xp: skillStates.xp });

  const after = skillLevel(updated?.xp ?? xp);
  const before = skillLevel(Math.max(0, (updated?.xp ?? xp) - xp));
  const milestones: { label: string; xp: number }[] = [];
  for (const crossed of skillMilestonesCrossed(before, after)) {
    const marker = milestoneMarker("skill", recipe.skill, crossed);
    const created = await db
      .insert(worldProgress)
      .values({ userId, marker })
      .onConflictDoNothing()
      .returning({ marker: worldProgress.marker });
    if (created.length > 0) {
      await applyDelta(userId, null, `milestone:${marker}`, { xp: skillLevelXp(crossed) });
      milestones.push({ label: `${recipe.skill} ${crossed}`, xp: skillLevelXp(crossed) });
    }
  }

  return {
    ok: true,
    made: recipe.outputName,
    times: runs,
    fuelSpent: scaled.fuel,
    xp,
    milestones,
  };
}

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.get(id);
}
