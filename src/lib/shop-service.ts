import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { equipmentInstances, slayingContracts, skillStates, wallets } from "./db/schema";
import {
  append,
  adjustWallet,
  bankUsage,
  have,
  loadWallet,
  logCollected,
  type Grant,
} from "./inventory-service";
import {
  BANK_SLOTS_MAX,
  BANK_SLOT_BLOCK,
  FUEL_CAP_MAX,
  FUEL_CAP_STEP,
  bankSlotCost,
  buyPrice,
  fuelCapCost,
  sellPrice,
  FUEL_CAP_BASE,
} from "./game/economy";
import { generateCatalogue, STONE_KINDS } from "./game/items";
import { salvageStones } from "./game/economy";
import { percentile, type ItemSpec, type Slot } from "./game/power";
import type { Style } from "./game/archetypes";
import type { Quality } from "./game/quality";
import { skillLevel } from "./game/skills";
import { rollContract } from "./game/contracts";

/**
 * The shop, and the two things coins are really for (SPEC-V2.md §9).
 *
 * Buying and selling both happen here — coins only change hands in one place.
 * Prices are fixed and there is no market: a fluctuating economy is a
 * spreadsheet minigame, and watching a price chart is exactly the attention this
 * app exists to protect.
 */

const CATALOGUE = new Map(generateCatalogue().map((i) => [i.id, i]));

/** What the shop stocks. Everything else has to be made or found. */
const STOCKED = new Set(["tool", "ammo", "consumable", "stone", "seed"]);

export type ShopResult = { ok: true; note: string } | { ok: false; reason: string };

export async function buyStock(userId: string, itemId: string, qty = 1): Promise<ShopResult> {
  const def = CATALOGUE.get(itemId);
  if (!def) return { ok: false, reason: "The shop does not carry that." };
  if (!STOCKED.has(def.cls)) {
    return { ok: false, reason: `${def.name} has to be made or found, not bought.` };
  }

  const n = Math.max(1, Math.min(1000, Math.trunc(qty)));
  const unit = buyPrice(def.tier, def.cls);
  const cost = unit * n;
  const wallet = await loadWallet(userId);
  if (wallet.coins < cost) {
    return { ok: false, reason: `${(cost - wallet.coins).toLocaleString()} coins short.` };
  }

  const usage = await bankUsage(userId);
  const held = await have(userId, [itemId]);
  const needsSlot = (held.get(itemId) ?? 0) === 0 && !def.stackable === false;
  if (needsSlot && usage.used >= usage.slots) {
    return { ok: false, reason: "The bank is full." };
  }

  await append(userId, [{ itemId, delta: n, reason: "bought" }]);
  await adjustWallet(userId, { coins: -cost });
  return { ok: true, note: `${n} × ${def.name} for ${cost.toLocaleString()} coins.` };
}

export async function sellStack(userId: string, itemId: string, qty: number): Promise<ShopResult> {
  const def = CATALOGUE.get(itemId);
  const held = await have(userId, [itemId]);
  const owned = held.get(itemId) ?? 0;
  const n = Math.max(1, Math.min(owned, Math.trunc(qty)));
  if (owned <= 0) return { ok: false, reason: "You do not have any." };

  const unit = sellPrice(def?.tier ?? 1, def?.cls ?? "raw");
  const paid = unit * n;
  await append(userId, [{ itemId, delta: -n, reason: "sold" }]);
  await adjustWallet(userId, { coins: paid });
  return { ok: true, note: `Sold ${n} for ${paid.toLocaleString()} coins.` };
}

/**
 * Sell one piece of equipment.
 *
 * A worn item is refused rather than quietly taken off — selling the thing you
 * are wearing is almost always a misclick, and the requirement gate reads the
 * whole set, so an empty slot can close an area you could enter a moment ago.
 */
