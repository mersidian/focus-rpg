import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { equipmentInstances, focusSessions } from "./db/schema";
import { adjustWallet, loadWallet } from "./inventory-service";
import { repairCost } from "./game/economy";
import { GUN_ENTRY_TIER } from "./game/tiers";

/**
 * Wearing things, and mending them (SPEC-V2.md §8).
 *
 * ## Why a live session blocks this
 *
 * The loadout is read at RESOLUTION, not at the start. So swapping gear while a
 * session runs would let you pass the requirement gate in one set and fight the
 * whole session in another — and it would silently change a fight already
 * underway, which is worse than refusing.
 *
 * Refusing is the honest answer, and it is refused with a reason rather than a
 * disabled button that does not say why.
 */

export type EquipResult = { ok: true; slot: string } | { ok: false; reason: string };

async function sessionIsLive(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: focusSessions.id })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.status, ["active", "paused", "awaiting_report"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function equipItem(userId: string, instanceId: string): Promise<EquipResult> {
  if (await sessionIsLive(userId)) {
    return {
      ok: false,
      reason: "Not while a session is running — the loadout is read when it resolves.",
    };
  }

  const [item] = await db
    .select()
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.id, instanceId), eq(equipmentInstances.userId, userId)))
    .limit(1);
  if (!item) return { ok: false, reason: "No such item." };
  if (item.equippedSlot) return { ok: false, reason: "Already worn." };
  if (item.style === "gun" && item.tier < GUN_ENTRY_TIER) {
    return { ok: false, reason: `Firearms start at tier ${GUN_ENTRY_TIER}.` };
  }

  // One item per slot: the unique index enforces it, so the old one comes off
  // first rather than the insert failing.
  await db
    .update(equipmentInstances)
    .set({ equippedSlot: null })
    .where(and(eq(equipmentInstances.userId, userId), eq(equipmentInstances.equippedSlot, item.slot)));

  // A two-handed weapon forgoes the offhand, which is its entire cost.
  if (item.slot === "weapon" && item.archetype) {
    const { ARCHETYPE_BY_NAME } = await import("./game/archetypes");
    if (ARCHETYPE_BY_NAME.get(item.archetype)?.hands === 2) {
      await db
        .update(equipmentInstances)
        .set({ equippedSlot: null })
        .where(
          and(eq(equipmentInstances.userId, userId), eq(equipmentInstances.equippedSlot, "offhand")),
        );
    }
  }

  await db
    .update(equipmentInstances)
    .set({ equippedSlot: item.slot })
    .where(eq(equipmentInstances.id, instanceId));

  return { ok: true, slot: item.slot };
}

export async function unequipSlot(userId: string, slot: string): Promise<EquipResult> {
  if (await sessionIsLive(userId)) {
    return {
      ok: false,
      reason: "Not while a session is running — the loadout is read when it resolves.",
    };
  }
  await db
    .update(equipmentInstances)
    .set({ equippedSlot: null })
    .where(and(eq(equipmentInstances.userId, userId), eq(equipmentInstances.equippedSlot, slot)));
  return { ok: true, slot };
}

export type RepairResult =
  | { ok: true; repaired: number; coinsSpent: number }
  | { ok: false; reason: string };

/**
 * Mend everything Worn, in one go.
 *
 * Repairing item by item is the chore this design refuses to have, so there is
 * one button and it does the lot. If the coins run short it mends what it can,
 * cheapest first, rather than refusing outright — a partial repair is useful and
 * an all-or-nothing one is just a wall.
 */
export async function repairAll(userId: string): Promise<RepairResult> {
  const worn = await db
    .select({ id: equipmentInstances.id, tier: equipmentInstances.tier })
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.userId, userId), sql`${equipmentInstances.durability} < 100`))
    .orderBy(equipmentInstances.tier);
  if (worn.length === 0) return { ok: false, reason: "Nothing needs mending." };

  const wallet = await loadWallet(userId);
  let spent = 0;
  const mend: string[] = [];
  for (const item of worn) {
    const cost = repairCost(item.tier);
    if (spent + cost > wallet.coins) break;
    spent += cost;
    mend.push(item.id);
  }
  if (mend.length === 0) {
    return { ok: false, reason: `Not enough coins — the cheapest repair is ${repairCost(worn[0].tier)}.` };
  }

  await db
    .update(equipmentInstances)
    .set({ durability: 100 })
    .where(and(eq(equipmentInstances.userId, userId), inArray(equipmentInstances.id, mend)));
  await adjustWallet(userId, { coins: -spent });
  return { ok: true, repaired: mend.length, coinsSpent: spent };
}

/** Spare gear, for the equipment screen's pick lists. */
export async function spareFor(userId: string, slot: string) {
  return db
    .select()
    .from(equipmentInstances)
    .where(
      and(
        eq(equipmentInstances.userId, userId),
        eq(equipmentInstances.slot, slot),
        isNull(equipmentInstances.equippedSlot),
      ),
    )
    .orderBy(sql`${equipmentInstances.tier} desc, ${equipmentInstances.rolled} desc`)
    .limit(30);
}
