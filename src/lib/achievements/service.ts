import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { achievementUnlocks, focusSessions, dayLedger, userSettings } from "../db/schema";
import { loadState, applyDelta } from "../game-state";
import {
  accrueMeterForXp,
  advanceStreak,
  loadSettings,
  loadStreakState,
  saveStreakState,
} from "../streak-service";
import { grantFreeze } from "../streak-engine";
import { gameDay } from "../game-day";
import { prestigeStats } from "../prestige-service";
import { allThaiHolidayDates } from "../holidays/thailand";
import { buildStats, type DayFacts, type StatSession } from "./stats";
import { loadGameStats } from "../game-stats-service";
import { emptyGameStats } from "../game/game-stats";
import { evaluate, progressOf } from "./engine";
import {
  ALL_ACHIEVEMENTS as ACHIEVEMENTS,
  BY_ID,
  achievementXp,
  type Achievement,
} from "./definitions";

export type Unlocked = {
  id: string;
  name: string;
  description: string;
  family: Achievement["family"];
  rarity: Achievement["rarity"];
  xp: number;
  freezes: number;
  title: string | null;
  hidden: boolean;
};

function toUnlocked(x: Achievement): Unlocked {
  return {
    id: x.id,
    name: x.name,
    description: x.description,
    family: x.family,
    rarity: x.rarity,
    xp: achievementXp(x),
    freezes: x.freezes ?? 0,
    title: x.title ?? null,
    hidden: Boolean(x.hidden),
  };
}

export async function listUnlockIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: achievementUnlocks.achievementId })
    .from(achievementUnlocks)
    .where(eq(achievementUnlocks.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export async function listUnlocks(userId: string) {
  return db
    .select()
    .from(achievementUnlocks)
    .where(eq(achievementUnlocks.userId, userId));
}

async function loadStatsFor(userId: string) {
  // Fourteen Consistency achievements and three Recovery ones read the streak,
  // so the calendar has to be caught up before anything is judged (§5, §7).
  await advanceStreak(userId);
  const settings = await loadSettings(userId);
  const [sessions, ledger, state, streak, prestige] = await Promise.all([
    db
      .select({
        plannedMinutes: focusSessions.plannedMinutes,
        status: focusSessions.status,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pauseCount: focusSessions.pauseCount,
        pausedMs: focusSessions.pausedMs,
        honest: focusSessions.honest,
        note: focusSessions.note,
        projectId: focusSessions.projectId,
      })
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          inArray(focusSessions.status, ["completed", "abandoned"]),
        ),
      ),
    db.select().from(dayLedger).where(eq(dayLedger.userId, userId)),
    loadState(userId),
    loadStreakState(userId),
    prestigeStats(userId),
  ]);

  const statSessions: StatSession[] = sessions.map((s) => ({
    plannedMinutes: s.plannedMinutes,
    status: s.status as "completed" | "abandoned",
    startedAt: s.startedAt.getTime(),
    endedAt: s.endedAt?.getTime() ?? null,
    pauseCount: s.pauseCount,
    pausedMs: s.pausedMs,
    honest: s.honest,
    note: s.note,
    projectId: s.projectId,
  }));

  const dayStates = new Map<string, DayFacts["state"]>(
    ledger.map((d) => [d.day, d.state]),
  );

  /**
   * V2's facts, loaded alongside V1's. They default to zeros when the game has
   * never been touched, so an account that only ever used the timer is judged
   * exactly as it was before the game existed.
   *
   * And they fail soft. This runs inside `submitReport`, which is the one path
   * that must never break: if the game's tables are absent — a deploy that
   * landed ahead of its migration — logging a session has to keep working. V1's
   * 131 are judged either way, and V2's simply do not fire until the tables are
   * there.
   */
  let game = emptyGameStats();
  try {
    game = await loadGameStats(userId);
  } catch (error) {
    console.error("[focus-rpg] game stats unavailable, judging V1 only", error);
  }

  const now = Date.now();
  return {
    settings,
    state,
    streak,
    stats: buildStats({
      game,
      sessions: statSessions,
      dayStates,
      timezone: settings.timezone,
      today: gameDay(now, settings.timezone),
      now,
      level: state.level,
      peakLevel: state.peakLevel,
      xp: state.xp,
      lifetimeFocusedMs: state.lifetimeFocusedMs,
      streak: streak.streak,
      longestStreak: streak.longestStreak,
      prestigeStars: prestige.prestigeStars,
      prestigedCleanCycles: prestige.prestigedCleanCycles,
      cyclesToFiftyWithinAYear: prestige.cyclesToFiftyWithinAYear,
      declinedPrestige: prestige.declinedPrestige,
      birthday: settings.birthday,
      /**
       * Built in rather than kept by the user. A public holiday is a fact about
       * where you are, not a preference, and asking someone to type nineteen
       * dates to make one achievement work is a chore disguised as a setting.
       * Any dates stored on the account still count, so nothing is lost.
       */
      holidays: [...new Set([...allThaiHolidayDates(), ...settings.holidays])],
    }),
  };
}

