"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import {
  focusSessions,
  sessionActivities,
  userSettings,
  vacations,
} from "./db/schema";
import { requireUserId } from "./auth";
import { applyDelta, loadState } from "./game-state";
import { SLACKED_XP_MULTIPLIER } from "./constants";
import { gameDay } from "./game-day";
import {
  FREEZE_CAP,
  FREEZE_PURCHASE_XP,
  MAX_REST_DAYS,
  MAX_VACATION_DAYS,
  purchaseFreeze,
} from "./streak-engine";
import { canPause, type EngineSession } from "./session-engine";
import {
  abandonRow,
  buildSnapshot,
  findAwaitingReport,
  isValidLength,
  reconcile,
  withSettled,
  withGame,
  withUnlocked,
  type Reconciliation,
} from "./session-service";
import { evaluateAchievements, setWornTitle } from "./achievements/service";
import {
  chooseActivity,
  offers,
  resolveActivity,
  tonicsHeld,
  type Activity,
} from "./activity-service";
import { refineItem } from "./refine-service";
import { craftItem } from "./craft-service";
import { equipItem, repairAll, unequipSlot } from "./equip-service";
import {
  abandonContract,
  buyBankSlots,
  buyFuelCap,
  buyStock,
  sellInstance,
  sellStack,
  setSalvageOutput,
  exchangeStones,
  takeContract,
} from "./shop-service";
import { buyPlot, harvestPlot, sowPlot } from "./farm-service";
import { declinePrestige, doPrestige } from "./prestige-service";
import {
  archiveProject,
  mergeProjects,
  renameProject,
  resolveProject,
} from "./project-service";
import {
  accrueMeterForXp,
  checkVacation,
  loadSettings,
  loadStreakState,
  recordCompletedSession,
  saveStreakState,
} from "./streak-service";
import type { Snapshot } from "./game-types";
import type { ResolutionSummary } from "./game-types";

type Row = typeof focusSessions.$inferSelect;

async function ownedSession(userId: string, sessionId: string): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
    .limit(1);
  return row;
}

function engineOf(row: Row): EngineSession {
  return {
    plannedMinutes: row.plannedMinutes,
    ruleset: row.ruleset,
    status: row.status,
    startedAt: row.startedAt.getTime(),
    pausedAt: row.pausedAt?.getTime() ?? null,
    pausedMs: row.pausedMs,
    pauseCount: row.pauseCount,
    lastHeartbeatAt: row.lastHeartbeatAt.getTime(),
  };
}

export async function refreshSnapshot(deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  return buildSnapshot(userId, deviceId);
}

