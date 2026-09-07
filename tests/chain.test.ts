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
