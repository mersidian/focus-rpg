/**
 * Phase 1 game constants. Every value here is fixed by SPEC-V1.md §3 and §4 unless
 * marked "spec-silent" — those are implementation choices, kept in one place so
 * they are easy to find and argue with later.
 */

export const SESSION_LENGTHS = [15, 25, 50] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

/** XP is 1 per focused minute; a 50-minute session pays a +20% bonus. (§3) */
export const XP_BY_LENGTH: Record<SessionLength, number> = {
  15: 15,
  25: 25,
  50: 60,
};

/** Abandoning costs 30 XP, applied immediately. (§3) */
export const ABANDON_XP_PENALTY = 30;

/**
 * Spec-silent: §6 says a "slacked" admission "reduces that session's XP but
 * carries no further penalty" without naming a number. Half feels like an
 * honest admission rather than a punishment.
 */
export const SLACKED_XP_MULTIPLIER = 0.5;

/** 2 pauses per session, 5 minutes total. Exceeding either abandons. (§3) */
export const MAX_PAUSES = 2;
export const MAX_PAUSED_MS = 5 * 60 * 1000;

/** Desktop presence: ping every 15s, abandon after a 2-minute gap. (§3) */
export const HEARTBEAT_INTERVAL_MS = 15 * 1000;
export const HEARTBEAT_GRACE_MS = 2 * 60 * 1000;

export type AbandonReason =
  | "gave_up"
  | "pause_count"
  | "pause_budget"
  | "heartbeat_lost"
  | "superseded";

export const ABANDON_REASON_LABEL: Record<AbandonReason, string> = {
  gave_up: "Gave up",
  pause_count: "Used a third pause",
  pause_budget: "Ran out of pause time",
  heartbeat_lost: "Page went away for over two minutes",
  superseded: "Started another session",
};
