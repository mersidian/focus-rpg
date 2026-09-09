import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  collectionLog,
  equipmentInstances,
  inventoryEntries,
  sessionActivities,
  skillStates,
  slayingContracts,
  wallets,
  worldProgress,
} from "./db/schema";
import {
  emptyGameStats,
  CATALOGUE_INDEX_EXPORT as CATALOGUE_INDEX,
  UNIQUE_IDS_EXPORT as UNIQUE_IDS,
  CATALOGUE_TIER_TOTALS as CATALOGUE_BY_TIER,
  CATALOGUE_CLASS_TOTALS as CATALOGUE_BY_CLASS,
  SKILLS,
  skillLevel,
  type GameStats,
} from "./game/game-stats";

/**
 * Reading the game facts the achievements are judged against.
 *
 * The shape and every derived total live in `game/game-stats.ts`, which is
 * pure. This file is only the queries — one per table, folded in memory, which
 * is affordable because there is exactly one user.
 */
export async function loadGameStats(userId: string): Promise<GameStats> {
  const [skillRows, activityRows, ledgerRows, logRows, markers, gearRows, walletRows, contractRows] =
    await Promise.all([
      db.select({ skill: skillStates.skill, xp: skillStates.xp }).from(skillStates).where(eq(skillStates.userId, userId)),
      db
        .select({
          kind: sessionActivities.kind,
          skill: sessionActivities.skill,
          biome: sessionActivities.biome,
          kills: sessionActivities.kills,
          legendaryKills: sessionActivities.legendaryKills,
          unitsGathered: sessionActivities.unitsGathered,
        })
        .from(sessionActivities)
        .where(and(eq(sessionActivities.userId, userId), sql`${sessionActivities.resolvedAt} is not null`)),
      db
        .select({ itemId: inventoryEntries.itemId, delta: inventoryEntries.delta, reason: inventoryEntries.reason })
        .from(inventoryEntries)
        .where(and(eq(inventoryEntries.userId, userId), sql`${inventoryEntries.delta} > 0`)),
      db.select({ itemId: collectionLog.itemId }).from(collectionLog).where(eq(collectionLog.userId, userId)),
      db.select({ marker: worldProgress.marker }).from(worldProgress).where(eq(worldProgress.userId, userId)),
      db
        .select({ refine: equipmentInstances.refine, tier: equipmentInstances.tier, equippedSlot: equipmentInstances.equippedSlot })
        .from(equipmentInstances)
        .where(eq(equipmentInstances.userId, userId)),
      db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(slayingContracts)
        .where(and(eq(slayingContracts.userId, userId), sql`${slayingContracts.completedAt} is not null`)),
    ]);

  const out = emptyGameStats();

  for (const s of SKILLS) out.skillLevels[s.key] = 1;
  for (const row of skillRows) out.skillLevels[row.skill] = skillLevel(row.xp);
  out.totalSkillLevel = Object.values(out.skillLevels).reduce((n, v) => n + v, 0);
  out.skillsAt = (level: number) =>
    Object.values(out.skillLevels).filter((v) => v >= level).length;

  const biomes = new Set<number>();
  for (const row of activityRows) {
    if (row.kind === "gathering") out.gatheringSessions += 1;
    else if (row.kind === "boss") out.bossSessions += 1;
    else out.combatSessions += 1;
    out.kills += row.kills;
    out.legendaryKills += row.legendaryKills;
    out.unitsGathered += row.unitsGathered;
    if (row.kind === "gathering") {
      out.unitsBySkill[row.skill] = (out.unitsBySkill[row.skill] ?? 0) + row.unitsGathered;
    }
    if (row.biome !== null) biomes.add(row.biome);
  }
  out.biomesEntered = biomes.size;

  const craftedSkills = new Set<string>();
  for (const row of ledgerRows) {
    if (row.reason !== "craft_output") continue;
    out.itemsCrafted += row.delta;
    const skill = CATALOGUE_INDEX.get(row.itemId)?.skill;
    if (skill) craftedSkills.add(skill);
  }
  out.craftedSkills = craftedSkills.size;

  for (const row of logRows) {
    out.collected += 1;
    if (UNIQUE_IDS.has(row.itemId)) out.uniquesFound += 1;
    const def = CATALOGUE_INDEX.get(row.itemId);
    if (!def) continue;
    out.collectedByTier[def.tier] = (out.collectedByTier[def.tier] ?? 0) + 1;
    out.collectedByClass[def.cls] = (out.collectedByClass[def.cls] ?? 0) + 1;
  }
  out.tiersComplete = Object.keys(CATALOGUE_BY_TIER).filter(
    (t) => (out.collectedByTier[Number(t)] ?? 0) >= CATALOGUE_BY_TIER[Number(t)],
  ).length;
  out.classesComplete = Object.keys(CATALOGUE_BY_CLASS).filter(
    (c) => (out.collectedByClass[c] ?? 0) >= CATALOGUE_BY_CLASS[c],
  ).length;

  const markerList = markers.map((m) => m.marker);
  out.bossesDown = markerList.filter((m) => m.startsWith("boss:")).length;
  out.lordsDown = markerList.filter((m) => m.endsWith(":lord")).length;
  out.keyItems = markerList.filter((m) => m.startsWith("key:")).length;

  const refinedTiers = new Set<number>();
  let equippedCount = 0;
  for (const row of gearRows) {
    out.maxRefine = Math.max(out.maxRefine, row.refine);
    if (row.refine >= 10) {
      out.itemsAtTen += 1;
      refinedTiers.add(row.tier);
    }
    if (row.equippedSlot) equippedCount += 1;
  }
  out.refinedTiers = refinedTiers.size;
  out.fullSetsEquipped = equippedCount >= 10 ? 1 : 0;

  const wallet = walletRows[0];
  if (wallet) {
    out.coins = wallet.coins;
    out.bankSlots = wallet.bankSlots;
    out.fuelCap = wallet.fuelCap;
  }
  out.contractsDone = contractRows[0]?.n ?? 0;

  return out;
}


export type { GameStats };