/**
 * Judges everything against the full history and banks whatever is newly
 * earned. Achievements pay XP and some pay freezes (§5, §7).
 */
export async function evaluateAchievements(
  userId: string,
  deviceId: string | null = null,
): Promise<Unlocked[]> {
  const { stats } = await loadStatsFor(userId);
  const already = await listUnlockIds(userId);
  const newly = evaluate(stats, already);
  if (newly.length === 0) return [];

  await db
    .insert(achievementUnlocks)
    .values(
      newly.map((x) => ({
        userId,
        achievementId: x.id,
        xpAwarded: achievementXp(x),
        freezesAwarded: x.freezes ?? 0,
      })),
    )
    .onConflictDoNothing();

  const xp = newly.reduce((n, x) => n + achievementXp(x), 0);
  if (xp > 0) {
    await applyDelta(userId, deviceId, `achievements:${newly.map((x) => x.id).join(",")}`, {
      xp,
    });
    // Achievement XP is earned XP, so it feeds the Freeze Meter like any other.
    await accrueMeterForXp(userId, xp);
  }

  const freezes = newly.reduce((n, x) => n + (x.freezes ?? 0), 0);
  if (freezes > 0) {
    const row = await loadStreakState(userId);
    await saveStreakState(
      userId,
      row,
      grantFreeze(
        {
          streak: row.streak,
          longestStreak: row.longestStreak,
          freezes: row.freezes,
          pendingFreezes: row.pendingFreezes,
          meter: row.meter,
          streakFreezesGranted: row.streakFreezesGranted,
          lastCountedDay: row.lastCountedDay,
          lastEvaluatedDay: row.lastEvaluatedDay,
        },
        freezes,
      ),
    );
  }

  return newly.map(toUnlocked);
}

export type AchievementView = {
  id: string;
  family: Achievement["family"];
  name: string;
  description: string;
  rarity: Achievement["rarity"];
  xp: number;
  title: string | null;
  freezes: number;
  hidden: boolean;
  deferred: boolean;
  unlocked: boolean;
  unlockedAt: number | null;
};

export async function loadAchievementBoard(userId: string) {
  const unlocks = await listUnlocks(userId);
  const at = new Map(unlocks.map((u) => [u.achievementId, u.unlockedAt.getTime()]));
  const unlockedIds = new Set(at.keys());
  const settings = await loadSettings(userId);

  const items: AchievementView[] = ACHIEVEMENTS.map((x) => ({
    id: x.id,
    family: x.family,
    name: x.name,
    description: x.description,
    rarity: x.rarity,
    xp: achievementXp(x),
    title: x.title ?? null,
    freezes: x.freezes ?? 0,
    hidden: Boolean(x.hidden),
    deferred: Boolean(x.deferred),
    unlocked: unlockedIds.has(x.id),
    unlockedAt: at.get(x.id) ?? null,
  }));

  return {
    items,
    progress: progressOf(unlockedIds),
    wornTitle: settings.wornTitle,
    /** Titles the user has actually earned and may wear (§5). */
    availableTitles: items
      .filter((i) => i.unlocked && i.title)
      .map((i) => ({ id: i.id, title: i.title as string })),
  };
}

export async function setWornTitle(userId: string, achievementId: string | null) {
  if (achievementId !== null) {
    const achievement = BY_ID.get(achievementId);
    if (!achievement?.title) throw new Error("That achievement carries no title.");
    const [owned] = await db
      .select({ id: achievementUnlocks.achievementId })
      .from(achievementUnlocks)
      .where(
        and(
          eq(achievementUnlocks.userId, userId),
          eq(achievementUnlocks.achievementId, achievementId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("You have not earned that title yet.");
  }
  await db
    .update(userSettings)
    .set({ wornTitle: achievementId, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
}
