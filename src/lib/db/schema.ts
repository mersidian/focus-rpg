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
import type { ResolutionSummary } from "../game-types";

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

/* ------------------------------------------------------------- V2: the game */

/**
 * What a session's character was doing (SPEC-V2.md §5).
 *
 * Chosen BEFORE the timer starts, because the requirement gate has to be
 * evaluated before you commit fifty minutes — and because a choice made
 * afterwards would let a session be claimed as combat once its roll was known.
 *
 * Separate from the project tag on `focus_session`: one is what your character
 * did, the other is what you did. They are orthogonal on purpose.
 */
export const sessionActivities = pgTable(
  "session_activity",
  {
    sessionId: text("session_id")
      .primaryKey()
      .references(() => focusSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"gathering" | "combat" | "boss">().notNull(),
    /** The gathering or combat skill this session fed. */
    skill: text("skill").notNull(),
    /** Resource tier for gathering; area tier for combat. */
    tier: integer("tier").notNull(),
    /** Combat only. */
    biome: integer("biome"),
    area: integer("area"),
    /** The style fought as, so a recompute need not guess at the loadout. */
    style: text("style").$type<"melee" | "ranged" | "magic" | "gun">(),
    /**
     * A tonic drunk with the activity, spent at entry (§15.4).
     *
     * Stored rather than re-derived because it is a decision: the potion is gone
     * the moment the session starts, and a resolution has to know what was paid
     * for even if the bank no longer shows it.
     */
    tonicItemId: text("tonic_item_id"),
    /** Resolved once, on completion, and never again. */
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
    /**
     * What the session came to. Written at resolution and never updated.
     *
     * These are counters rather than a log of every kill: an achievement asking
     * "1,000 kills" should not require a row per goblin, and the ledger already
     * holds everything that was actually obtained.
     */
    kills: integer("kills").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    legendaryKills: integer("legendary_kills").notNull().default(0),
    unitsGathered: integer("units_gathered").notNull().default(0),

    /**
     * The whole of what this session came to, as it was paid.
     *
     * The counters above are what SQL needs to judge an achievement; this is
     * what the user needs to see what happened. Written in the same statement
     * that sets `resolved_at`, so it can never disagree with the guard.
     *
     * It is a record of writes already made and never a thing to recompute.
     * Re-deriving it from the ledger is not possible even in principle — coins
     * and fuel go through the wallet, which writes no ledger row; skill XP goes
     * to `skill_state`; a milestone is a `world_progress` marker with no
     * session on it; and gear that was salvaged rather than kept leaves no
     * trace of having existed. A screen assembled from what survives would show
     * a smaller number than the one that was paid. Re-rolling for display is
     * out too: yield is seeded from the session id precisely so a resolution is
     * reproducible, and a roll shown to the user has to be the roll they got.
     */
    result: jsonb("result").$type<ResolutionSummary>(),
  },
  (t) => [index("session_activity_user_idx").on(t.userId, t.resolvedAt)],
);

/**
 * The inventory ledger (SPEC-V2.md §10.1).
 *
 * **Append-only.** Every grant and every spend is a row, and a balance is a fold
 * over the rows — nothing here is ever mutated and nothing is ever deleted.
 *
 * This is the shape the whole architecture turns on. Grants derive from
 * `focus_session` and can be rebuilt from it; spends are DECISIONS, which
 * `db:recompute` replays in order rather than recomputing. That is the same
 * carve-out spending a freeze already has, and it is what lets a bug in a spend
 * rule be fixed by correcting the rule and replaying, instead of by hand-editing
 * quantities nobody can audit.
 */
export const inventoryEntries = pgTable(
  "inventory_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The generated catalogue id, e.g. "raw:Ore:12". */
    itemId: text("item_id").notNull(),
    /** Positive for a grant, negative for a spend. Never zero. */
    delta: integer("delta").notNull(),
    reason: text("reason")
      .$type<
        | "session_yield"
        | "combat_drop"
        | "craft_output"
        | "craft_input"
        | "sold"
        | "bought"
        | "consumed"
        | "refine_cost"
        | "salvage"
      | "exchanged"
        | "gate_entry"
        | "correction"
      >()
      .notNull(),
    /** The session that caused it, where there was one. */
    sessionId: text("session_id").references(() => focusSessions.id, { onDelete: "set null" }),
    /** Ordering for replay. Monotonic per user. */
    seq: bigint("seq", { mode: "number" }).notNull(),
    at: timestamp("at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_entry_user_seq_idx").on(t.userId, t.seq),
    index("inventory_entry_user_item_idx").on(t.userId, t.itemId),
  ],
);

/**
 * A cache of the ledger above, for reads.
 *
 * Same relationship `game_state` has to `focus_session`: convenient, and never
 * the truth. Where this disagrees with the ledger, the ledger wins.
 */
