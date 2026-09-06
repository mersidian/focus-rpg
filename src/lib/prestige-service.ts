import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { focusSessions, gameState, prestigeCycles, prestigeState } from "./db/schema";
import { loadState } from "./game-state";
import { MAX_STARS, PRESTIGE_LEVEL, prestigeOffer, type PrestigeOffer } from "./prestige";

export type PrestigeRow = typeof prestigeState.$inferSelect;

export async function loadPrestige(userId: string): Promise<PrestigeRow> {
  const [row] = await db.select().from(prestigeState).where(eq(prestigeState.userId, userId));
  if (row) return row;

  /**
   * The first cycle starts with the first session, not with this row. Creating
   * it lazily at some later moment would hide every session before it — and
   * "prestige with zero abandons in the cycle" would then be earned by anyone
   * whose row happened to be created after their last abandon.
   */
  const [first] = await db
    .select({ startedAt: focusSessions.startedAt })
    .from(focusSessions)
    .where(eq(focusSessions.userId, userId))
    .orderBy(focusSessions.startedAt)
    .limit(1);

  const [created] = await db
    .insert(prestigeState)
    .values({ userId, cycleStartedAt: first?.startedAt ?? new Date() })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db.select().from(prestigeState).where(eq(prestigeState.userId, userId));
  return raced;
}

function toEngine(row: PrestigeRow) {
  return {
    stars: row.stars,
    cycleStartedAt: row.cycleStartedAt.getTime(),
    reachedFiftyAt: row.reachedFiftyAt?.getTime() ?? null,
    declinedAt: row.declinedAt?.getTime() ?? null,
  };
}

/** Notes the moment a cycle first crosses the gate, for the timing achievement. */
export async function noteLevel(userId: string, level: number): Promise<void> {
  if (level < PRESTIGE_LEVEL) return;
  const row = await loadPrestige(userId);
  if (row.reachedFiftyAt) return;
  await db
    .update(prestigeState)
    .set({ reachedFiftyAt: new Date(), version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(prestigeState.userId, userId), eq(prestigeState.version, row.version)));
}

export type PrestigeView = {
  stars: number;
  bonusPercent: number;
  offer: PrestigeOffer;
  cycleStartedAt: number;
  reachedFiftyAt: number | null;
  declinedAt: number | null;
  cycles: number;
  abandonsThisCycle: number;
};

export async function loadPrestigeView(userId: string): Promise<PrestigeView> {
  const [row, state] = await Promise.all([loadPrestige(userId), loadState(userId)]);
  const [{ n: abandons }] = await db
    .select({ n: count() })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.status, "abandoned"),
        gte(focusSessions.startedAt, row.cycleStartedAt),
      ),
    );
  const [{ n: cycles }] = await db
    .select({ n: count() })
    .from(prestigeCycles)
    .where(eq(prestigeCycles.userId, userId));

  return {
    stars: row.stars,
    bonusPercent: Math.round((Math.min(row.stars * 0.05, 0.5)) * 100),
    offer: prestigeOffer(state.level, toEngine(row)),
    cycleStartedAt: row.cycleStartedAt.getTime(),
    reachedFiftyAt: row.reachedFiftyAt?.getTime() ?? null,
    declinedAt: row.declinedAt?.getTime() ?? null,
    cycles: Number(cycles),
    abandonsThisCycle: Number(abandons),
  };
}

/** Records the decision to press on, so the offer stops being made (§4.2). */
export async function declinePrestige(userId: string): Promise<void> {
  const row = await loadPrestige(userId);
  if (row.declinedAt) return;
  await db
    .update(prestigeState)
    .set({ declinedAt: new Date(), version: row.version + 1, updatedAt: new Date() })
    .where(and(eq(prestigeState.userId, userId), eq(prestigeState.version, row.version)));
}

export type PrestigeResult = {
  stars: number;
  ordinal: number;
  xpSurrendered: number;
  levelSurrendered: number;
  cleanCycle: boolean;
};

/**
 * Reset to Drifter I. Achievements, lifetime hours, every session and the whole
 * history survive; only the level and the XP driving it go back to zero, which
 * is the single place in the app where the ratchet does not hold (§4.1, §4.2).
 */
export async function doPrestige(userId: string): Promise<PrestigeResult> {
  const [row, state] = await Promise.all([loadPrestige(userId), loadState(userId)]);
  const offer = prestigeOffer(state.level, toEngine(row));
  if (!offer.available) {
    throw new Error(
      offer.reason === "below_gate"
        ? `Prestige opens at level ${PRESTIGE_LEVEL}.`
        : "You already chose to press on this cycle.",
    );
  }

  const [{ n: abandons }] = await db
    .select({ n: count() })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.status, "abandoned"),
        gte(focusSessions.startedAt, row.cycleStartedAt),
      ),
    );
  const [{ n: previous }] = await db
    .select({ n: count() })
    .from(prestigeCycles)
    .where(eq(prestigeCycles.userId, userId));

  const ordinal = Number(previous) + 1;

  await db.insert(prestigeCycles).values({
    userId,
    ordinal,
    startedAt: row.cycleStartedAt,
    reachedFiftyAt: row.reachedFiftyAt,
    abandons: Number(abandons),
    xpAtReset: state.xp,
    levelAtReset: state.level,
  });

  const stars = Math.min(row.stars + 1, MAX_STARS);
  const now = new Date();

  await db
    .update(prestigeState)
    .set({
      stars,
      cycleStartedAt: now,
      reachedFiftyAt: null,
      declinedAt: null,
      version: row.version + 1,
      updatedAt: now,
    })
    .where(and(eq(prestigeState.userId, userId), eq(prestigeState.version, row.version)));

  // The one sanctioned reset. Lifetime hours and session counts are untouched.
  await db
    .update(gameState)
    .set({
      xp: 0,
      level: 1,
      // peakLevel is deliberately untouched: you did reach fifty.
      version: sql`${gameState.version} + 1`,
      updatedAt: now,
    })
    .where(eq(gameState.userId, userId));

  return {
    stars,
    ordinal,
    xpSurrendered: state.xp,
    levelSurrendered: state.level,
    cleanCycle: Number(abandons) === 0,
  };
}

/** Facts the prestige achievements read (§5). */
export async function prestigeStats(userId: string) {
  const [row, cycles] = await Promise.all([
    loadPrestige(userId),
    db.select().from(prestigeCycles).where(eq(prestigeCycles.userId, userId)),
  ]);

  const YEAR = 365 * 86_400_000;
  const withinAYear = cycles.filter(
    (c) =>
      c.reachedFiftyAt !== null &&
      c.reachedFiftyAt.getTime() - c.startedAt.getTime() <= YEAR,
  ).length;

  return {
    prestigeStars: row.stars,
    prestigedCleanCycles: cycles.filter((c) => c.abandons === 0).length,
    cyclesToFiftyWithinAYear: withinAYear,
    declinedPrestige: row.declinedAt !== null,
  };
}
