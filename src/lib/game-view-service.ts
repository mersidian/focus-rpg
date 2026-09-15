import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  collectionLog,
  equipmentInstances,
  farmPlots,
  inventoryBalances,
  inventoryEntries,
  sessionActivities,
  slayingContracts,
  worldProgress,
} from "./db/schema";
import { loadWallet, bankUsage } from "./inventory-service";
import type { ResolutionSummary } from "./game-types";
import { loadEquipped, loadSkillXp, loadGateState } from "./activity-service";
import { loadoutPower, percentile, type Equipped } from "./game/power";
import { SKILLS, skillLevel, skillFloorXp, skillNextXp } from "./game/skills";
import { BIOME_BY_INDEX } from "./game/biomes";
import { BIOME_UNLOCK_XP, FIRST_REFINE_TEN_XP, skillLevelXp } from "./game/milestones";
import { sellPrice } from "./game/economy";

const SKILL_LABELS = new Map(SKILLS.map((s) => [s.key, s.label]));

/**
 * The read models the game screens need.
 *
 * Kept apart from `activity-service`, which writes. A page should not be able to
 * resolve a session by accident, and a service that both reads for display and
 * settles a session is a service where that becomes possible.
 */

/*
 * Moved to `game/items`, where the purity rule says they belong: they take no
 * clock and touch no database. Re-exported so this module's callers — and there
 * are many — do not have to care that they moved.
 */
export { itemIndex, itemName } from "./game/items";
import { itemIndex, itemName } from "./game/items";

export type SkillView = {
  key: string;
  label: string;
  kind: string;
  note: string;
  level: number;
  xp: number;
  floor: number;
  next: number | null;
  progress: number;
  /** The character level that opens it (SPEC-V2.md §11). */
  unlock: number;
  /** Whether this character has reached it. */
  open: boolean;
};

export async function skillViews(userId: string, characterLevel: number): Promise<SkillView[]> {
  const xpByKey = await loadSkillXp(userId);
  return SKILLS.map((s) => {
    const xp = xpByKey[s.key] ?? 0;
    const level = skillLevel(xp);
    const floor = skillFloorXp(level);
    const next = skillNextXp(level);
    return {
      key: s.key,
      label: s.label,
      kind: s.kind,
      note: s.note,
      level,
      xp,
      floor,
      next,
      progress: next === null ? 1 : (xp - floor) / Math.max(1, next - floor),
      unlock: s.unlock,
      open: s.unlock <= characterLevel,
    };
  });
}

export type BankRow = {
  itemId: string;
  name: string;
  qty: number;
  cls: string;
  tier: number;
  /** What makes it, which is what picks its mark. */
  skill?: string;
  /** A weapon's combat style, likewise. */
  style?: string;
};

/**
 * What each of these sessions came to, for the log.
 *
 * Deliberately not part of `LogEntry`. `listLog` is called by `buildSnapshot`,
 * which runs on every heartbeat — joining sixty summaries onto it would put a
 * page of JSON on every ping for a figure only the log page draws.
 */
export async function sessionResults(
  userId: string,
  sessionIds: string[],
): Promise<Map<string, ResolutionSummary>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db
    .select({ sessionId: sessionActivities.sessionId, result: sessionActivities.result })
    .from(sessionActivities)
    .where(
      and(
        eq(sessionActivities.userId, userId),
        inArray(sessionActivities.sessionId, sessionIds),
      ),
    );
  return new Map(
    rows.flatMap((r) => (r.result ? [[r.sessionId, r.result] as const] : [])),
  );
}

export async function bankRows(userId: string): Promise<BankRow[]> {
  const rows = await db
    .select({ itemId: inventoryBalances.itemId, qty: inventoryBalances.qty })
    .from(inventoryBalances)
    .where(and(eq(inventoryBalances.userId, userId), sql`${inventoryBalances.qty} > 0`));
  const index = itemIndex();
  return rows
    .map((r) => {
      const def = index.get(r.itemId);
      return {
        itemId: r.itemId,
        name: def?.name ?? itemName(r.itemId),
        qty: r.qty,
        cls: def?.cls ?? r.itemId.split(":")[0],
        tier: def?.tier ?? 0,
        skill: def?.skill,
        style: def?.style,
      };
    })
    .sort((a, b) => a.cls.localeCompare(b.cls) || b.tier - a.tier || a.name.localeCompare(b.name));
}

