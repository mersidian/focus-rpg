import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { equipmentInstances, worldProgress } from "./db/schema";
import { append, adjustWallet, loadWallet, have, type Grant } from "./inventory-service";
import { applyDelta } from "./game-state";
import { MAX_REFINE } from "./game/power";
import { refineCoinCost, refineStoneCost } from "./game/economy";
import { STONE_KINDS } from "./game/items";
import { FIRST_REFINE_TEN_XP, milestoneMarker } from "./game/milestones";

/**
 * Refinement, +1 to +10 (SPEC-V2.md §8).
 *
 * It never fails and it never downgrades, so the cost curve carries the whole
 * axis on its own: every item reaches +10 eventually, and the only thing
 * standing in the way is the bill. That is the trade the author chose, and it
 * means this service has no roll in it at all.
 *
 * Stones must match the item's material tier — a Copper Whetstone will not take
 * a Mythic weapon anywhere — and any of the three kinds will do, spent cheapest
 * first so a hoard of one kind is not stranded.
 */

export type RefineResult =
  | {
      ok: true;
      refine: number;
      stonesSpent: number;
      coinsSpent: number;
      /** Set when this was the first +10 at its tier (§11). */
      milestoneXp: number;
    }
  | { ok: false; missing: string[] };

function stoneIds(tier: number): string[] {
  return STONE_KINDS.map((kind) => `stone:${kind}:${tier}`);
}

export async function refineItem(userId: string, instanceId: string): Promise<RefineResult> {
  const [item] = await db
    .select()
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.id, instanceId), eq(equipmentInstances.userId, userId)))
    .limit(1);

  if (!item) return { ok: false, missing: ["that item"] };
  if (item.refine >= MAX_REFINE) {
    return { ok: false, missing: [`nothing — it is already +${MAX_REFINE}`] };
  }

  const step = item.refine + 1;
  const stonesNeeded = refineStoneCost(step);
  const coinsNeeded = refineCoinCost(step, item.tier);

  const ids = stoneIds(item.tier);
  const [held, wallet] = await Promise.all([have(userId, ids), loadWallet(userId)]);
  const stonesHeld = ids.reduce((n, id) => n + Math.max(0, held.get(id) ?? 0), 0);

  const missing: string[] = [];
  if (stonesHeld < stonesNeeded) {
    missing.push(`${stonesNeeded - stonesHeld} more tier ${item.tier} upgrade stones`);
  }
  if (wallet.coins < coinsNeeded) {
    missing.push(`${(coinsNeeded - wallet.coins).toLocaleString()} more coins`);
  }
  if (missing.length > 0) return { ok: false, missing };

  // Spend the stones, cheapest kind first, so one kind cannot be stranded.
  const grants: Grant[] = [];
  let left = stonesNeeded;
  for (const id of ids) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, held.get(id) ?? 0));
    if (take > 0) {
      grants.push({ itemId: id, delta: -take, reason: "refine_cost" });
      left -= take;
    }
  }
  await append(userId, grants);
  await adjustWallet(userId, { coins: -coinsNeeded });

  const [updated] = await db
    .update(equipmentInstances)
    .set({ refine: step })
    .where(and(eq(equipmentInstances.id, instanceId), eq(equipmentInstances.userId, userId)))
    .returning({ refine: equipmentInstances.refine });

  // The first +10 at a tier pays a lump. The marker is the record, so the
  // second +10 at that tier pays nothing — and `onConflictDoNothing` means a
  // double click cannot pay it twice either.
  let milestoneXp = 0;
  if ((updated?.refine ?? step) >= MAX_REFINE) {
    const marker = milestoneMarker("refine", item.tier);
    const created = await db
      .insert(worldProgress)
      .values({ userId, marker })
      .onConflictDoNothing()
      .returning({ marker: worldProgress.marker });
    if (created.length > 0) {
      await applyDelta(userId, null, `milestone:${marker}`, { xp: FIRST_REFINE_TEN_XP });
      milestoneXp = FIRST_REFINE_TEN_XP;
    }
  }

  return {
    ok: true,
    refine: updated?.refine ?? step,
    stonesSpent: stonesNeeded,
    coinsSpent: coinsNeeded,
    milestoneXp,
  };
}

/** What the next step would cost, for the button to say so before it is pressed. */
export async function refineQuote(
  userId: string,
  instanceId: string,
): Promise<{ step: number; stones: number; coins: number; stonesHeld: number; coins_held: number } | null> {
  const [item] = await db
    .select({ tier: equipmentInstances.tier, refine: equipmentInstances.refine })
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.id, instanceId), eq(equipmentInstances.userId, userId)))
    .limit(1);
  if (!item || item.refine >= MAX_REFINE) return null;

  const step = item.refine + 1;
  const ids = stoneIds(item.tier);
  const [held, wallet] = await Promise.all([have(userId, ids), loadWallet(userId)]);
  return {
    step,
    stones: refineStoneCost(step),
    coins: refineCoinCost(step, item.tier),
    stonesHeld: ids.reduce((n, id) => n + Math.max(0, held.get(id) ?? 0), 0),
    coins_held: wallet.coins,
  };
}