export async function startSession(input: {
  id: string;
  plannedMinutes: number;
  ruleset: "desktop" | "mobile";
  deviceId: string;
  /**
   * What the character does for these minutes (SPEC-V2.md §5).
   *
   * Optional, because V1's timer works without it and must keep working. When
   * it is given, the requirement gate is checked BEFORE the timer starts — that
   * ordering is the whole point: a gate evaluated afterwards would be checking
   * rations after the fight, and would let a session be claimed as combat once
   * its roll was known.
   */
  activity?: Activity;
  tonicItemId?: string;
}): Promise<Snapshot> {
  const userId = await requireUserId();

  if (!isValidLength(input.plannedMinutes)) {
    throw new Error("Sessions are 15, 25 or 50 minutes.");
  }

  // The self-report is mandatory and not skippable (§6).
  if (await findAwaitingReport(userId)) {
    throw new Error("Log your last session before starting another.");
  }

  // Settle whatever came before; anything genuinely still running is abandoned
  // by being superseded (§3).
  await reconcile(userId, input.deviceId);
  const [leftover] = await db
    .select()
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.status, ["active", "paused"]),
      ),
    )
    .limit(1);
  let earlier: Reconciliation | null = null;
  if (leftover && leftover.id !== input.id) {
    earlier = await abandonRow(userId, leftover, "superseded", new Date(), input.deviceId);
  }

  const now = new Date();
  await db
    .insert(focusSessions)
    .values({
      id: input.id,
      userId,
      plannedMinutes: input.plannedMinutes,
      ruleset: input.ruleset,
      deviceId: input.deviceId,
      status: "active",
      startedAt: now,
      lastHeartbeatAt: now,
    })
    .onConflictDoNothing();

  /*
   * Settle anything a previous resolution dropped.
   *
   * The catch around `resolveActivity` says a failure "leaves resolved_at null,
   * so the next attempt can still settle it" — and there was no next attempt.
   * It has one caller, and by the time it runs the session is already
   * `completed` and will never be reported again, so a resolution that threw
   * was lost silently and for good. This is that next attempt.
   *
   * It goes on a write path and not in `buildSnapshot`: pages call that, and a
   * page must not be able to resolve a session by accident. Capped, because a
   * sweep that grows without bound would eventually be the slowest part of
   * pressing Start.
   */
  await sweepUnresolved(userId);

  if (input.activity) {
    const chosen = await chooseActivity(userId, input.id, input.activity);
    if (!chosen.ok) {
      // The gate is checked, never trusted. A client that offers a closed
      // activity does not get to have it.
      throw new Error(`That needs ${chosen.missing.join(", ")}.`);
    }
  }

  revalidatePath("/log");
  return withSettled(await buildSnapshot(userId, input.deviceId), earlier);
}

/** At most three sessions whose game half never settled. */
async function sweepUnresolved(userId: string): Promise<void> {
  try {
    const stranded = await db
      .select({ sessionId: sessionActivities.sessionId })
      .from(sessionActivities)
      .innerJoin(focusSessions, eq(focusSessions.id, sessionActivities.sessionId))
      .where(
        and(
          eq(sessionActivities.userId, userId),
          isNull(sessionActivities.resolvedAt),
          eq(focusSessions.status, "completed"),
        ),
      )
      .limit(3);
    for (const row of stranded) {
      await resolveActivity(userId, row.sessionId);
    }
  } catch (error) {
    // Same rule as the original: the game may never stop a session starting.
    console.error("[focus-rpg] sweep of unresolved sessions failed", error);
  }
}

/** Everything selectable right now, with the gate already evaluated. */
export async function listActivityOffers() {
  return offers(await requireUserId());
}

/** Tonics on hand, so one can be drunk with the session that is about to start. */
export async function listTonics() {
  return tonicsHeld(await requireUserId());
}

/**
 * Refine one item by a step.
 *
 * Refinement never fails, so there is nothing to roll and nothing to report but
 * the bill. It is gated the same way everything else is: binary, and it names
 * what is short rather than refusing.
 */
export async function refineItemAction(instanceId: string) {
  const userId = await requireUserId();
  const result = await refineItem(userId, instanceId);
  if (result.ok) revalidatePath("/game/equipment");
  return result;
}

/* ------------------------------------------------------ the game's actions */

/**
 * Everything a player does between sessions.
 *
 * All of them share one shape: they return `{ ok }` with either a note or a
 * reason, never throw for an ordinary refusal, and revalidate the screen they
 * belong to. A refusal names what is short — the same rule the requirement gate
 * follows, because "you cannot" without "because" is the thing that makes a
 * game feel arbitrary.
 */

export async function craftAction(recipeId: string, times = 1) {
  const userId = await requireUserId();
  const result = await craftItem(userId, recipeId, times);
  if (result.ok) {
    revalidatePath("/game/crafting");
    revalidatePath("/game/bank");
    revalidatePath("/game");
  }
  return result;
}

export async function equipAction(instanceId: string) {
  const userId = await requireUserId();
  const result = await equipItem(userId, instanceId);
  if (result.ok) revalidatePath("/game/equipment");
  return result;
}

export async function unequipAction(slot: string) {
  const userId = await requireUserId();
  const result = await unequipSlot(userId, slot);
  if (result.ok) revalidatePath("/game/equipment");
  return result;
}