export type InstanceRow = {
  id: string;
  name: string;
  slot: string;
  style: string;
  tier: number;
  quality: string;
  refine: number;
  durability: number;
  equippedSlot: string | null;
  rolled: number;
  percentile: number;
};

export async function instances(userId: string): Promise<InstanceRow[]> {
  const rows = await db
    .select()
    .from(equipmentInstances)
    .where(eq(equipmentInstances.userId, userId))
    .orderBy(desc(equipmentInstances.tier));
  const index = itemIndex();
  return rows.map((row) => {
    const spec = {
      slot: row.slot as never,
      style: row.style as never,
      tier: row.tier,
      quality: row.quality as never,
      refine: row.refine,
    };
    return {
      id: row.id,
      name: index.get(row.itemId)?.name ?? row.itemId,
      slot: row.slot,
      style: row.style,
      tier: row.tier,
      quality: row.quality,
      refine: row.refine,
      durability: row.durability,
      equippedSlot: row.equippedSlot,
      rolled: row.rolled / 1000,
      percentile: percentile(spec, row.rolled / 1000),
    };
  });
}

/* ------------------------------ the history ------------------------------ */

/**
 * The three faucets, which are the only reasons on the ledger that mean the
 * game produced something.
 *
 * `bought` and `exchanged` are the shop, `correction` is an edited session and
 * `salvage` is gear going back the other way. None of them is a day's work, and
 * putting them in a chart headed "what your sessions made" would be the chart
 * lying about the thing it is for.
 */
export const FAUCETS = ["gathered", "fought", "made"] as const;
export type Faucet = (typeof FAUCETS)[number];

const FAUCET_OF: Record<string, Faucet> = {
  session_yield: "gathered",
  combat_drop: "fought",
  craft_output: "made",
};

export type HistoryDay = {
  /** Midnight UTC of the day, as milliseconds. */
  day: number;
  parts: Record<Faucet, number>;
};

/**
 * What the last `days` days of sessions put in the bank, per day and per faucet.
 *
 * Read off `inventory_entry`, because the ledger is the record and everything
 * else is a fold of it. Nothing is re-rolled and nothing is derived twice: a row
 * here is a thing that was actually granted.
 *
 * **Valued at what the shop would pay, not counted.** A day of tier-1 mining is
 * twenty ore and a day at the bench is two bars, so a count of units would make
 * crafting permanently invisible next to gathering and say something false
 * about where a day went. `economy.ts` prices every class off one curve
 * precisely so that ore and swords can be compared, and this is that comparison.
 *
 * Empty days stay empty. Nothing in this app advances while you are away, so a
 * day with no column is a day you did not play — which is a true thing about the
 * history and not a hole in it.
 */
