import "server-only";
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { db } from "./db";
import { focusSessions, projects } from "./db/schema";
import { applyDelta, loadState } from "./game-state";
import {
  ABANDON_XP_PENALTY,
  SESSION_LENGTHS,
  XP_BY_LENGTH,
  type AbandonReason,
  type SessionLength,
} from "./constants";
import { evaluate, requiredMs, type EngineSession } from "./session-engine";
import { advanceStreak } from "./streak-service";
import { loadPrestige, loadPrestigeView, noteLevel } from "./prestige-service";
import { xpMultiplier } from "./prestige";
import { chainState, linksBefore, chainMultiplier, type ChainSession } from "./chain";
import { meterProgress } from "./streak-engine";
import type {
  ClientSession,
  LevelChange,
  LogEntry,
  ProjectSummary,
  ResolutionSummary,
  SettleEvent,
  Snapshot,
} from "./game-types";

type Row = typeof focusSessions.$inferSelect;

const LIVE = ["active", "paused"] as const;

function toEngine(row: Row): EngineSession {
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

export function toClientSession(row: Row): ClientSession {
  return {
    id: row.id,
    plannedMinutes: row.plannedMinutes,
    ruleset: row.ruleset,
    status: row.status as ClientSession["status"],
    startedAt: row.startedAt.getTime(),
    pausedAt: row.pausedAt?.getTime() ?? null,
    pausedMs: row.pausedMs,
    pauseCount: row.pauseCount,
    lastHeartbeatAt: row.lastHeartbeatAt.getTime(),
    xpAwarded: row.xpAwarded,
  };
}

export function xpForLength(minutes: number): number {
  return XP_BY_LENGTH[minutes as SessionLength] ?? minutes;
}

export function isValidLength(minutes: number): minutes is SessionLength {
  return (SESSION_LENGTHS as readonly number[]).includes(minutes);
}

/**
 * Settled sessions, newest first, for working out the chain. Excludes the one
 * being asked about, which must never count as its own link.
 */
export async function chainHistory(
  userId: string,
  exclude?: string,
): Promise<ChainSession[]> {
  const rows = await db
    .select({
      status: focusSessions.status,
      startedAt: focusSessions.startedAt,
      endedAt: focusSessions.endedAt,
      id: focusSessions.id,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.status, ["completed", "abandoned", "awaiting_report"]),
      ),
    )
    .orderBy(desc(focusSessions.endedAt))
    .limit(12);

  return rows
    .filter((r) => r.id !== exclude && r.endedAt !== null)
    .map((r) => ({
      status: r.status as ChainSession["status"],
      startedAt: r.startedAt.getTime(),
      endedAt: r.endedAt!.getTime(),
    }));
}

async function findLive(userId: string): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), inArray(focusSessions.status, [...LIVE])))
    .orderBy(desc(focusSessions.startedAt))
    .limit(1);
  return row;
}

export async function findAwaitingReport(userId: string): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "awaiting_report")))
    .orderBy(desc(focusSessions.startedAt))
    .limit(1);
  return row;
}

/** Banks a finished session's XP. The self-report adjusts it afterwards (§6). */
async function bankCompletion(
  userId: string,
  row: Row,
  completedAt: Date,
  deviceId: string | null,
) {
  /**
   * Stars pay a permanent bonus (§4.2) and the chain pays a temporary one. Both
   * multiply the same base, and the chain is measured from the session's own
   * start — the rate the user was told when they chose to begin.
   */
  const prestige = await loadPrestige(userId);
  const links = linksBefore(await chainHistory(userId, row.id), row.startedAt.getTime());
  const xp = Math.round(
    xpForLength(row.plannedMinutes) *
      xpMultiplier(prestige.stars) *
      chainMultiplier(links, row.plannedMinutes),
  );
  await db
    .update(focusSessions)
    .set({
      status: "awaiting_report",
      endedAt: completedAt,
      xpAwarded: xp,
      baseXp: xp,
      updatedAt: new Date(),
    })
    .where(eq(focusSessions.id, row.id));

  const result = await applyDelta(userId, deviceId, `session-complete:${row.id}`, {
    xp,
    focusedMs: requiredMs(row.plannedMinutes),
    completed: 1,
  });

  return {
    settled: {
      kind: "completed" as const,
      sessionId: row.id,
      xp,
      plannedMinutes: row.plannedMinutes,
    },
    levelChange: result.levelChange,
  };
}

