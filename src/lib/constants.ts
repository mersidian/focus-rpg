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
 * Whether a person actually decided this abandon.
 *
 * §3 lists four triggers under one −30 and treats them as one thing. They are
 * not. Two of them are a person choosing to stop:
 *
 *   `gave_up`     — they pressed the button that says Give up.
 *   `superseded`  — they started a second session on top of a live one.
 *
 * The other two were the app deciding on their behalf, and both have been taken
 * out of the code that could produce them:
 *
 *   `heartbeat_lost` is an *inference*, and the spec says elsewhere that it is
 *   an unreliable one — phone sessions have no heartbeat at all precisely
 *   because "mobile browsers freeze background tabs and would register false
 *   abandons". Desktop browsers freeze tabs now too, and a sleeping laptop
 *   always did, so a page that is open and a page that is pinging are no longer
 *   the same thing — while §3's own rule is about existence: "Other tabs do not
 *   matter. Only the page's existence is checked." A frozen tab exists.
 *
 *   `pause_budget` and `pause_count` no longer end a session at all. Running
 *   out of pause time restarts the clock (see `evaluate`), and pressing Pause
 *   with nothing left is refused rather than forfeited. They survive as labels
 *   because rows on the books still carry them.
 *
 * So this is the one question worth asking about an abandon, and three things
 * read it: the penalty, the completion ratio, and the streak.
 */
export function abandonWasChosen(reason: AbandonReason): boolean {
  return reason === "gave_up" || reason === "superseded";
}

/**
 * What an abandon costs. The session ends either way — the server cannot
 * witness focus it was not shown, and will not take a client's word for it
 * later — but the −30 is for giving up, and nobody gave up.
 */
export function abandonPenalty(reason: AbandonReason): number {
  return abandonWasChosen(reason) ? ABANDON_XP_PENALTY : 0;
}

/**
 * Whether it counts as a failed session: against the completion ratio, and
 * toward the two-in-a-day that breaks a streak (§3).
 *
 * The same answer as the penalty, deliberately. A free abandon that still broke
 * a streak and still dragged a ratio down would be the same punishment wearing
 * a different name.
 */
export function abandonIsAFailure(reason: AbandonReason): boolean {
  return abandonWasChosen(reason);
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
