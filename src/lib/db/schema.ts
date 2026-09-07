import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ------------------------------------------------------------------ auth.js */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ------------------------------------------------------------------- game */

export const projects = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Projects are never hard-deleted (§2 sync model). */
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    /**
     * Set when this project was merged into another. The row survives so the
     * old name stays resolvable and the merge stays visible (§2, §6).
     */
    mergedIntoId: text("merged_into_id"),
  },
  (t) => [uniqueIndex("project_user_name_idx").on(t.userId, t.name)],
);

export type SessionStatus =
  | "active"
  | "paused"
  | "awaiting_report"
  | "completed"
  | "abandoned";

export const focusSessions = pgTable(
  "focus_session",
  {
    /**
     * Client-generated so a local-first start can be retried without creating a
     * duplicate session row.
     */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    plannedMinutes: integer("planned_minutes").notNull(),
    /** "desktop" enforces the heartbeat; "mobile" does not (§3). */
    ruleset: text("ruleset").$type<"desktop" | "mobile">().notNull(),
    deviceId: text("device_id").notNull(),

    status: text("status").$type<SessionStatus>().notNull().default("active"),

    /** Server clock. Client clocks are never trusted for elapsed time (§2). */
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    pausedAt: timestamp("paused_at", { mode: "date", withTimezone: true }),
    pausedMs: integer("paused_ms").notNull().default(0),
    pauseCount: integer("pause_count").notNull().default(0),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),

    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    abandonReason: text("abandon_reason"),

    xpAwarded: integer("xp_awarded").notNull().default(0),
    /**
     * What the session paid before any slack reduction, including whatever
     * prestige bonus applied at the time. Kept so the honest/slacked flag can
     * be corrected later and land on the same figure: halving and doubling do
     * not round-trip through an odd number.
     */
    baseXp: integer("base_xp").notNull().default(0),

    projectId: text("project_id").references(() => projects.id),
    note: text("note"),
    honest: boolean("honest"),
    reportedAt: timestamp("reported_at", { mode: "date", withTimezone: true }),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("focus_session_user_started_idx").on(t.userId, t.startedAt),
    index("focus_session_user_status_idx").on(t.userId, t.status),
  ],
);

export const gameState = pgTable("game_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  xp: integer("xp").notNull().default(0),
  /** Ratcheted: never decreases, even when XP does (§4.1). */
  level: integer("level").notNull().default(1),
  /**
   * The highest level ever reached, across every prestige cycle. `level` goes
   * back to 1 on a reset; this never moves down, so "reach level 50" and "reach
   * Mythic V" stay earned after the reset that follows them (§4.2, §5).
   */
  peakLevel: integer("peak_level").notNull().default(1),

  lifetimeFocusedMs: bigint("lifetime_focused_ms", { mode: "number" })
    .notNull()
    .default(0),
  sessionsCompleted: integer("sessions_completed").notNull().default(0),
  sessionsAbandoned: integer("sessions_abandoned").notNull().default(0),

  /** Monotonic; every mutation bumps it. Newest version wins on conflict (§2). */
  version: integer("version").notNull().default(0),
  deviceId: text("device_id"),

  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Every superseded game_state row is kept. Nothing in this app is ever
 * hard-deleted (§2).
 */
export const gameStateBackups = pgTable(
  "game_state_backup",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    deviceId: text("device_id"),
    payload: jsonb("payload").notNull(),
    reason: text("reason").notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("game_state_backup_user_idx").on(t.userId, t.version)],
);

