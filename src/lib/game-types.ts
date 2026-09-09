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