export async function repairAllAction() {
  const userId = await requireUserId();
  const result = await repairAll(userId);
  if (result.ok) revalidatePath("/game/equipment");
  return result;
}

export async function sellStackAction(itemId: string, qty: number) {
  const userId = await requireUserId();
  const result = await sellStack(userId, itemId, qty);
  if (result.ok) {
    revalidatePath("/game/bank");
    revalidatePath("/game/shop");
  }
  return result;
}

export async function sellInstanceAction(instanceId: string) {
  const userId = await requireUserId();
  const result = await sellInstance(userId, instanceId);
  if (result.ok) {
    revalidatePath("/game/equipment");
    revalidatePath("/game/shop");
  }
  return result;
}

export async function buyStockAction(itemId: string, qty = 1) {
  const userId = await requireUserId();
  const result = await buyStock(userId, itemId, qty);
  if (result.ok) {
    revalidatePath("/game/shop");
    revalidatePath("/game/bank");
  }
  return result;
}

export async function buyBankSlotsAction() {
  const userId = await requireUserId();
  const result = await buyBankSlots(userId);
  if (result.ok) {
    revalidatePath("/game/shop");
    revalidatePath("/game/bank");
  }
  return result;
}

export async function buyFuelCapAction() {
  const userId = await requireUserId();
  const result = await buyFuelCap(userId);
  if (result.ok) revalidatePath("/game/shop");
  return result;
}

export async function buyPlotAction() {
  const userId = await requireUserId();
  const result = await buyPlot(userId);
  if (result.ok) revalidatePath("/game/farm");
  return result;
}

export async function sowPlotAction(slot: number, seedItemId: string) {
  const userId = await requireUserId();
  const result = await sowPlot(userId, slot, seedItemId);
  if (result.ok) revalidatePath("/game/farm");
  return result;
}

export async function harvestPlotAction(slot: number) {
  const userId = await requireUserId();
  const result = await harvestPlot(userId, slot);
  if (result.ok) {
    revalidatePath("/game/farm");
    revalidatePath("/game/bank");
  }
  return result;
}

export async function setSalvageOutputAction(output: "coins" | "stones") {
  const userId = await requireUserId();
  const result = await setSalvageOutput(userId, output);
  revalidatePath("/game/bank");
  revalidatePath("/game/shop");
  return result;
}

export async function exchangeStonesAction(fromTier: number, toTier: number, qty: number) {
  const userId = await requireUserId();
  const result = await exchangeStones(userId, fromTier, toTier, qty);
  if (result.ok) revalidatePath("/game/shop");
  return result;
}

export async function takeContractAction() {
  const userId = await requireUserId();
  const result = await takeContract(userId);
  if (result.ok) {
    revalidatePath("/game/slaying");
    revalidatePath("/game");
  }
  return result;
}

export async function dropContractAction() {
  const userId = await requireUserId();
  const result = await abandonContract(userId);
  if (result.ok) revalidatePath("/game/slaying");
  return result;
}

export async function pauseSession(sessionId: string, deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  const earlier = await reconcile(userId, deviceId);

  const row = await ownedSession(userId, sessionId);
  if (!row || row.status !== "active") {
    return withSettled(await buildSnapshot(userId, deviceId), earlier);
  }

  const check = canPause(engineOf(row));
  if (!check.ok) {
    const earlier = await abandonRow(userId, row, check.reason, new Date(), deviceId);
    revalidatePath("/log");
    return withSettled(await buildSnapshot(userId, deviceId), earlier);
  }

  await db
    .update(focusSessions)
    .set({
      status: "paused",
      pausedAt: new Date(),
      pauseCount: row.pauseCount + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(focusSessions.id, row.id), eq(focusSessions.status, "active")));

  return withSettled(await buildSnapshot(userId, deviceId), earlier);
}

