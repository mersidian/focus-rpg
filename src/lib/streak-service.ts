import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { dayLedger, streakState, userSettings, vacations } from "./db/schema";
import {
  DAY_ROLLOVER_HOUR,
  DEFAULT_TIMEZONE,
  addDays,
  dayRange,
  daysBetween,
  gameDay,
  quarterOf,
} from "./game-day";
import {
  MAX_VACATION_DAYS,
  accrueMeter,
  creditDay,
  emptyState,
  walkDays,
  type DayActivity,
  type StreakState,
} from "./streak-engine";

export type Settings = typeof userSettings.$inferSelect;
type StreakRow = typeof streakState.$inferSelect;

export async function loadSettings(userId: string): Promise<Settings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (row) return row;
  const [created] = await db
    .insert(userSettings)
    .values({ userId, timezone: DEFAULT_TIMEZONE })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return raced;
}

export async function loadStreakState(userId: string): Promise<StreakRow> {
  const [row] = await db.select().from(streakState).where(eq(streakState.userId, userId));
  if (row) return row;
  const [created] = await db
    .insert(streakState)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db.select().from(streakState).where(eq(streakState.userId, userId));
  return raced;
}

function toEngine(row: StreakRow): StreakState {
  return {
    streak: row.streak,
    longestStreak: row.longestStreak,
    freezes: row.freezes,
    pendingFreezes: row.pendingFreezes,
    meter: row.meter,
    streakFreezesGranted: row.streakFreezesGranted,
    lastCountedDay: row.lastCountedDay,
    lastEvaluatedDay: row.lastEvaluatedDay,
  };
}

/** Optimistic write guarded on the version, matching the game_state pattern. */
export async function saveStreakState(
  userId: string,
  prev: StreakRow,
  next: StreakState,
): Promise<StreakRow> {
  const [updated] = await db
    .update(streakState)
    .set({ ...next, version: prev.version + 1, updatedAt: new Date() })
    .where(and(eq(streakState.userId, userId), eq(streakState.version, prev.version)))
    .returning();
  return updated ?? (await loadStreakState(userId));
}

/**
 * Sessions grouped into game days. The bucket is the session's *start*: work
 * begun at 1am belongs to the night before, which is the day the user thinks
 * they are in (§7).
 */
export async function loadActivity(
  userId: string,
  timezone: string,
): Promise<Map<string, DayActivity & { focusedMs: number }>> {
  const rows = await db.execute<{
    day: string;
    completed: number;
    abandoned: number;
    focused_ms: number;
  }>(sql`
    select
      to_char(
        (started_at at time zone ${timezone}) - interval '${sql.raw(String(DAY_ROLLOVER_HOUR))} hours',
        'YYYY-MM-DD'
      ) as day,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'abandoned')::int as abandoned,
      coalesce(sum(planned_minutes * 60000) filter (where status = 'completed'), 0)::bigint as focused_ms
    from focus_session
    where user_id = ${userId} and status in ('completed', 'abandoned')
    group by 1`);

  const map = new Map<string, DayActivity & { focusedMs: number }>();
  for (const r of rows.rows ?? (rows as unknown as typeof rows.rows)) {
    map.set(r.day, {
      completed: Number(r.completed),
      abandoned: Number(r.abandoned),
      focusedMs: Number(r.focused_ms),
    });
  }
  return map;
}

async function loadVacationDays(userId: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(vacations)
    .where(and(eq(vacations.userId, userId), isNull(vacations.cancelledAt)));
  const days = new Set<string>();
  for (const v of rows) for (const d of dayRange(v.startDay, v.endDay)) days.add(d);
  return days;
}

export type Advance = {
  today: string;
  settings: Settings;
  state: StreakRow;
  /** Days this call just froze, so the UI can say so once (§7). */
  frozeDays: string[];
  brokeOn: string | null;
};

/**
 * Brings the streak up to date with the calendar. Every elapsed day since the
 * last walk is judged in order, spending freezes as it goes — the result is the
 * same whether the app was opened every morning or not for three weeks.
 */