export async function abandonRow(
  userId: string,
  row: Row,
  reason: AbandonReason,
  at: Date,
  deviceId: string | null,
) {
  await db
    .update(focusSessions)
    .set({
      status: "abandoned",
      endedAt: at,
      abandonReason: reason,
      xpAwarded: -ABANDON_XP_PENALTY,
      pausedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(focusSessions.id, row.id));

  const result = await applyDelta(userId, deviceId, `session-abandon:${row.id}`, {
    xp: -ABANDON_XP_PENALTY,
    abandoned: 1,
  });

  return {
    settled: {
      kind: "abandoned" as const,
      sessionId: row.id,
      reason,
      xp: -ABANDON_XP_PENALTY,
    },
    levelChange: result.levelChange,
  };
}

export type Reconciliation = {
  settled: SettleEvent | null;
  levelChange: LevelChange | null;
};

/**
 * Brings the stored session up to date with the server clock: completes it if
 * its time ran out, abandons it if the pause budget blew or the desktop
 * heartbeat went quiet for more than two minutes (§3).
 */
export async function reconcile(
  userId: string,
  deviceId: string | null = null,
): Promise<Reconciliation> {
  const row = await findLive(userId);
  if (!row) return { settled: null, levelChange: null };

  const verdict = evaluate(toEngine(row), Date.now());

  if (verdict.kind === "complete") {
    return bankCompletion(userId, row, new Date(verdict.at), deviceId);
  }
  if (verdict.kind === "abandon") {
    return abandonRow(userId, row, verdict.reason, new Date(verdict.at), deviceId);
  }
  return { settled: null, levelChange: null };
}

async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      sessions: count(focusSessions.id),
      focusedMs: sum(
        sql<number>`case when ${focusSessions.status} = 'completed' then ${focusSessions.plannedMinutes} * 60000 else 0 end`,
      ),
    })
    .from(projects)
    .leftJoin(
      focusSessions,
      and(eq(focusSessions.projectId, projects.id), eq(focusSessions.status, "completed")),
    )
    .where(and(eq(projects.userId, userId), sql`${projects.archivedAt} is null`))
    .groupBy(projects.id, projects.name)
    .orderBy(projects.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sessions: Number(r.sessions ?? 0),
    focusedMs: Number(r.focusedMs ?? 0),
  }));
}

/**
 * How much lookback the log needs to explain its own numbers.
 *
 * The chain is DERIVED, never stored (see CLAUDE.md), so the log works out each
 * session's links from the sessions before it rather than reading a column. That
 * means the oldest rows on a page need a few rows of context or their link count
 * would be undercounted — and a wrong multiplier is worse than none. The chain
 * caps at five links inside a ten-minute window, so twenty is far more than
 * enough.
 */
const LOG_LOOKBACK = 20;

export async function listLog(userId: string, limit = 60): Promise<LogEntry[]> {
  const rows = await db
    .select({
      s: focusSessions,
      projectName: projects.name,
    })
    .from(focusSessions)
    .leftJoin(projects, eq(focusSessions.projectId, projects.id))
    .where(
      and(
        eq(focusSessions.userId, userId),
        inArray(focusSessions.status, ["completed", "abandoned"]),
      ),
    )
    .orderBy(desc(focusSessions.startedAt))
    .limit(limit + LOG_LOOKBACK);

  // Newest first from the query; `linksBefore` wants the same order, minus the
  // session being asked about.
  const history: ChainSession[] = rows.map(({ s }) => ({
    status: s.status as ChainSession["status"],
    startedAt: s.startedAt.getTime(),
    endedAt: s.endedAt?.getTime() ?? null,
  }));

  return rows.slice(0, limit).map(({ s, projectName }, i) => ({
    id: s.id,
    plannedMinutes: s.plannedMinutes,
    ruleset: s.ruleset,
    status: s.status as "completed" | "abandoned",
    startedAt: s.startedAt.getTime(),
    endedAt: s.endedAt?.getTime() ?? null,
    xpAwarded: s.xpAwarded,
    baseXp: s.baseXp,
    chainLinks: linksBefore(history.slice(i + 1), s.startedAt.getTime()),
    chainMultiplier: chainMultiplier(
      linksBefore(history.slice(i + 1), s.startedAt.getTime()),
      s.plannedMinutes,
    ),
    pauseCount: s.pauseCount,
    abandonReason: (s.abandonReason as AbandonReason | null) ?? null,
    projectName,
    note: s.note,
    honest: s.honest,
  }));
}

