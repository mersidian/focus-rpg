import type { AbandonReason } from "./constants";
import type { LevelChange } from "./game-state";

export type ClientSession = {
  id: string;
  plannedMinutes: number;
  ruleset: "desktop" | "mobile";
  status: "active" | "paused" | "awaiting_report";
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  pauseCount: number;
  lastHeartbeatAt: number;
  xpAwarded: number;
};

export type ClientState = {
  xp: number;
  level: number;
  lifetimeFocusedMs: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  version: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  sessions: number;
  focusedMs: number;
};

export type LogEntry = {
  id: string;
  plannedMinutes: number;
  ruleset: "desktop" | "mobile";
  status: "completed" | "abandoned";
  startedAt: number;
  endedAt: number | null;
  xpAwarded: number;
  /** What it paid before any slack reduction, so a correction is exact. */
  baseXp: number;
  /**
   * Links behind this session, and what they multiplied it by.
   *
   * Derived at read time rather than stored — the chain is never stored, or it
   * could drift from the ledger — so the log can explain why a session paid what
   * it did instead of showing a number with no account of itself.
   */
  chainLinks: number;
  chainMultiplier: number;
  pauseCount: number;
  abandonReason: AbandonReason | null;
  projectName: string | null;
  note: string | null;
  honest: boolean | null;
};

export type StreakSummary = {
  /** Today's game day, in the user's timezone. */
  today: string;
  streak: number;
  longestStreak: number;
  freezes: number;
  pendingFreezes: number;
  /** Freeze Meter progress toward the next freeze, 0-1. */
  meterProgress: number;
  /** Whether today already has a completed session. */
  activeToday: boolean;
  restWeekdays: number[];
  /** Days the last catch-up froze, so the UI can say so once (§7). */
  frozeDays: string[];
  brokeOn: string | null;
};

export type Snapshot = {
  /** The server's clock. The client trusts this over its own (§2). */
  serverNow: number;
  state: ClientState;
  active: ClientSession | null;
  awaitingReport: ClientSession | null;
  projects: ProjectSummary[];
  recent: LogEntry[];
  /** What the last reconciliation did, if anything, so the UI can say so. */
  settled: SettleEvent | null;
  levelChange: LevelChange | null;
  /**
   * What the game paid for the session just logged, or null.
   *
   * Set by `submitReport` alone, never by `buildSnapshot` — which runs on every
   * heartbeat and every visibility change, so a field that read back the newest
   * result would re-fire the result screen for ever.
   */
  game: ResolutionSummary | null;
  streak: StreakSummary;
  /** Achievements this call just unlocked, so the UI can mark the moment (§5). */
  unlocked: UnlockedAchievement[];
  prestige: PrestigeSummary;
  /** The session chain: what the next session would pay, and how long is left. */
  chain: ChainSummary;
};

export type ChainSummary = {
  links: number;
  /** What the chain is worth per session length; the step depends on it. */
  multiplierByLength: Record<number, number>;
  /** The 25-minute figure, for anything that wants a single number. */
  multiplier: number;
  windowMs: number | null;
  atCap: boolean;
};

export type PrestigeSummary = {
  stars: number;
  bonusPercent: number;
  /** The choice is live: level 50 reached and not yet decided this cycle. */
  offerAvailable: boolean;
  /** An earned achievement title being worn instead of the rank (§5). */
  wornTitle: string | null;
};

export type UnlockedAchievement = {
  id: string;
  name: string;
  description: string;
  family: string;
  rarity: string;
  xp: number;
  freezes: number;
  title: string | null;
  hidden: boolean;
};

export type SettleEvent =
  | { kind: "completed"; sessionId: string; xp: number; plannedMinutes: number }
  | { kind: "abandoned"; sessionId: string; reason: AbandonReason; xp: number };

export type { LevelChange };

/* ------------------------- what a session came to ------------------------- */

export type MilestonePaid = {
  marker: string;
  label: string;
  xp: number;
  /** Set when this lump carried the character over a rank. */
  levelChange?: LevelChange | null;
};

/**
 * What one resolved session paid, as it was paid.
 *
 * It lived inside a `server-only` module, which is why nothing downstream could
 * name it — and nothing did: `resolveActivity` built one on every completed
 * session and its only caller dropped it on the floor. So a fifty-minute fight
 * that stopped after four minutes because the ammunition ran out reported
 * "+1250 XP banked" and not one word more.
 *
 * Here it is one shape for four jobs: the service's return value, the contents
 * of `session_activity.result`, a field on the snapshot, and a client prop. A
 * second declaration would be a second thing to keep in step.
 */
export type ResolutionSummary = {
  kind: "gathering" | "combat" | "boss";
  skill: string;
  tier: number;
  units?: number;
  kills?: number;
  failures?: number;
  legendaryKills?: number;
  coins: number;
  fuel: number;
  skillXp: number;
  /**
   * What the session banked.
   *
   * `itemId` is the fact and the name is only how it renders, so the reader
   * looks the name up rather than trusting the one stored beside it. The first
   * version of this stored the name alone, and renaming a material left every
   * log line before the rename saying "Copper Catch" about a fish for ever.
   * `name` stays for the rows written before the id was there.
   */
  items: { itemId?: string; name: string; qty: number }[];
  equipmentKept: number;
  equipmentSalvaged: number;
  ranDry?: boolean;
  /** True when ammunition ran out and the session stopped fighting. */
  outOfAmmo?: boolean;
  ammoUsed?: number;
  /** Upgrade stones from salvage, when the rule is set to stones. */
  salvageStones?: number;
  /** Lumps paid into the character ladder by this session (§11). */
  milestones: MilestonePaid[];

  /* --- what the screen needs to explain its own numbers ------------------- */

  /** Minutes the server actually timed, which every figure above derives from. */
  minutes?: number;
  /** The name of the area or boss, so the screen can say where you were. */
  where?: string;
  /** Which style the fight was fought as. */
  style?: string;

  /**
   * The factors that turned minutes into units, in the order they applied.
   *
   * `resolveYield` computes each of these and folds them into one multiplier
   * that nobody reads. The house rule is that a figure which is the product of
   * a multiplier has to show its parts — "a number the user cannot take apart
   * is a number they cannot trust, and they will assume the smallest of the
   * possible explanations".
   */
  yieldParts?: { label: string; factor: number }[];
  /** What was expected before the roll, so a lucky one is legible as luck. */
  unitsExpected?: number;

  /** The two halves of `coins`, which is a sum and should read as one. */
  coinsFromDrops?: number;
  coinsFromSalvage?: number;
  killsByRarity?: Record<string, number>;
  rationsUsed?: number;
  /** Rounds carried in, so running out can say what ran out. */
  ammoCarried?: number;
  /** Seconds of the session actually spent fighting. */
  secondsFought?: number;
  /** Kept gear by name, because the names are the reward. */
  equipment?: { name: string; slot: string; quality: string; percentile: number }[];

  /** How far a boss fight got, 0-1, and what it was. */
  bossProgress?: number;
  bossName?: string;
  bossWeakTo?: string;
  bossDown?: boolean;
  /** True when the session was simply not long enough to land the kill. */
  bossTooShort?: boolean;

  /** A rank arriving off a milestone lump, so the overlay can still fire. */
  levelChange?: LevelChange | null;
};
