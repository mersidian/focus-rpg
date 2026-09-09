/**
 * The session chain.
 *
 * Not in SPEC-V1.md. It answers the risk the spec records against itself in §10:
 * every mechanic rewards, none asks the user to choose, and the only genuine
 * either/or — prestige — sits a thousand hours away. The spec names the cut
 * mechanic that used to create the decision: descend-or-extract. This is that
 * shape, without the combat §1 threw out.
 *
 * Finish a session and a window opens. Start another inside it and the next one
 * pays more; let it close and you are back to the plain rate. The link you have
 * not started yet is always worth the most, and is always the one you are least
 * able to finish — which is the decision.
 *
 * §3 is not bent to do this: "XP banks immediately on completion. There is no
 * run, no unbanked pool, no extract step." Every session still banks its own
 * XP the moment it completes, at whatever rate was in force when it started.
 * What is at risk is never banked XP — only the multiplier, and the usual −30.
 */

/** How long after a session ends the next one still counts as linked. */
export const CHAIN_WINDOW_MS = 10 * 60_000;
/**
 * Each link past the first adds this much — and how much depends on the length
 * of the session you are starting.
 *
 * A flat step paid the same for continuing into fifteen minutes as into fifty,
 * which undervalues the harder commitment: the whole point of the chain is that
 * the link you have not started is worth the most and is the one you are least
 * able to begin, and beginning a fifty is much harder than beginning a fifteen.
 *
 * So a chained fifty pays +15% a link where a fifteen pays +6%. At the five-link
 * cap that is ×1.75 against ×1.30 — a real reason to spend the chain on the long
 * one rather than farm short ones inside the window.
 */
export const CHAIN_STEP_BY_LENGTH: Record<number, number> = {
  15: 0.06,
  25: 0.1,
  50: 0.15,
};

/** The step for a length not in the table, and the old flat value. */
export const CHAIN_STEP = 0.1;

export function chainStep(minutes: number): number {
  return CHAIN_STEP_BY_LENGTH[minutes] ?? CHAIN_STEP;
}
/** Five steps, so the chain tops out at half again. */
export const MAX_CHAIN_LINKS = 5;

export type ChainSession = {
  status: "completed" | "abandoned" | "awaiting_report";
  startedAt: number;
  endedAt: number | null;
};

/**
 * How many links stand behind a session that began at `startedAt`.
 *
 * `history` is that user's settled sessions, most recent first, and must not
 * include the session being asked about. An abandon ends a chain: the link is
 * the thing you were risking.
 */
export function linksBefore(history: ChainSession[], startedAt: number): number {
  let links = 0;
  let boundary = startedAt;

  for (const session of history) {
    if (session.endedAt === null) break;
    if (session.endedAt > boundary) continue; // not yet behind the boundary
    if (session.status === "abandoned") break;
    if (boundary - session.endedAt > CHAIN_WINDOW_MS) break;

    links += 1;
    if (links >= MAX_CHAIN_LINKS) break;
    boundary = session.startedAt;
  }

  return links;
}

/** What a session with this many links behind it pays, as a multiplier. */
export function chainMultiplier(links: number, minutes = 25): number {
  return 1 + chainStep(minutes) * Math.min(Math.max(links, 0), MAX_CHAIN_LINKS);
}

/** Milliseconds left to start the next link, or null if no chain is open. */
export function windowRemaining(
  lastEndedAt: number | null,
  lastStatus: ChainSession["status"] | null,
  now: number,
): number | null {
  if (lastEndedAt === null || lastStatus === "abandoned") return null;
  const left = lastEndedAt + CHAIN_WINDOW_MS - now;
  return left > 0 ? left : null;
}

/** The whole chain state, ready for the interface. */
export type ChainState = {
  /** Links behind the next session you could start. */
  links: number;
  /**
   * What that next session would pay, per length.
   *
   * Per length because the step depends on it: the same chain is worth more
   * spent on a fifty than on a fifteen, and the timer has to be able to say so
   * on each button rather than quoting one number for all three.
   */
  multiplierByLength: Record<number, number>;
  /** The 25-minute figure, for anything that wants one number. */
  multiplier: number;
  /** Time left to claim it, or null if there is nothing open. */
  windowMs: number | null;
  /** True once the chain is as long as it goes. */
  atCap: boolean;
};

export function chainState(
  history: ChainSession[],
  now: number,
): ChainState {
  const last = history.find((s) => s.endedAt !== null) ?? null;
  const windowMs = windowRemaining(last?.endedAt ?? null, last?.status ?? null, now);

  // With the window shut, the next session starts a fresh chain.
  const links = windowMs === null ? 0 : linksBefore(history, now);
  return {
    links,
    multiplierByLength: Object.fromEntries(
      Object.keys(CHAIN_STEP_BY_LENGTH).map((n) => [Number(n), chainMultiplier(links, Number(n))]),
    ),
    multiplier: chainMultiplier(links, 25),
    windowMs,
    atCap: links >= MAX_CHAIN_LINKS,
  };
}
