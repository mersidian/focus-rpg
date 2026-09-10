import "server-only";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { focusSessions, projects } from "./db/schema";
import { rankProject, type ProjectRank } from "./projects";
import { gameDay } from "./game-day";
import { loadSettings } from "./streak-service";

export type ProjectDetail = {
  id: string;
  name: string;
  createdAt: number;
  sessions: number;
  abandons: number;
  focusedMs: number;
  firstSessionAt: number | null;
  lastSessionAt: number | null;
  rank: ProjectRank;
  archived: boolean;
  mergedIntoName: string | null;
};

/**
 * Per-project totals. §6 calls these a first-class view — "480 hours on the
 * thesis" is the single most motivating number the app can display — so the
 * hours come from completed sessions only and are never estimated.
 */
export async function listProjectDetails(
  userId: string,
  includeArchived = false,
): Promise<ProjectDetail[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      archivedAt: projects.archivedAt,
      mergedIntoId: projects.mergedIntoId,
      sessions: sql<number>`count(*) filter (where ${focusSessions.status} = 'completed')::int`,
      abandons: sql<number>`count(*) filter (where ${focusSessions.status} = 'abandoned')::int`,
      focusedMs: sql<number>`coalesce(sum(${focusSessions.plannedMinutes} * 60000) filter (where ${focusSessions.status} = 'completed'), 0)::bigint`,
      firstAt: sql<Date | null>`min(${focusSessions.startedAt}) filter (where ${focusSessions.status} = 'completed')`,
      lastAt: sql<Date | null>`max(${focusSessions.startedAt}) filter (where ${focusSessions.status} = 'completed')`,
    })
    .from(projects)
    .leftJoin(focusSessions, eq(focusSessions.projectId, projects.id))
    .where(
      includeArchived
        ? eq(projects.userId, userId)
        : and(eq(projects.userId, userId), isNull(projects.archivedAt)),
    )
    .groupBy(projects.id, projects.name, projects.createdAt, projects.archivedAt, projects.mergedIntoId)
    .orderBy(desc(sql`coalesce(sum(${focusSessions.plannedMinutes} * 60000) filter (where ${focusSessions.status} = 'completed'), 0)`));

  const names = new Map(rows.map((r) => [r.id, r.name]));

  return rows.map((r) => {
    const focusedMs = Number(r.focusedMs ?? 0);
    return {
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.getTime(),
      sessions: Number(r.sessions ?? 0),
      abandons: Number(r.abandons ?? 0),
      focusedMs,
      firstSessionAt: r.firstAt ? new Date(r.firstAt).getTime() : null,
      lastSessionAt: r.lastAt ? new Date(r.lastAt).getTime() : null,
      rank: rankProject(focusedMs),
      archived: r.archivedAt !== null,
      mergedIntoName: r.mergedIntoId ? (names.get(r.mergedIntoId) ?? null) : null,
    };
  });
}

export async function renameProject(userId: string, id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("A project needs a name.");
  if (clean.length > 80) throw new Error("That name is too long.");

  const [clash] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.name, clean), ne(projects.id, id)))
    .limit(1);
  if (clash) {
    // A retired project cannot be merged into, so do not suggest it.
    throw new Error(
      clash.archivedAt === null
        ? `You already have a project called “${clean}”. Merge into it instead.`
        : `A retired project is already called “${clean}”. Bring it back, or pick another name.`,
    );
  }

  const result = await db
    .update(projects)
    .set({ name: clean })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  if (result.length === 0) throw new Error("That project does not exist.");
}

/**
 * Moves every session onto the target and retires the source. The source row
 * survives, pointing at where its hours went — nothing here is ever
 * hard-deleted, and a merge you cannot see is a merge you cannot trust (§2, §6).
 */
export async function mergeProjects(
  userId: string,
  sourceId: string,
  targetId: string,
): Promise<{ moved: number; sourceName: string; targetName: string }> {
  if (sourceId === targetId) throw new Error("Pick two different projects.");

  const both = await db
    .select({ id: projects.id, name: projects.name, archivedAt: projects.archivedAt })
    .from(projects)
    .where(and(eq(projects.userId, userId), sql`${projects.id} in (${sourceId}, ${targetId})`));

  const source = both.find((p) => p.id === sourceId);
  const target = both.find((p) => p.id === targetId);
  if (!source || !target) throw new Error("That project does not exist.");
  if (target.archivedAt) throw new Error("You cannot merge into a retired project.");

  const moved = await db
    .update(focusSessions)
    .set({ projectId: targetId, updatedAt: new Date() })
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.projectId, sourceId)))
    .returning({ id: focusSessions.id });

  await db
    .update(projects)
    .set({ archivedAt: new Date(), mergedIntoId: targetId })
    .where(and(eq(projects.id, sourceId), eq(projects.userId, userId)));

  return { moved: moved.length, sourceName: source.name, targetName: target.name };
}