export async function advanceStreak(userId: string, now = new Date()): Promise<Advance> {
  const settings = await loadSettings(userId);
  const today = gameDay(now, settings.timezone);
  let row = await loadStreakState(userId);

  const yesterday = addDays(today, -1);
  const from = row.lastEvaluatedDay ? addDays(row.lastEvaluatedDay, 1) : null;

  // Nothing has elapsed since the last walk.
  if (from !== null && daysBetween(from, yesterday) < 0) {
    return { today, settings, state: row, frozeDays: [], brokeOn: null };
  }

  const activity = await loadActivity(userId, settings.timezone);

  // First ever walk starts at the first day with any history, not at the epoch.
  const firstKnown = [...activity.keys()].sort()[0];
  const start = from ?? firstKnown ?? today;
  if (daysBetween(start, yesterday) < 0) {
    return { today, settings, state: row, frozeDays: [], brokeOn: null };
  }

  const vacationDays = await loadVacationDays(userId);

  // Anything the ledger has already judged keeps that verdict.
  const judgedRows = await db
    .select({ day: dayLedger.day, state: dayLedger.state })
    .from(dayLedger)
    .where(and(eq(dayLedger.userId, userId), gte(dayLedger.day, start)));
  const judged = new Map(judgedRows.map((r) => [r.day, r.state]));

  const { verdicts, state } = walkDays({
    days: dayRange(start, yesterday),
    activity: (d) => activity.get(d),
    restWeekdays: settings.restWeekdays,
    isVacation: (d) => vacationDays.has(d),
    state: toEngine(row),
    judged: (d) => judged.get(d),
  });

  if (verdicts.length > 0) {
    await db
      .insert(dayLedger)
      .values(
        verdicts.map((v) => ({
          userId,
          day: v.day,
          state: v.state,
          completed: activity.get(v.day)?.completed ?? 0,
          abandoned: activity.get(v.day)?.abandoned ?? 0,
          focusedMs: activity.get(v.day)?.focusedMs ?? 0,
          brokeStreak: v.brokeStreak,
          streakAfter: v.streakAfter,
        })),
      )
      .onConflictDoUpdate({
        target: [dayLedger.userId, dayLedger.day],
        set: {
          state: sql`excluded.state`,
          completed: sql`excluded.completed`,
          abandoned: sql`excluded.abandoned`,
          focusedMs: sql`excluded.focused_ms`,
          brokeStreak: sql`excluded.broke_streak`,
          streakAfter: sql`excluded.streak_after`,
        },
      });
  }

  row = await saveStreakState(userId, row, state);

  const broke = verdicts.filter((v) => v.brokeStreak).at(-1)?.day ?? null;
  return {
    today,
    settings,
    state: row,
    frozeDays: verdicts.filter((v) => v.state === "frozen").map((v) => v.day),
    brokeOn: broke,
  };
}

/**
 * Called when a session is finally logged. Credits its game day to the streak
 * and drips 20% of the XP it paid into the Freeze Meter (§7).
 */
export async function recordCompletedSession(
  userId: string,
  startedAt: Date,
  xpEarned: number,
): Promise<void> {
  const settings = await loadSettings(userId);
  const day = gameDay(startedAt, settings.timezone);
  const row = await loadStreakState(userId);

  let next = creditDay(toEngine(row), day);
  next = accrueMeter(next, xpEarned);
  await saveStreakState(userId, row, next);
}

/**
 * Drips a fifth of any earned XP into the Freeze Meter (§7 — "20% of all XP
 * earned"). Sessions are not the only source: achievements pay XP too, and
 * "all" means all. Penalties and purchases are negative and contribute nothing.
 */
export async function accrueMeterForXp(userId: string, xpEarned: number): Promise<void> {
  if (xpEarned <= 0) return;
  const row = await loadStreakState(userId);
  await saveStreakState(userId, row, accrueMeter(toEngine(row), xpEarned));
}

export type VacationCheck =
  | { ok: true; quarter: string }
  | { ok: false; reason: "too_long" | "in_the_past" | "quarter_used" | "backwards" };

export async function checkVacation(
  userId: string,
  startDay: string,
  endDay: string,
  today: string,
): Promise<VacationCheck> {
  if (daysBetween(startDay, endDay) < 0) return { ok: false, reason: "backwards" };
  if (daysBetween(startDay, endDay) + 1 > MAX_VACATION_DAYS) {
    return { ok: false, reason: "too_long" };
  }
  // "Declare up to 21 days off in advance" — a vacation is planned, not backdated.
  if (daysBetween(today, startDay) < 0) return { ok: false, reason: "in_the_past" };

  const quarter = quarterOf(startDay);
  const [existing] = await db
    .select({ id: vacations.id })
    .from(vacations)
    .where(
      and(
        eq(vacations.userId, userId),
        eq(vacations.quarter, quarter),
        isNull(vacations.cancelledAt),
      ),
    )
    .limit(1);
  if (existing) return { ok: false, reason: "quarter_used" };

  return { ok: true, quarter };
}

export async function listVacations(userId: string) {
  return db
    .select()
    .from(vacations)
    .where(and(eq(vacations.userId, userId), isNull(vacations.cancelledAt)))
    .orderBy(vacations.startDay);
}

/** The heatmap's year: judged days from the ledger, plus today, still live. */
export async function loadHeatmap(userId: string, today: string, timezone: string) {
  const from = addDays(today, -364);
  const rows = await db
    .select()
    .from(dayLedger)
    .where(and(eq(dayLedger.userId, userId), gte(dayLedger.day, from)));

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const activity = await loadActivity(userId, timezone);
  const vacationDays = await loadVacationDays(userId);
  const settings = await loadSettings(userId);

  /**
   * Days before any history existed are blank, not rest days. A rest day is a
   * schedule the user chose to keep; painting it back across a year they were
   * never here for would claim something that never happened.
   */
  const firstEver = [...byDay.keys(), ...activity.keys()].sort()[0];

  return dayRange(from, today).map((day) => {
    const judged = byDay.get(day);
    if (judged) {
      return {
        day,
        state: judged.state,
        completed: judged.completed,
        focusedMs: Number(judged.focusedMs),
      };
    }
    // Today, and any day the walk has not reached yet.
    const a = activity.get(day);
    if (firstEver === undefined || day < firstEver) {
      return { day, state: "gap" as const, completed: 0, focusedMs: 0 };
    }
    const state = a?.completed
      ? ("active" as const)
      : vacationDays.has(day)
        ? ("vacation" as const)
        : settings.restWeekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())
          ? ("rest" as const)
          : ("gap" as const);
    return { day, state, completed: a?.completed ?? 0, focusedMs: a?.focusedMs ?? 0 };
  });
}
