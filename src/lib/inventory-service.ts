import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  collectionLog,
  equipmentInstances,
  inventoryBalances,
  inventoryEntries,
  wallets,
} from "./db/schema";
import { BANK_SLOTS_BASE, FUEL_CAP_BASE } from "./game/economy";

/**
 * The inventory ledger, and the balances folded out of it (SPEC-V2.md §10.1).
 *
 * **The ledger is truth.** `inventory_entry` is append-only: a grant is a
 * positive row, a spend is a negative one, and nothing is ever updated or
 * deleted. `inventory_balance` is a cache of the fold, exactly as `game_state`
 * is a cache of `focus_session`.
 *
 * That relationship decides the WRITE ORDER, and it is not incidental. The
 * Neon HTTP driver has no interactive transaction, so a write is a sequence:
 *
 *   1. append to the ledger
 *   2. update the balance cache
 *   3. update the collection log
 *
 * If the process dies between 1 and 2 the cache is stale, and `rebuild()` fixes
 * it from the ledger. If the order were reversed, a crash would leave a balance
 * no ledger row justifies — a quantity nobody can audit, which is the exact
 * failure the append-only design exists to prevent. Stale is recoverable;
 * fabricated is not.
 */

export type LedgerReason = typeof inventoryEntries.$inferSelect["reason"];

export type Grant = {
  itemId: string;
  delta: number;
  reason: LedgerReason;
  sessionId?: string | null;
  /** For the collection log, when a found item had a band percentile. */
  percentile?: number;
};

/** The next sequence number for a user. Monotonic, and gapless enough to replay. */
async function nextSeq(userId: string): Promise<number> {
  const [row] = await db
    .select({ seq: inventoryEntries.seq })
    .from(inventoryEntries)
    .where(eq(inventoryEntries.userId, userId))
    .orderBy(desc(inventoryEntries.seq))
    .limit(1);
  return (row?.seq ?? 0) + 1;
}

/**
 * Append to the ledger and fold forward.
 *
 * Zero deltas are dropped rather than stored: a row that changes nothing is
 * noise in a table whose whole value is that every row means something.
 */
export async function append(userId: string, grants: Grant[]): Promise<void> {
  const real = grants.filter((g) => g.delta !== 0);
  if (real.length === 0) return;

  let seq = await nextSeq(userId);
  await db.insert(inventoryEntries).values(
    real.map((g) => ({
      userId,
      itemId: g.itemId,
      delta: g.delta,
      reason: g.reason,
      sessionId: g.sessionId ?? null,
      seq: seq++,
    })),
  );
  const throughSeq = seq - 1;

  // Fold. One statement per item, because the deltas for one item must sum
  // rather than clobber each other.
  const summed = new Map<string, number>();
  for (const g of real) summed.set(g.itemId, (summed.get(g.itemId) ?? 0) + g.delta);

  for (const [itemId, delta] of summed) {
    await db
      .insert(inventoryBalances)
      .values({ userId, itemId, qty: delta, throughSeq })
      .onConflictDoUpdate({
        target: [inventoryBalances.userId, inventoryBalances.itemId],
        set: {
          qty: sql`${inventoryBalances.qty} + ${delta}`,
          throughSeq,
        },
      });
  }

  // The collection log records what was ever obtained, never what is held, so
  // only grants touch it and selling never erases anything.
  for (const g of real.filter((x) => x.delta > 0)) {
    const roll = Math.round(Math.min(1, Math.max(0, g.percentile ?? 0)) * 1000);
    await db
      .insert(collectionLog)
      .values({ userId, itemId: g.itemId, bestRoll: roll, seen: g.delta })
      .onConflictDoUpdate({
        target: [collectionLog.userId, collectionLog.itemId],
        set: {
          seen: sql`${collectionLog.seen} + ${g.delta}`,
          bestRoll: sql`greatest(${collectionLog.bestRoll}, ${roll})`,
        },
      });
  }
}

export async function balances(userId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ itemId: inventoryBalances.itemId, qty: inventoryBalances.qty })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.userId, userId));
  return new Map(rows.filter((r) => r.qty !== 0).map((r) => [r.itemId, r.qty]));
}

export async function have(userId: string, itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db
    .select({ itemId: inventoryBalances.itemId, qty: inventoryBalances.qty })
    .from(inventoryBalances)
    .where(and(eq(inventoryBalances.userId, userId), inArray(inventoryBalances.itemId, itemIds)));
  return new Map(rows.map((r) => [r.itemId, r.qty]));
}

/**
 * Refold every balance from the ledger.
 *
 * This is what `db:recompute` calls, and the reason the ledger is shaped the way
 * it is: a bug in a spend rule is fixed by correcting the rule and replaying,
 * not by hand-editing quantities.
 */
export async function rebuild(userId: string): Promise<{ items: number; entries: number }> {
  const rows = await db
    .select({ itemId: inventoryEntries.itemId, delta: inventoryEntries.delta, seq: inventoryEntries.seq })
    .from(inventoryEntries)
    .where(eq(inventoryEntries.userId, userId))
    .orderBy(inventoryEntries.seq);

  const folded = new Map<string, number>();
  let throughSeq = 0;
  for (const row of rows) {
    folded.set(row.itemId, (folded.get(row.itemId) ?? 0) + row.delta);
    throughSeq = Math.max(throughSeq, row.seq);
  }

  await db.delete(inventoryBalances).where(eq(inventoryBalances.userId, userId));
  const values = [...folded.entries()].map(([itemId, qty]) => ({ userId, itemId, qty, throughSeq }));
  if (values.length > 0) await db.insert(inventoryBalances).values(values);

  return { items: values.length, entries: rows.length };
}

/* --------------------------------- wallet --------------------------------- */

export type Wallet = typeof wallets.$inferSelect;

export async function loadWallet(userId: string): Promise<Wallet> {
  const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(wallets)
    .values({ userId, fuelCap: FUEL_CAP_BASE, bankSlots: BANK_SLOTS_BASE })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1))[0];
}

/**
 * Move coins and fuel.
 *
 * Fuel is CAPPED rather than decaying (§2): fuel earned at cap is simply not
 * granted. It is not lost and it does not overflow into anything — converting
 * it to coins would pay coins for focusing, and collapse the rule that keeps the
 * two currencies distinct.
 */
export async function adjustWallet(
  userId: string,
  delta: { coins?: number; fuel?: number },
): Promise<Wallet> {
  const wallet = await loadWallet(userId);
  const coins = Math.max(0, wallet.coins + (delta.coins ?? 0));
  const fuel = Math.min(wallet.fuelCap, Math.max(0, wallet.fuel + (delta.fuel ?? 0)));
  const [row] = await db
    .update(wallets)
    .set({ coins, fuel, version: wallet.version + 1 })
    .where(eq(wallets.userId, userId))
    .returning();
  return row;
}

/** How many bank slots are in use: one per distinct stack, one per instance. */
export async function bankUsage(userId: string): Promise<{ used: number; slots: number }> {
  const wallet = await loadWallet(userId);
  const [stacks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inventoryBalances)
    .where(and(eq(inventoryBalances.userId, userId), sql`${inventoryBalances.qty} > 0`));
  const [instances] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.userId, userId), sql`${equipmentInstances.equippedSlot} is null`));
  return { used: (stacks?.n ?? 0) + (instances?.n ?? 0), slots: wallet.bankSlots };
}
