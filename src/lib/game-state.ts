import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { gameState, gameStateBackups } from "./db/schema";
import { describeLevel, levelForXp } from "./levels";

export type GameStateRow = typeof gameState.$inferSelect;

export type LevelChange = {
  from: number;
  to: number;
  /** True when the tier name changed, not just the rank (§4.1 asks for a bigger moment). */
  tierChanged: boolean;
};

export type MutationResult = {
  state: GameStateRow;
  levelChange: LevelChange | null;
};

export async function loadState(userId: string): Promise<GameStateRow> {
  const [existing] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(gameState)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [raced] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.userId, userId))
    .limit(1);
  return raced;
}

type Delta = {
  xp?: number;
  focusedMs?: number;
  completed?: number;
  abandoned?: number;
};

/**
 * Applies a delta to the character sheet.
 *
 * Every write bumps `version`, stores the superseded row in `game_state_backup`
 * and guards on the previous version, so two devices racing cannot silently
 * clobber each other (§2). Levels ratchet: XP may fall, the level never does.
 */
export async function applyDelta(
  userId: string,
  deviceId: string | null,
  reason: string,
  delta: Delta,
): Promise<MutationResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const prev = await loadState(userId);

    const nextXp = Math.max(0, prev.xp + (delta.xp ?? 0));
    const nextLevel = Math.max(prev.level, levelForXp(nextXp));
    const nextPeak = Math.max(prev.peakLevel, nextLevel);

    const [updated] = await db
      .update(gameState)
      .set({
        xp: nextXp,
        level: nextLevel,
        peakLevel: nextPeak,
        lifetimeFocusedMs: prev.lifetimeFocusedMs + (delta.focusedMs ?? 0),
        sessionsCompleted: prev.sessionsCompleted + (delta.completed ?? 0),
        sessionsAbandoned: prev.sessionsAbandoned + (delta.abandoned ?? 0),
        version: prev.version + 1,
        deviceId,
        updatedAt: new Date(),
      })
      .where(and(eq(gameState.userId, userId), eq(gameState.version, prev.version)))
      .returning();

    if (!updated) continue; // another device won the race; re-read and retry.

    await db.insert(gameStateBackups).values({
      userId,
      version: prev.version,
      deviceId: prev.deviceId,
      payload: prev as unknown as Record<string, unknown>,
      reason,
    });

    const levelChange =
      nextLevel > prev.level
        ? {
            from: prev.level,
            to: nextLevel,
            tierChanged:
              describeLevel(nextLevel).tierIndex !== describeLevel(prev.level).tierIndex,
          }
        : null;

    return { state: updated, levelChange };
  }

  throw new Error("Could not save your progress — another device kept winning the write.");
}
