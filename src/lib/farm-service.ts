import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { farmPlots, skillStates } from "./db/schema";
import { append, adjustWallet, bankUsage, have, loadWallet } from "./inventory-service";
import {
  CROP_OUTPUT,
  MAX_PLOTS,
  STARTING_PLOTS,
  cropOutputId,
  growthStages,
  harvestYield,
  plotCost,
  seedLine,
} from "./game/farm";
import { processingXp } from "./game/skills";

/**
 * Plots: buy one, sow it, harvest it.
 *
 * Nothing here reads a clock. `stagesLeft` is decremented by session resolution
 * (`activity-service`), so a plot advances because you worked — which is the only
 * reason Farming is allowed to exist in an app that forbids idle progression.
 *
 * A mature plot does not spoil, and there is no penalty for leaving it. This app
 * does not punish absence.
 */

export type FarmResult = { ok: true; note: string } | { ok: false; reason: string };

async function plotsOf(userId: string) {
  return db
    .select()
    .from(farmPlots)
    .where(eq(farmPlots.userId, userId))
    .orderBy(farmPlots.slot);
}

/** The first four are free; the rest are a coin sink. */
export async function ensurePlots(userId: string): Promise<void> {
  const existing = await plotsOf(userId);
  if (existing.length > 0) return;
  await db.insert(farmPlots).values(
    Array.from({ length: STARTING_PLOTS }, (_, i) => ({ userId, slot: i + 1, stagesLeft: 0 })),
  );
}

export async function buyPlot(userId: string): Promise<FarmResult> {
  await ensurePlots(userId);
  const owned = (await plotsOf(userId)).length;
  if (owned >= MAX_PLOTS) return { ok: false, reason: `Already at the ${MAX_PLOTS}-plot cap.` };

  const cost = plotCost(owned);
  const wallet = await loadWallet(userId);
  if (wallet.coins < cost) {
    return { ok: false, reason: `${(cost - wallet.coins).toLocaleString()} coins short.` };
  }
  await db.insert(farmPlots).values({ userId, slot: owned + 1, stagesLeft: 0 });
  await adjustWallet(userId, { coins: -cost });
  return { ok: true, note: `Plot ${owned + 1} broken for ${cost.toLocaleString()} coins.` };
}

export async function sowPlot(
  userId: string,
  slot: number,
  seedItemId: string,
): Promise<FarmResult> {
  await ensurePlots(userId);
  const [plot] = await db
    .select()
    .from(farmPlots)
    .where(and(eq(farmPlots.userId, userId), eq(farmPlots.slot, slot)))
    .limit(1);
  if (!plot) return { ok: false, reason: "No such plot." };
  if (plot.seedItemId) return { ok: false, reason: "Something is already growing there." };

  const line = seedLine(seedItemId);
  if (!line || !CROP_OUTPUT[line]) return { ok: false, reason: "That is not a seed." };

  const held = await have(userId, [seedItemId]);
  if ((held.get(seedItemId) ?? 0) < 1) return { ok: false, reason: "You have none of those." };

  const tier = Number(seedItemId.split(":")[2] ?? 1);
  await append(userId, [{ itemId: seedItemId, delta: -1, reason: "consumed" }]);
  await db
    .update(farmPlots)
    .set({ seedItemId, stagesLeft: growthStages(tier), plantedAt: new Date() })
    .where(and(eq(farmPlots.userId, userId), eq(farmPlots.slot, slot)));

  return {
    ok: true,
    note: `Sown. ${growthStages(tier)} completed sessions until it is ready — any activity counts.`,
  };
}

export async function harvestPlot(userId: string, slot: number): Promise<FarmResult> {
  const [plot] = await db
    .select()
    .from(farmPlots)
    .where(and(eq(farmPlots.userId, userId), eq(farmPlots.slot, slot)))
    .limit(1);
  if (!plot || !plot.seedItemId) return { ok: false, reason: "Nothing sown there." };
  if (plot.stagesLeft > 0) {
    return {
      ok: false,
      reason: `${plot.stagesLeft} more completed session${plot.stagesLeft === 1 ? "" : "s"}.`,
    };
  }

  const tier = Number(plot.seedItemId.split(":")[2] ?? 1);
  const outputId = cropOutputId(plot.seedItemId, tier);
  if (!outputId) return { ok: false, reason: "That crop grows nothing." };

  const usage = await bankUsage(userId);
  const held = await have(userId, [outputId]);
  if ((held.get(outputId) ?? 0) === 0 && usage.used >= usage.slots) {
    return { ok: false, reason: "The bank is full — the crop keeps until there is room." };
  }

  const qty = harvestYield(tier);
  await append(userId, [{ itemId: outputId, delta: qty, reason: "session_yield" }]);
  await db
    .update(farmPlots)
    .set({ seedItemId: null, stagesLeft: 0, plantedAt: null })
    .where(and(eq(farmPlots.userId, userId), eq(farmPlots.slot, slot)));

  const xp = processingXp(tier);
  await db
    .insert(skillStates)
    .values({ userId, skill: "farming", xp })
    .onConflictDoUpdate({
      target: [skillStates.userId, skillStates.skill],
      set: { xp: sql`${skillStates.xp} + ${xp}` },
    });

  return { ok: true, note: `Harvested ${qty}.` };
}

/** Seeds on hand, for the sow picker. */
export async function seedsHeld(userId: string) {
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'seed:%' and qty > 0`);
  return rows.map((r) => ({
    itemId: String(r.itemId),
    qty: Number(r.qty),
    line: seedLine(String(r.itemId)) ?? "?",
    tier: Number(String(r.itemId).split(":")[2] ?? 1),
  }));
}