/* --------------------------------------------------- streaks and freezes */

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  /**
   * Every game day is resolved against this, never the browser's zone — the
   * character must show the same streak on a laptop and on a phone abroad (§7).
   */
  timezone: text("timezone").notNull().default("Asia/Bangkok"),

  /** Up to two weekday numbers, 0 = Sunday. Never break a streak (§7). */
  restWeekdays: integer("rest_weekdays").array().notNull().default([]),

  /** For the birthday achievement. Only the month and day are ever read. */
  birthday: date("birthday", { mode: "string" }),
  /**
   * Public holidays are a local matter and the spec names no country, so they
   * are a list the user keeps rather than a calendar baked into the code.
   */
  holidays: date("holidays", { mode: "string" }).array().notNull().default([]),

  /** An earned achievement title worn in place of the level title (§5). */
  wornTitle: text("worn_title"),

  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const streakState = pgTable("streak_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),

  freezes: integer("freezes").notNull().default(0),
  /** Granted while the bank was full; they land when it drops below cap (§7). */
  pendingFreezes: integer("pending_freezes").notNull().default(0),
  /** Freeze Meter, in hundredths of a freeze point so 20% of any XP is exact. */
  meter: integer("meter").notNull().default(0),
  streakFreezesGranted: integer("streak_freezes_granted").notNull().default(0),

  /** Guards crediting, so one day can never count toward the streak twice. */
  lastCountedDay: date("last_counted_day", { mode: "string" }),
  /** How far the day walk has judged. Days after this are still unresolved. */
  lastEvaluatedDay: date("last_evaluated_day", { mode: "string" }),

  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per elapsed game day, holding the verdict the walk reached. The
 * session table can always say what happened on a day, but only this records
 * whether a freeze was spent on it — that is a decision, not a fact, and it
 * cannot be recomputed after the bank has moved on.
 */
export const dayLedger = pgTable(
  "day_ledger",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    state: text("state")
      .$type<"active" | "frozen" | "rest" | "vacation" | "gap">()
      .notNull(),
    completed: integer("completed").notNull().default(0),
    abandoned: integer("abandoned").notNull().default(0),
    focusedMs: bigint("focused_ms", { mode: "number" }).notNull().default(0),
    brokeStreak: boolean("broke_streak").notNull().default(false),
    streakAfter: integer("streak_after").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/** Declared in advance, up to 21 days, once per calendar quarter (§7). */
export const vacations = pgTable(
  "vacation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDay: date("start_day", { mode: "string" }).notNull(),
    endDay: date("end_day", { mode: "string" }).notNull(),
    /** The calendar quarter the declaration is charged to, e.g. "2026-Q3". */
    quarter: text("quarter").notNull(),
    declaredAt: timestamp("declared_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
  },
  (t) => [index("vacation_user_start_idx").on(t.userId, t.startDay)],
);

/* ----------------------------------------------------- achievements */

/**
 * One row per earned achievement. Unlocks are permanent: nothing here is ever
 * revoked, even if the statistic that earned it later falls (§4.1's ratchet
 * applies to the whole progression, not just to levels).
 */
export const achievementUnlocks = pgTable(
  "achievement_unlock",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    /**
     * What the session paid before any slack reduction, including whatever
     * prestige bonus applied at the time. Kept so the honest/slacked flag can
     * be corrected later and land on the same figure: halving and doubling do
     * not round-trip through an odd number.
     */
    baseXp: integer("base_xp").notNull().default(0),
    freezesAwarded: integer("freezes_awarded").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.achievementId] }),
    index("achievement_unlock_user_idx").on(t.userId, t.unlockedAt),
  ],
);

/* --------------------------------------------------------- prestige */

export const prestigeState = pgTable("prestige_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  /** Stack to ten; the XP bonus caps at +50% (§4.2). */
  stars: integer("stars").notNull().default(0),

  /** When the current cycle began — the first cycle starts at sign-up. */
  cycleStartedAt: timestamp("cycle_started_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  /** When this cycle first reached level 50, if it has. */
  reachedFiftyAt: timestamp("reached_fifty_at", { mode: "date", withTimezone: true }),
  /** When the user chose to press on instead. Cleared by the next reset. */
  declinedAt: timestamp("declined_at", { mode: "date", withTimezone: true }),

  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per completed cycle. Nothing is lost on a reset — the history is the
 * point of prestige (§4.2), and two achievements read it.
 */
export const prestigeCycles = pgTable(
  "prestige_cycle",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
    reachedFiftyAt: timestamp("reached_fifty_at", { mode: "date", withTimezone: true }),
    prestigedAt: timestamp("prestiged_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Abandons inside the cycle, for "prestige with zero abandons" (§5). */
    abandons: integer("abandons").notNull().default(0),
    /** XP surrendered at the reset, kept so the history stays legible. */
    xpAtReset: integer("xp_at_reset").notNull().default(0),
    levelAtReset: integer("level_at_reset").notNull().default(0),
  },
  (t) => [index("prestige_cycle_user_idx").on(t.userId, t.ordinal)],
);