export async function resumeSession(sessionId: string, deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  // Catches a pause that blew its five-minute budget while the page was shut.
  const earlier = await reconcile(userId, deviceId);

  const row = await ownedSession(userId, sessionId);
  if (!row || row.status !== "paused" || !row.pausedAt) {
    return withSettled(await buildSnapshot(userId, deviceId), earlier);
  }

  const now = new Date();
  await db
    .update(focusSessions)
    .set({
      status: "active",
      pausedMs: row.pausedMs + (now.getTime() - row.pausedAt.getTime()),
      pausedAt: null,
      // The heartbeat was suspended while paused; restart its clock now (§3).
      lastHeartbeatAt: now,
      updatedAt: now,
    })
    .where(and(eq(focusSessions.id, row.id), eq(focusSessions.status, "paused")));

  return withSettled(await buildSnapshot(userId, deviceId), earlier);
}

export async function giveUp(sessionId: string, deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  const row = await ownedSession(userId, sessionId);
  let earlier: Reconciliation | null = null;
  if (row && (row.status === "active" || row.status === "paused")) {
    earlier = await abandonRow(userId, row, "gave_up", new Date(), deviceId);
    revalidatePath("/log");
  }
  return withSettled(await buildSnapshot(userId, deviceId), earlier);
}

export async function submitReport(input: {
  sessionId: string;
  projectId: string | null;
  newProjectName: string | null;
  note: string;
  honest: boolean;
  deviceId: string;
}): Promise<Snapshot> {
  const userId = await requireUserId();
  const row = await ownedSession(userId, input.sessionId);
  if (!row || row.status !== "awaiting_report") {
    return buildSnapshot(userId, input.deviceId);
  }

  const projectId = await resolveProject(userId, input.projectId, input.newProjectName);
  if (!projectId) throw new Error("Pick a project, or name a new one.");

  // XP banks at completion; a "slacked" admission gives some of it back (§6).
  const banked = row.xpAwarded;
  const finalXp = input.honest ? banked : Math.round(banked * SLACKED_XP_MULTIPLIER);

  await db
    .update(focusSessions)
    .set({
      status: "completed",
      projectId,
      note: input.note.trim() || null,
      honest: input.honest,
      reportedAt: new Date(),
      xpAwarded: finalXp,
      updatedAt: new Date(),
    })
    .where(and(eq(focusSessions.id, row.id), eq(focusSessions.status, "awaiting_report")));

  if (finalXp !== banked) {
    await applyDelta(userId, input.deviceId, `session-slacked:${row.id}`, {
      xp: finalXp - banked,
    });
  }

  // The streak and the Freeze Meter both move on the XP actually kept, so this
  // runs after the slack adjustment rather than at completion (§6, §7).
  await recordCompletedSession(userId, row.startedAt, finalXp);

  // The game resolves last, and only now: a session becomes `completed` when
  // its report lands, and nothing is credited before that. An abandoned session
  // yields nothing, so this is deliberately not on the completion path.
  //
  // It reads the finished row for its focused minutes and the chain, and it is
  // idempotent — `resolved_at` guards against a retry or a double click paying
  // twice.
  let game: ResolutionSummary | null = null;
  try {
    game = await resolveActivity(userId, row.id);
  } catch (error) {
    // The game must never be able to lose a logged session. XP, the streak and
    // the report are already committed above; a failure here leaves
    // `resolved_at` null, so the next attempt can still settle it.
    console.error("[focus-rpg] activity resolution failed", error);
  }

  // Achievements are judged against the whole history, after the streak has
  // moved — several of them read the streak (§5).
  const unlocked = await evaluateAchievements(userId, input.deviceId);

  revalidatePath("/log");
  revalidatePath("/achievements");
  revalidatePath("/game");
  // The bank is where the result screen sends you, so it must not be stale.
  revalidatePath("/game/bank");
  return withGame(
    withUnlocked(await buildSnapshot(userId, input.deviceId), unlocked),
    game,
  );
}