export async function buildSnapshot(
  userId: string,
  deviceId: string | null = null,
  logLimit = 60,
): Promise<Snapshot> {
  const { settled, levelChange } = await reconcile(userId, deviceId);

  // Catch the calendar up before reporting anything: freezes spend themselves
  // overnight and the user should see the result, not the stale streak (§7).
  const advance = await advanceStreak(userId);

  const [state, live, awaiting, projectList, recent] = await Promise.all([
    loadState(userId),
    findLive(userId),
    findAwaitingReport(userId),
    listProjects(userId),
    listLog(userId, logLimit),
  ]);

  // Records the first crossing of the gate, which one achievement times.
  await noteLevel(userId, state.level);
  const prestige = await loadPrestigeView(userId);
  const chain = chainState(await chainHistory(userId, live?.id ?? awaiting?.id), Date.now());

  return {
    serverNow: Date.now(),
    state: {
      xp: state.xp,
      level: state.level,
      lifetimeFocusedMs: state.lifetimeFocusedMs,
      sessionsCompleted: state.sessionsCompleted,
      sessionsAbandoned: state.sessionsAbandoned,
      version: state.version,
    },
    active: live ? toClientSession(live) : null,
    awaitingReport: awaiting ? toClientSession(awaiting) : null,
    projects: projectList,
    recent,
    settled,
    levelChange,
    unlocked: [],
    // Never read back here. This runs on every heartbeat and every visibility
    // change; `submitReport` is the only thing that attaches a result.
    game: null,
    chain,
    prestige: {
      stars: prestige.stars,
      bonusPercent: prestige.bonusPercent,
      offerAvailable: prestige.offer.available,
      wornTitle: advance.settings.wornTitle,
    },
    streak: {
      today: advance.today,
      streak: advance.state.streak,
      longestStreak: advance.state.longestStreak,
      freezes: advance.state.freezes,
      pendingFreezes: advance.state.pendingFreezes,
      meterProgress: meterProgress({
        streak: advance.state.streak,
        longestStreak: advance.state.longestStreak,
        freezes: advance.state.freezes,
        pendingFreezes: advance.state.pendingFreezes,
        meter: advance.state.meter,
        streakFreezesGranted: advance.state.streakFreezesGranted,
        lastCountedDay: advance.state.lastCountedDay,
        lastEvaluatedDay: advance.state.lastEvaluatedDay,
      }),
      activeToday: advance.state.lastCountedDay === advance.today,
      restWeekdays: advance.settings.restWeekdays,
      frozeDays: advance.frozeDays,
      brokeOn: advance.brokeOn,
    },
  };
}

/**
 * Carries a settle event that happened earlier in the same request into the
 * snapshot the client receives, so an abandon always arrives with its reason
 * attached rather than the session simply vanishing.
 */
export function withUnlocked(
  snapshot: Snapshot,
  unlocked: Snapshot["unlocked"],
): Snapshot {
  return unlocked.length === 0 ? snapshot : { ...snapshot, unlocked };
}

/**
 * Attach what the game paid for the session just logged.
 *
 * Same shape as `withUnlocked`, and for the same reason: this belongs to one
 * report rather than to the character, so it rides on the snapshot that answers
 * that report and on no other.
 *
 * A rank that arrived off a milestone lump is promoted here too, but only when
 * V1's own XP path did not already produce one — the overlay shows a single
 * rank, and the ladder cannot cross two in one session.
 */
export function withGame(snapshot: Snapshot, game: ResolutionSummary | null): Snapshot {
  if (!game) return snapshot;
  return {
    ...snapshot,
    game,
    levelChange: snapshot.levelChange ?? game.levelChange ?? null,
  };
}

export function withSettled(snapshot: Snapshot, earlier: Reconciliation | null): Snapshot {
  if (!earlier || (!earlier.settled && !earlier.levelChange)) return snapshot;
  return {
    ...snapshot,
    settled: snapshot.settled ?? earlier.settled,
    levelChange: snapshot.levelChange ?? earlier.levelChange,
  };
}
