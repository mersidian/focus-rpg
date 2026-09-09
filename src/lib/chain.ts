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
/** Each link past the first adds this much. */
export const CHAIN_STEP = 0.1;
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
export function chainMultiplier(links: number): number {
  return 1 + CHAIN_STEP * Math.min(Math.max(links, 0), MAX_CHAIN_LINKS);
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
  /** What that next session would pay. */
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
    multiplier: chainMultiplier(links),
    windowMs,
    atCap: links >= MAX_CHAIN_LINKS,
  };
}