export const inventoryBalances = pgTable(
  "inventory_balance",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    qty: integer("qty").notNull().default(0),
    /** The ledger sequence this balance was folded up to. */
    throughSeq: bigint("through_seq", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

/**
 * Every item type ever obtained, permanently (SPEC-V2.md §9).
 *
 * A limited bank breaks the collection achievements on its own — "every item of
 * one material tier" is hundreds of items against sixty starting slots. So
 * collection reads THIS, never current holdings: you have to have found it, not
 * still be holding it. Selling a Legendary never erases that you had one.
 */
export const collectionLog = pgTable(
  "collection_log",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    firstAt: timestamp("first_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    /** The best band percentile ever seen for this item, 0-1000 for precision. */
    bestRoll: integer("best_roll").notNull().default(0),
    seen: integer("seen").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

/** One row per skill per user. XP only ever rises. */
export const skillStates = pgTable(
  "skill_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
    xp: bigint("xp", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skill] })],
);

/**
 * One owned piece of equipment.
 *
 * The catalogue is a definition; this is an instance. The difference is the
 * three axes that only exist once something has actually dropped: the rolled
 * value inside its band, the quality window it landed in, and whatever
 * refinement has since been paid for.
 *
 * Worn equipment is never destroyed (§7), so `durability` floors at zero and the
 * row stays.
 */
export const equipmentInstances = pgTable(
  "equipment_instance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The catalogue id it was generated from. */
    itemId: text("item_id").notNull(),
    slot: text("slot").notNull(),
    style: text("style").$type<"melee" | "ranged" | "magic" | "gun">().notNull(),
    tier: integer("tier").notNull(),
    quality: text("quality").notNull(),
    archetype: text("archetype"),
    /** The rolled value, stored x1000 so it is an integer. */
    rolled: integer("rolled").notNull(),
    refine: integer("refine").notNull().default(0),
    durability: integer("durability").notNull().default(100),
    /** Which slot it is worn in, or null if it is in the bank. */
    equippedSlot: text("equipped_slot"),
    foundAt: timestamp("found_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    sessionId: text("session_id").references(() => focusSessions.id, { onDelete: "set null" }),
  },
  (t) => [
    index("equipment_user_slot_idx").on(t.userId, t.slot),
    uniqueIndex("equipment_one_per_slot_idx").on(t.userId, t.equippedSlot),
  ],
);

/**
 * Coins, fuel, and the two caps money buys.
 *
 * Derived from the ledger like everything else, and cached here for reads. Fuel
 * does not decay — it is capped instead (§2), and fuel earned at cap is simply
 * not granted rather than lost.
 */
export const wallets = pgTable("wallet", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  coins: bigint("coins", { mode: "number" }).notNull().default(0),
  fuel: integer("fuel").notNull().default(0),
  fuelCap: integer("fuel_cap").notNull().default(500),
  bankSlots: integer("bank_slots").notNull().default(60),
  /** Set once; salvage pays coins or upgrade stones, never both. */
  salvageOutput: text("salvage_output").$type<"coins" | "stones">().notNull().default("coins"),
  /** Auto-salvage thresholds, as band percentiles x1000. */
  salvageBelow: integer("salvage_below").notNull().default(600),
  keepAbove: integer("keep_above").notNull().default(900),
  autoRepair: boolean("auto_repair").notNull().default(true),
  version: integer("version").notNull().default(0),
});

/**
 * Farming plots (SPEC-V2.md §6).
 *
 * `stagesLeft` counts down by one per COMPLETED SESSION, whatever the session
 * was doing — never by elapsed time. That is the whole reason Farming is legal
 * here: the user's focus is the only clock in this app.
 */
export const farmPlots = pgTable(
  "farm_plot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 1-based, and how many exist is bought with coins. */
    slot: integer("slot").notNull(),
    seedItemId: text("seed_item_id"),
    stagesLeft: integer("stages_left").notNull().default(0),
    plantedAt: timestamp("planted_at", { mode: "date", withTimezone: true }),
  },
  (t) => [uniqueIndex("farm_plot_user_slot_idx").on(t.userId, t.slot)],
);

/**
 * The Slaying contract. One at a time, and it never expires (§7).
 *
 * Daily contracts were rejected: three-a-day-or-lose-them is a login incentive,
 * and this app already has a healthier one in the streak.
 */
export const slayingContracts = pgTable(
  "slaying_contract",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantName: text("variant_name").notNull(),
    biome: integer("biome").notNull(),
    required: integer("required").notNull(),
    killed: integer("killed").notNull().default(0),
    tier: integer("tier").notNull(),
    takenAt: timestamp("taken_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
  },
  (t) => [index("slaying_user_idx").on(t.userId, t.completedAt)],
);

/**
 * What the world has given up so far: bosses down, key items held, areas seen.
 *
 * A boss's FIRST kill always drops its signature unique, so the row has to
 * remember that it happened — a guaranteed drop that fires twice is a bug, and
 * one that never fires is worse.
 */
export const worldProgress = pgTable(
  "world_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "boss:14:lord", "key:rimeworksCipher", "area:7:3". */
    marker: text("marker").notNull(),
    count: integer("count").notNull().default(1),
    firstAt: timestamp("first_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.marker] })],
);