export async function sellInstance(userId: string, instanceId: string): Promise<ShopResult> {
  const [item] = await db
    .select()
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.id, instanceId), eq(equipmentInstances.userId, userId)))
    .limit(1);
  if (!item) return { ok: false, reason: "No such item." };
  if (item.equippedSlot) return { ok: false, reason: "Take it off first." };

  const spec: ItemSpec = {
    slot: item.slot as Slot,
    style: item.style as Style,
    tier: item.tier,
    quality: item.quality as Quality,
    refine: item.refine,
  };
  const roll = percentile(spec, item.rolled / 1000);
  // A better roll and a refinement are both worth something back.
  const paid = Math.round(
    sellPrice(item.tier, "equipment") * (0.6 + roll * 0.4) * (1 + item.refine * 0.08),
  );

  // The log keeps it: you found it, and selling it never unfinds it.
  await logCollected(userId, item.itemId, roll);
  await db.delete(equipmentInstances).where(eq(equipmentInstances.id, instanceId));
  await adjustWallet(userId, { coins: paid });
  return { ok: true, note: `Sold for ${paid.toLocaleString()} coins.` };
}

export async function buyBankSlots(userId: string): Promise<ShopResult> {
  const wallet = await loadWallet(userId);
  if (wallet.bankSlots >= BANK_SLOTS_MAX) {
    return { ok: false, reason: `Already at the ${BANK_SLOTS_MAX} cap.` };
  }
  const cost = bankSlotCost(wallet.bankSlots);
  if (wallet.coins < cost) {
    return { ok: false, reason: `${(cost - wallet.coins).toLocaleString()} coins short.` };
  }
  await db
    .update(wallets)
    .set({
      bankSlots: Math.min(BANK_SLOTS_MAX, wallet.bankSlots + BANK_SLOT_BLOCK),
      coins: wallet.coins - cost,
      version: wallet.version + 1,
    })
    .where(eq(wallets.userId, userId));
  return { ok: true, note: `+${BANK_SLOT_BLOCK} slots for ${cost.toLocaleString()} coins.` };
}

export async function buyFuelCap(userId: string): Promise<ShopResult> {
  const wallet = await loadWallet(userId);
  if (wallet.fuelCap >= FUEL_CAP_MAX) {
    return { ok: false, reason: `Already at the ${FUEL_CAP_MAX} cap.` };
  }
  const step = Math.max(0, Math.round((wallet.fuelCap - FUEL_CAP_BASE) / FUEL_CAP_STEP));
  const cost = fuelCapCost(step);
  if (wallet.coins < cost) {
    return { ok: false, reason: `${(cost - wallet.coins).toLocaleString()} coins short.` };
  }
  await db
    .update(wallets)
    .set({
      fuelCap: Math.min(FUEL_CAP_MAX, wallet.fuelCap + FUEL_CAP_STEP),
      coins: wallet.coins - cost,
      version: wallet.version + 1,
    })
    .where(eq(wallets.userId, userId));
  return { ok: true, note: `Fuel cap +${FUEL_CAP_STEP} for ${cost.toLocaleString()} coins.` };
}

/** What the shop will show, priced, and only what it actually stocks. */
export function shopStock(maxTier: number) {
  return [...CATALOGUE.values()]
    .filter((i) => STOCKED.has(i.cls) && i.tier <= maxTier)
    .map((i) => ({ ...i, price: buyPrice(i.tier, i.cls) }))
    .sort((a, b) => a.cls.localeCompare(b.cls) || a.tier - b.tier);
}

/**
 * The order the shop is stocked in, deliberately, and tools come first.
 *
 * `shopStock` sorts by class name, so `tool` sorted last and the page's
 * `slice(0, 80)` always landed on it: from tier 5 upward the shop showed zero
 * tools, permanently, while the activity picker, the hub and the areas page all
 * told the player a tool was the prerequisite for everything. At tier 20 it hid
 * 780 of 860 rows and said nothing.
 *
 * Alphabetical was never a decision — it was `localeCompare` standing in for
 * one. This is the decision: what you cannot play without, first. Grouping also
 * means a truncation can only ever hide the tail of one class rather than every
 * item of the last one, and each group carries its own total so the row count on
 * screen can be honest about it.
 */
export const SHOP_CLASS_ORDER = ["tool", "ammo", "consumable", "stone", "seed"] as const;

export type ShopGroup = {
  cls: (typeof SHOP_CLASS_ORDER)[number];
  items: ReturnType<typeof shopStock>;
  total: number;
};

export function shopGroups(maxTier: number, perClass = Infinity): ShopGroup[] {
  const stock = shopStock(maxTier);
  return SHOP_CLASS_ORDER.map((cls) => {
    const items = stock.filter((i) => i.cls === cls).sort((a, b) => a.tier - b.tier);
    return { cls, items: items.slice(0, perClass), total: items.length };
  }).filter((g) => g.total > 0);
}