export async function archiveProject(userId: string, id: string, archived: boolean) {
  await db
    .update(projects)
    .set({ archivedAt: archived ? new Date() : null, mergedIntoId: null })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

/* --------------------------------------------------------- the dashboard */

export type DashboardData = {
  today: string;
  /** Focused minutes per game day, most recent last. */
  daily: { day: string; minutes: number; sessions: number; abandons: number }[];
  /** Focused minutes per week, keyed by the Sunday it starts on. */
  weekly: { week: string; minutes: number }[];
  /** Minutes per project per month, for the stacked series. */
  projectSeries: { month: string; byProject: Record<string, number> }[];
  projectNames: { id: string; name: string }[];
  /** Completed sessions begun in each clock hour, 0-23. */
  byHour: number[];
  /** Completion ratio per month, oldest first. */
  completionTrend: { month: string; completed: number; abandoned: number }[];
};

export async function loadDashboard(userId: string, days = 120): Promise<DashboardData> {
  const settings = await loadSettings(userId);
  const tz = settings.timezone;

  const rows = await db.execute<{
    day: string;
    month: string;
    hour: number;
    project_id: string | null;
    status: string;
    minutes: number;
  }>(sql`
    select
      to_char((started_at at time zone ${tz}) - interval '4 hours', 'YYYY-MM-DD') as day,
      to_char((started_at at time zone ${tz}) - interval '4 hours', 'YYYY-MM')    as month,
      extract(hour from (started_at at time zone ${tz}))::int                     as hour,
      project_id,
      status,
      planned_minutes as minutes
    from focus_session
    where user_id = ${userId} and status in ('completed', 'abandoned')`);

  const list = rows.rows ?? (rows as unknown as { day: string; month: string; hour: number; project_id: string | null; status: string; minutes: number }[]);

  const daily = new Map<string, { minutes: number; sessions: number; abandons: number }>();
  const weekly = new Map<string, number>();
  const months = new Map<string, Record<string, number>>();
  const byHour = new Array(24).fill(0);
  const completion = new Map<string, { completed: number; abandoned: number }>();

  for (const r of list) {
    const done = r.status === "completed";
    const d = daily.get(r.day) ?? { minutes: 0, sessions: 0, abandons: 0 };
    if (done) {
      d.minutes += Number(r.minutes);
      d.sessions += 1;
      byHour[r.hour] += 1;
    } else {
      d.abandons += 1;
    }
    daily.set(r.day, d);

    const c = completion.get(r.month) ?? { completed: 0, abandoned: 0 };
    if (done) c.completed += 1;
    else c.abandoned += 1;
    completion.set(r.month, c);

    if (done) {
      const iso = new Date(`${r.day}T12:00:00Z`);
      const sunday = new Date(iso);
      sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
      const weekKey = sunday.toISOString().slice(0, 10);
      weekly.set(weekKey, (weekly.get(weekKey) ?? 0) + Number(r.minutes));

      const bucket = months.get(r.month) ?? {};
      const key = r.project_id ?? "none";
      bucket[key] = (bucket[key] ?? 0) + Number(r.minutes);
      months.set(r.month, bucket);
    }
  }

  const names = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.name));

  const today = gameDay(Date.now(), tz);
  const dayKeys: string[] = [];
  {
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
  }

  return {
    today,
    daily: dayKeys.map((day) => ({
      day,
      ...(daily.get(day) ?? { minutes: 0, sessions: 0, abandons: 0 }),
    })),
    weekly: [...weekly.entries()].sort().map(([week, minutes]) => ({ week, minutes })),
    projectSeries: [...months.entries()]
      .sort()
      .map(([month, byProject]) => ({ month, byProject })),
    projectNames: names,
    byHour,
    completionTrend: [...completion.entries()]
      .sort()
      .map(([month, c]) => ({ month, ...c })),
  };
}

/**
 * Resolves the project a report is filed against, creating it if the name is
 * new.
 *
 * A name matching a retired or merged-away project brings that project back
 * rather than filing the session into a row nothing displays — typing a name is
 * a clear statement that you want that project again, and hours logged
 * somewhere invisible are worse than no hours at all.
 */
export async function resolveProject(
  userId: string,
  projectId: string | null,
  newName: string | null,
): Promise<string | null> {
  const revive = async (row: { id: string; archivedAt: Date | null }) => {
    if (row.archivedAt !== null) {
      await db
        .update(projects)
        .set({ archivedAt: null, mergedIntoId: null })
        .where(eq(projects.id, row.id));
    }
    return row.id;
  };

  if (projectId) {
    const [existing] = await db
      .select({ id: projects.id, archivedAt: projects.archivedAt })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (existing) return revive(existing);
  }

  const name = newName?.trim();
  if (!name) return null;

  const [created] = await db
    .insert(projects)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning({ id: projects.id });
  if (created) return created.id;

  const [existing] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.name, name)))
    .limit(1);
  return existing ? revive(existing) : null;
}