export async function ledgerHistory(userId: string, days = 30): Promise<HistoryDay[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${inventoryEntries.at} at time zone 'utc')`,
      reason: inventoryEntries.reason,
      itemId: inventoryEntries.itemId,
      units: sql<number>`sum(${inventoryEntries.delta})::int`,
    })
    .from(inventoryEntries)
    .where(
      and(
        eq(inventoryEntries.userId, userId),
        sql`${inventoryEntries.delta} > 0`,
        sql`${inventoryEntries.at} >= ${since}`,
        inArray(inventoryEntries.reason, Object.keys(FAUCET_OF) as never[]),
      ),
    )
    .groupBy(sql`1`, inventoryEntries.reason, inventoryEntries.itemId);

  const catalogue = itemIndex();
  const byDay = new Map<number, Record<Faucet, number>>();
  for (const row of rows) {
    const faucet = FAUCET_OF[row.reason];
    if (!faucet) continue;
    const at = new Date(row.day).setUTCHours(0, 0, 0, 0);
    const def = catalogue.get(row.itemId);
    const worth = sellPrice(def?.tier ?? 1, def?.cls ?? "raw") * row.units;
    const bucket = byDay.get(at) ?? { gathered: 0, fought: 0, made: 0 };
    bucket[faucet] += worth;
    byDay.set(at, bucket);
  }

  // Every day in the window, including the ones with nothing — a bar chart of
  // only the days that happened compresses a fortnight off and reads as a run.
  const out: HistoryDay[] = [];
  const today = new Date().setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = today - i * 86_400_000;
    out.push({ day, parts: byDay.get(day) ?? { gathered: 0, fought: 0, made: 0 } });
  }
  return out;
}

export type Overview = {
  /**
   * The reference time the page describes, read here rather than in the page.
   *
   * Every clock read in this app lives in a service — `session-service` for the
   * snapshot, `project-service` for the picker — and a `Date.now()` during
   * render is both impure and a second value: "3 days ago" should be one
   * reading for the whole page, not one per row that can drift across it.
   */
  now: number;
  coins: number;
  fuel: number;
  fuelCap: number;
  bank: { used: number; slots: number };
  power: { offence: number; defence: number };
  equipped: Equipped;
  wornCount: number;
  collected: number;
  catalogue: number;
  plots: { slot: number; seedItemId: string | null; stagesLeft: number }[];
  contract: {
    variantName: string;
    killed: number;
    required: number;
  } | null;
  keyItems: string[];
  bossesDown: number;
  /** Lumps already paid into V1's ladder, newest first (§11). */
  milestones: { label: string; xp: number; at: Date }[];
};

export async function overview(userId: string): Promise<Overview> {
  const [wallet, bank, equipped, collected, plots, contractRows, markers] = await Promise.all([
    loadWallet(userId),
    bankUsage(userId),
    loadEquipped(userId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(collectionLog)
      .where(eq(collectionLog.userId, userId)),
    db
      .select({ slot: farmPlots.slot, seedItemId: farmPlots.seedItemId, stagesLeft: farmPlots.stagesLeft })
      .from(farmPlots)
      .where(eq(farmPlots.userId, userId))
      .orderBy(farmPlots.slot),
    db
      .select()
      .from(slayingContracts)
      .where(and(eq(slayingContracts.userId, userId), isNull(slayingContracts.completedAt)))
      .limit(1),
    db
      .select({ marker: worldProgress.marker, firstAt: worldProgress.firstAt })
      .from(worldProgress)
      .where(eq(worldProgress.userId, userId)),
  ]);

  const contract = contractRows[0];
  const markerList = markers.map((m) => m.marker);

  return {
    now: Date.now(),
    coins: wallet.coins,
    fuel: wallet.fuel,
    fuelCap: wallet.fuelCap,
    bank,
    power: loadoutPower(equipped),
    equipped,
    wornCount: Object.keys(equipped).length,
    collected: collected[0]?.n ?? 0,
    catalogue: itemIndex().size,
    plots,
    contract: contract
      ? { variantName: contract.variantName, killed: contract.killed, required: contract.required }
      : null,
    keyItems: markerList.filter((m) => m.startsWith("key:")).map((m) => m.slice(4)),
    bossesDown: markerList.filter((m) => m.startsWith("boss:")).length,
    milestones: recentMilestones(markers),
  };
}

/**
 * What the ladder has been paid by the game, read back out of the markers.
 *
 * The markers are the record of payment, so they are also the record of what
 * happened — no second table, and nothing to keep in step. Without this the XP
 * simply appears, and a lump that arrives with no explanation is a worse gift
 * than no lump at all.
 */
function recentMilestones(
  rows: { marker: string; firstAt?: Date }[],
): { label: string; xp: number; at: Date }[] {
  const out: { label: string; xp: number; at: Date }[] = [];
  for (const row of rows) {
    if (!row.marker.startsWith("milestone:")) continue;
    const [, kind, key, at] = row.marker.split(":");
    const when = row.firstAt ?? new Date(0);
    if (kind === "skill") {
      const level = Number(at);
      out.push({
        label: `${SKILL_LABELS.get(key) ?? key} ${level}`,
        xp: skillLevelXp(level),
        at: when,
      });
    } else if (kind === "biome") {
      out.push({
        label: `${BIOME_BY_INDEX.get(Number(key))?.name ?? `Biome ${key}`} opened`,
        xp: BIOME_UNLOCK_XP,
        at: when,
      });
    } else if (kind === "refine") {
      out.push({ label: `First +10 at tier ${key}`, xp: FIRST_REFINE_TEN_XP, at: when });
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function collectionProgress(userId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ itemId: collectionLog.itemId, bestRoll: collectionLog.bestRoll })
    .from(collectionLog)
    .where(eq(collectionLog.userId, userId));
  return new Map(rows.map((r) => [r.itemId, r.bestRoll]));
}

export { loadGateState };