/* ------------------------------ stone exchange ----------------------------- */

/**
 * Trade upgrade stones down a tier, never up.
 *
 * Downward-only is the whole point. Stones matched to a tier are what gate
 * refinement, so an upward exchange would let a hoard of tier-1 junk refine a
 * Mythic weapon and the cost curve — which carries the entire refinement axis,
 * since refinement never fails — would stop meaning anything.
 */
export async function exchangeStones(
  userId: string,
  fromTier: number,
  toTier: number,
  qty: number,
): Promise<ShopResult> {
  if (toTier >= fromTier) {
    return { ok: false, reason: "Stones only trade downward." };
  }
  const n = Math.max(1, Math.trunc(qty));
  const ids = STONE_KINDS.map((k) => `stone:${k}:${fromTier}`);
  const held = await have(userId, ids);
  const total = ids.reduce((sum, id) => sum + Math.max(0, held.get(id) ?? 0), 0);
  if (total < n) return { ok: false, reason: `You have ${total} tier ${fromTier} stones.` };

  const out = salvageStones(fromTier, toTier) * n;
  const spend: Grant[] = [];
  let left = n;
  for (const id of ids) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, held.get(id) ?? 0));
    if (take > 0) {
      spend.push({ itemId: id, delta: -take, reason: "exchanged" });
      left -= take;
    }
  }
  spend.push({
    itemId: `stone:${STONE_KINDS[toTier % STONE_KINDS.length]}:${toTier}`,
    delta: out,
    reason: "exchanged",
  });
  await append(userId, spend);
  return { ok: true, note: `${n} tier ${fromTier} → ${out} tier ${toTier}.` };
}

/** Salvage pays coins or stones. Set once, and it applies to found gear only. */
export async function setSalvageOutput(
  userId: string,
  output: "coins" | "stones",
): Promise<ShopResult> {
  const wallet = await loadWallet(userId);
  await db
    .update(wallets)
    .set({ salvageOutput: output, version: wallet.version + 1 })
    .where(eq(wallets.userId, userId));
  return {
    ok: true,
    note:
      output === "stones"
        ? "Salvage now pays upgrade stones at the item's own tier."
        : "Salvage now pays coins.",
  };
}

/* -------------------------------- contracts -------------------------------- */

export type ContractResult = { ok: true; target: string; required: number } | { ok: false; reason: string };

/**
 * Take a contract. One at a time, and it never expires — so the only reason to
 * refuse is that one is already open.
 */
export async function takeContract(userId: string): Promise<ContractResult> {
  const [open] = await db
    .select({ id: slayingContracts.id })
    .from(slayingContracts)
    .where(and(eq(slayingContracts.userId, userId), isNull(slayingContracts.completedAt)))
    .limit(1);
  if (open) return { ok: false, reason: "You already have one. It will wait." };

  const [row] = await db
    .select({ xp: skillStates.xp })
    .from(skillStates)
    .where(and(eq(skillStates.userId, userId), eq(skillStates.skill, "slaying")))
    .limit(1);
  const level = skillLevel(row?.xp ?? 0);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(slayingContracts)
    .where(eq(slayingContracts.userId, userId));

  // Seeded from the contract number, never a clock, so a replay draws the same
  // target.
  const offer = rollContract(`${userId}:contract:${n}`, level);
  if (!offer) return { ok: false, reason: "Nothing is open to you yet." };

  await db.insert(slayingContracts).values({
    userId,
    variantName: offer.variantName,
    biome: offer.biome,
    required: offer.required,
    tier: offer.tier,
  });
  return { ok: true, target: offer.variantName, required: offer.required };
}

/** Give up on a contract. Costs nothing: nothing here punishes changing your mind. */
export async function abandonContract(userId: string): Promise<ShopResult> {
  const deleted = await db
    .delete(slayingContracts)
    .where(and(eq(slayingContracts.userId, userId), isNull(slayingContracts.completedAt)))
    .returning({ id: slayingContracts.id });
  return deleted.length > 0
    ? { ok: true, note: "Contract dropped." }
    : { ok: false, reason: "Nothing to drop." };
}
