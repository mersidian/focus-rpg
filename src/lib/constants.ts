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

/**
 * Spec-silent: how soon to try again after a check-in fails.
 *
 * Waiting a full interval after a failure spends a twelfth of the grace period
 * doing nothing, and failures come in blips — a redeploy, a cold database, a
 * dropped wifi second. Three seconds turns the two-minute grace into forty
 * attempts instead of eight.
 */
export const HEARTBEAT_RETRY_MS = 3 * 1000;

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
  heartbeat_lost: "The page stopped reporting in",
  superseded: "Started another session",
};

/**
 * What an abandon costs, which is not the same for all four reasons.
 *
 * §3 lists four triggers under one −30: giving up, blowing the pause budget,
 * starting a second session, and a desktop heartbeat gap. Three of those are
 * decisions a person makes. The fourth is an *inference* about a decision, and
 * the spec already says elsewhere that it is an unreliable one — phone sessions
 * have no heartbeat at all precisely because "mobile browsers freeze background
 * tabs and would register false abandons".
 *
 * Desktop browsers do it too now. Chrome and Edge freeze a backgrounded tab
 * outright after about five minutes, and a sleeping laptop does the same, so a
 * page that is open and a page that is pinging are no longer the same thing —
 * while §3's own rule is about existence: "Other tabs do not matter. Only the
 * page's existence is checked." A frozen tab exists. It was being charged 30 XP
 * for continuing to exist quietly.
 *
 * So the session still ends — the server cannot witness focus it was not shown,
 * and it will not take a client's word for it later. But it is not fined for a
 * decision nobody made. The penalty is for giving up, and this is the one
 * trigger where nobody did.
 */
export function abandonPenalty(reason: AbandonReason): number {
  return reason === "heartbeat_lost" ? 0 : ABANDON_XP_PENALTY;
}

/** The reasons that count toward the two-in-a-day that breaks a streak (§3). */
export function abandonCountsAgainstStreak(reason: AbandonReason): boolean {
  return reason !== "heartbeat_lost";
}

/* ------------------------- how many at a time ------------------------- */

/**
 * The most one press may buy or make.
 *
 * Both services clamp to these, and the quantity field reads them, so the box
 * cannot ask for a number the server would silently trim — a field that accepts
 * 500 crafts and quietly performs 100 is a field that lies about what it did.
 * They live here rather than in the services because both of those are
 * `server-only` and the input is not.
 */
export const MAX_BUY_AT_ONCE = 1000;
export const MAX_CRAFT_AT_ONCE = 100;
