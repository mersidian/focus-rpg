import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAIN_WINDOW_MS,
  MAX_CHAIN_LINKS,
  chainMultiplier,
  chainState,
  linksBefore,
  windowRemaining,
  type ChainSession,
} from "../src/lib/chain.ts";

const T = 1_800_000_000_000;
const MIN = 60_000;

/** A settled session of `minutes`, ending `endedAgo` before T. */
function ran(endedAgo: number, minutes = 25, status: ChainSession["status"] = "completed"): ChainSession {
  const endedAt = T - endedAgo;
  return { status, startedAt: endedAt - minutes * MIN, endedAt };
}

test("a first session has nothing behind it and pays the plain rate", () => {
  assert.equal(linksBefore([], T), 0);
  assert.equal(chainMultiplier(0), 1);
});

test("starting inside the window links to the session before it", () => {
  const history = [ran(5 * MIN)];
  assert.equal(linksBefore(history, T), 1);
  assert.equal(chainMultiplier(1), 1.1);
});

test("letting the window close ends the chain", () => {
  const justInside = [ran(CHAIN_WINDOW_MS - 1000)];
  const justOutside = [ran(CHAIN_WINDOW_MS + 1000)];
  assert.equal(linksBefore(justInside, T), 1);
  assert.equal(linksBefore(justOutside, T), 0);
});

test("links accumulate across a run of close sessions", () => {
  // Four sessions, each starting a few minutes after the last one ended.
  const history: ChainSession[] = [];
  let endedAgo = 3 * MIN;
  for (let i = 0; i < 4; i++) {
    history.push(ran(endedAgo));
    endedAgo += 25 * MIN + 3 * MIN;
  }
  assert.equal(linksBefore(history, T), 4);
  assert.equal(chainMultiplier(4), 1.4);
});

test("the chain stops at five links, and so does the bonus", () => {
  const history: ChainSession[] = [];
  let endedAgo = 2 * MIN;
  for (let i = 0; i < 9; i++) {
    history.push(ran(endedAgo));
    endedAgo += 25 * MIN + 2 * MIN;
  }
  assert.equal(linksBefore(history, T), MAX_CHAIN_LINKS);
  assert.equal(chainMultiplier(99), 1.5, "the cap holds however long the run");
});

test("one long gap in the middle cuts the chain there", () => {
  const history = [
    ran(2 * MIN), // linked
    ran(2 * MIN + 25 * MIN + 40 * MIN), // forty minutes earlier: too far
  ];
  assert.equal(linksBefore(history, T), 1);
});

test("an abandon ends the chain, because the link was what you risked", () => {
  const history = [ran(3 * MIN, 25, "abandoned"), ran(3 * MIN + 25 * MIN + 3 * MIN)];
  assert.equal(linksBefore(history, T), 0);
});

test("an abandon closes the window even while its clock would still run", () => {
  assert.equal(windowRemaining(T - MIN, "abandoned", T), null);
  assert.equal(windowRemaining(T - MIN, "completed", T), CHAIN_WINDOW_MS - MIN);
});

test("nothing is open when there is no history", () => {
  assert.equal(windowRemaining(null, null, T), null);
  const state = chainState([], T);
  assert.equal(state.links, 0);
  assert.equal(state.multiplier, 1);
  assert.equal(state.windowMs, null);
});

test("the state offers what the next session would actually pay", () => {
  const history = [ran(4 * MIN), ran(4 * MIN + 25 * MIN + 4 * MIN)];
  const state = chainState(history, T);
  assert.equal(state.links, 2);
  assert.equal(state.multiplier, 1.2);
  assert.equal(state.windowMs, CHAIN_WINDOW_MS - 4 * MIN);
  assert.equal(state.atCap, false);
});

test("a shut window resets the offer to the plain rate", () => {
  const state = chainState([ran(30 * MIN)], T);
  assert.equal(state.links, 0);
  assert.equal(state.multiplier, 1);
  assert.equal(state.windowMs, null);
});

test("the chain never pays for time that was not worked", () => {
  // Five links of 25 minutes pay at most 1.5x, never more than a 50 would.
  const perMinute = (minutes: number, links: number) =>
    (minutes * chainMultiplier(links)) / minutes;
  assert.equal(perMinute(25, MAX_CHAIN_LINKS), 1.5);
  assert.ok(chainMultiplier(MAX_CHAIN_LINKS) < 2, "a chain cannot double a session");
});

/* --------------------- the step depends on the length ---------------------- */

test("a chained fifty is worth more than a chained fifteen", () => {
  // A flat step paid the same for continuing into fifteen minutes as into
  // fifty, which undervalues the harder commitment — and the whole point of the
  // chain is that the link you have not started is the one you are least able
  // to begin.
  for (let links = 1; links <= MAX_CHAIN_LINKS; links++) {
    assert.ok(
      chainMultiplier(links, 50) > chainMultiplier(links, 25),
      `at ${links} links a fifty is worth no more than a twenty-five`,
    );
    assert.ok(
      chainMultiplier(links, 25) > chainMultiplier(links, 15),
      `at ${links} links a twenty-five is worth no more than a fifteen`,
    );
  }
});

test("one link on a fifty clears the old flat rate", () => {
  // The complaint that started this: a single link paid +10% whatever you did
  // with it.
  assert.ok(chainMultiplier(1, 50) > 1.1, `a chained fifty pays ${chainMultiplier(1, 50)}`);
  assert.equal(chainMultiplier(1, 25), 1.1, "the middle length moved");
});

test("every length still starts at one and caps", () => {
  for (const minutes of [15, 25, 50]) {
    assert.equal(chainMultiplier(0, minutes), 1, `${minutes} pays a bonus with no chain`);
    assert.equal(
      chainMultiplier(MAX_CHAIN_LINKS + 5, minutes),
      chainMultiplier(MAX_CHAIN_LINKS, minutes),
      `${minutes} keeps climbing past the cap`,
    );
  }
  // And the cap is a real spread, not a rounding difference.
  assert.ok(chainMultiplier(MAX_CHAIN_LINKS, 50) >= 1.7);
  assert.ok(chainMultiplier(MAX_CHAIN_LINKS, 15) <= 1.35);
});

test("an unknown length falls back to the middle rate rather than paying nothing", () => {
  assert.equal(chainMultiplier(3, 40), chainMultiplier(3, 25));
});

test("the state quotes every length, so each slab can speak for itself", () => {
  const state = chainState(
    [{ status: "completed", startedAt: 1_000, endedAt: 2_000 }],
    2_000 + 60_000,
  );
  assert.equal(state.links, 1);
  for (const minutes of [15, 25, 50]) {
    assert.equal(state.multiplierByLength[minutes], chainMultiplier(state.links, minutes));
  }
  assert.equal(state.multiplier, chainMultiplier(state.links, 25), "the single figure drifted");
});
