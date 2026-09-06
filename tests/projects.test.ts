import assert from "node:assert/strict";
import { test } from "node:test";
import { PROJECT_TIERS, hoursToNextTier, rankProject } from "../src/lib/projects.ts";

const h = (n: number) => n * 3_600_000;

test("the ladder is the five titles the spec names, in order", () => {
  assert.deepEqual(
    PROJECT_TIERS.map((t) => [t.title, t.hours]),
    [
      ["Seedling", 1],
      ["Sapling", 10],
      ["Grove", 50],
      ["Landmark", 200],
      ["Monument", 500],
    ],
  );
});

test("a project under an hour has no title yet", () => {
  const rank = rankProject(h(0.5));
  assert.equal(rank.index, 0);
  assert.equal(rank.title, null);
  assert.equal(rank.nextTitle, "Seedling");
});

test("each title is earned exactly on its hour", () => {
  for (const [i, tier] of PROJECT_TIERS.entries()) {
    assert.equal(rankProject(h(tier.hours)).title, tier.title, tier.title);
    assert.equal(rankProject(h(tier.hours) - 1).index, i, `just short of ${tier.title}`);
  }
});

test("Monument is the end of the ladder", () => {
  const rank = rankProject(h(500));
  assert.equal(rank.title, "Monument");
  assert.equal(rank.nextTitle, null);
  assert.equal(rank.nextHours, null);
  assert.equal(rank.progress, 1);
  assert.equal(hoursToNextTier(h(900)), null);
});

test("progress spans the current title's own stretch", () => {
  assert.equal(rankProject(h(1)).progress, 0, "just became a Seedling");
  assert.equal(rankProject(h(5.5)).progress, 0.5, "halfway from Seedling to Sapling");
  assert.equal(rankProject(h(10)).progress, 0, "just became a Sapling");
});

test("hours owed counts down to the next title", () => {
  assert.equal(hoursToNextTier(h(0)), 1);
  assert.equal(hoursToNextTier(h(40)), 10);
  assert.equal(hoursToNextTier(h(480)), 20);
});

test("480 hours on the thesis is a Landmark, not yet a Monument", () => {
  // The spec calls this the single most motivating number the app can show.
  const rank = rankProject(h(480));
  assert.equal(rank.title, "Landmark");
  assert.equal(rank.nextTitle, "Monument");
});