export async function createProject(
  name: string,
): Promise<{ id: string; name: string } | null> {
  const userId = await requireUserId();
  const id = await resolveProject(userId, null, name);
  return id ? { id, name: name.trim() } : null;
}

/* ------------------------------------------------- streaks and freezes */

/** Up to two rest days a week. They never break a streak or cost a freeze (§7). */
export async function setRestDays(weekdays: number[], deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  const clean = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (clean.length > MAX_REST_DAYS) {
    throw new Error(`Pick at most ${MAX_REST_DAYS} rest days.`);
  }
  await db
    .update(userSettings)
    .set({ restWeekdays: clean.sort(), updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
  return buildSnapshot(userId, deviceId);
}

/**
 * Buying a freeze costs XP but never a rank, because levels ratchet — which is
 * the reason the purchase is safe to offer at all (§7).
 */
export async function buyFreeze(deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  const [state, streak] = await Promise.all([loadState(userId), loadStreakState(userId)]);

  const result = purchaseFreeze(
    {
      streak: streak.streak,
      longestStreak: streak.longestStreak,
      freezes: streak.freezes,
      pendingFreezes: streak.pendingFreezes,
      meter: streak.meter,
      streakFreezesGranted: streak.streakFreezesGranted,
      lastCountedDay: streak.lastCountedDay,
      lastEvaluatedDay: streak.lastEvaluatedDay,
    },
    state.xp,
  );

  if (!result.ok) {
    throw new Error(
      result.reason === "at_cap"
        ? `Your freeze bank is full at ${FREEZE_CAP}.`
        : `A freeze costs ${FREEZE_PURCHASE_XP} XP. You have ${state.xp}.`,
    );
  }

  await saveStreakState(userId, streak, result.state);
  await applyDelta(userId, deviceId, "freeze-purchase", { xp: -result.xpSpent });
  return buildSnapshot(userId, deviceId);
}

/** Up to 21 days, declared in advance, once per calendar quarter (§7). */
export async function declareVacation(
  startDay: string,
  endDay: string,
  deviceId: string,
): Promise<Snapshot> {
  const userId = await requireUserId();
  const settings = await loadSettings(userId);
  const today = gameDay(new Date(), settings.timezone);

  const check = await checkVacation(userId, startDay, endDay, today);
  if (!check.ok) {
    const messages = {
      too_long: `Vacation can run up to ${MAX_VACATION_DAYS} days.`,
      in_the_past: "Vacation is declared in advance. Pick a start date from today onward.",
      quarter_used: "You have already taken a vacation this quarter.",
      backwards: "The end date comes before the start date.",
    } as const;
    throw new Error(messages[check.reason]);
  }

  await db.insert(vacations).values({ userId, startDay, endDay, quarter: check.quarter });
  return buildSnapshot(userId, deviceId);
}

export async function cancelVacation(id: string, deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  await db
    .update(vacations)
    .set({ cancelledAt: new Date() })
    .where(and(eq(vacations.id, id), eq(vacations.userId, userId)));
  return buildSnapshot(userId, deviceId);
}

/* ------------------------------------------------------- achievements */

/** Wear an earned achievement title in place of the level title (§5). */
export async function wearTitle(
  achievementId: string | null,
  deviceId: string,
): Promise<Snapshot> {
  const userId = await requireUserId();
  await setWornTitle(userId, achievementId);
  revalidatePath("/character");
  revalidatePath("/achievements");
  return buildSnapshot(userId, deviceId);
}

/** Re-judges everything. Cheap enough to offer, and the repair path if a rule changes. */
export async function recheckAchievements(deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  const unlocked = await evaluateAchievements(userId, deviceId);
  revalidatePath("/achievements");
  return withUnlocked(await buildSnapshot(userId, deviceId), unlocked);
}

/** The birthday achievement needs a date only the user knows (§5). */
export async function setCalendarSettings(
  input: { birthday: string | null },
  deviceId: string,
): Promise<Snapshot> {
  const userId = await requireUserId();
  await db
    .update(userSettings)
    .set({ birthday: input.birthday || null, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
  return buildSnapshot(userId, deviceId);
}

/* ------------------------------------------------------------ prestige */

/**
 * Reset to Drifter I and take a star. Achievements, lifetime hours and the
 * whole history survive; only the level and its XP go back to zero (§4.2).
 */
export async function prestige(deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  await doPrestige(userId);
  // A prestige earns its own achievements, and may earn "A Clean Cycle".
  const unlocked = await evaluateAchievements(userId, deviceId);
  revalidatePath("/character");
  revalidatePath("/achievements");
  return withUnlocked(await buildSnapshot(userId, deviceId), unlocked);
}

/** Press on instead, and climb the names prestige players never see (§4.2). */
export async function pressOn(deviceId: string): Promise<Snapshot> {
  const userId = await requireUserId();
  await declinePrestige(userId);
  revalidatePath("/character");
  return buildSnapshot(userId, deviceId);
}

/* ------------------------------------------------------------- projects */

export async function renameProjectAction(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  await renameProject(userId, id, name);
  revalidatePath("/projects");
  revalidatePath("/log");
}

/** Moves every session across and retires the source, which keeps its row (§6). */
export async function mergeProjectsAction(
  sourceId: string,
  targetId: string,
): Promise<{ moved: number; sourceName: string; targetName: string }> {
  const userId = await requireUserId();
  const result = await mergeProjects(userId, sourceId, targetId);
  revalidatePath("/projects");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  return result;
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const userId = await requireUserId();
  await archiveProject(userId, id, archived);
  revalidatePath("/projects");
}

/**
 * Corrects a session that was already logged.
 *
 * §6 makes the self-report mandatory and §10 calls it the only thing holding
 * the numbers up — which cuts both ways. A project tagged wrongly was, until
 * now, wrong forever, and "480 hours on the thesis" is only worth believing if
 * a slip can be put right. The session's timing is untouched; only what the
 * user said about it can change.
 */
export async function correctSession(input: {
  sessionId: string;
  projectId: string | null;
  newProjectName: string | null;
  note: string;
  honest: boolean;
  deviceId: string;
}): Promise<Snapshot> {
  const userId = await requireUserId();

  const [row] = await db
    .select()
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.id, input.sessionId),
        eq(focusSessions.userId, userId),
        eq(focusSessions.status, "completed"),
      ),
    )
    .limit(1);
  if (!row) throw new Error("That session cannot be edited.");

  const projectId = await resolveProject(userId, input.projectId, input.newProjectName);
  if (!projectId) throw new Error("Pick a project, or name a new one.");

  // The base is what the session paid before any slack reduction, so toggling
  // the flag lands on the same figure it would have had at the time.
  const base = row.baseXp > 0 ? row.baseXp : row.xpAwarded;
  const corrected = input.honest ? base : Math.round(base * SLACKED_XP_MULTIPLIER);
  const delta = corrected - row.xpAwarded;

  await db
    .update(focusSessions)
    .set({
      projectId,
      note: input.note.trim() || null,
      honest: input.honest,
      xpAwarded: corrected,
      baseXp: base,
      updatedAt: new Date(),
    })
    .where(and(eq(focusSessions.id, row.id), eq(focusSessions.status, "completed")));

  if (delta !== 0) {
    await applyDelta(userId, input.deviceId, `session-corrected:${row.id}`, { xp: delta });
    // The meter keeps what it has drawn (§7), so it only ever takes more.
    if (delta > 0) await accrueMeterForXp(userId, delta);
  }

  // Project totals, note lengths and slack admissions all feed achievements.
  const unlocked = await evaluateAchievements(userId, input.deviceId);

  revalidatePath("/log");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return withUnlocked(await buildSnapshot(userId, input.deviceId), unlocked);
}
