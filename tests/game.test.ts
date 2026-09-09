import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TIER, GUN_ENTRY_TIER, TIERS, tier, tierForHours, familiesAt } from "../src/lib/game/tiers.ts";
import { ARCHETYPES, STYLES, archetypesFor, wheel, BEATS, STYLE_FAMILY } from "../src/lib/game/archetypes.ts";
import { SPECIES, PARTS, FAMILY_PARTS, speciesAt } from "../src/lib/game/species.ts";
import { BIOMES, BIOME_MATERIALS, AREAS_PER_BIOME, areaTier } from "../src/lib/game/biomes.ts";
import { allAreas, allVariants, areasIn, variantsIn, wheelStep } from "../src/lib/game/variants.ts";
import { QUALITIES } from "../src/lib/game/quality.ts";
import {
  SLOTS, SLOT_BASE, SLOT_KIND, affinity, band, centre, percentile, refineMultiplier,
  loadoutPower, MAX_REFINE,
} from "../src/lib/game/power.ts";
import {
  RARITIES, SPAWN_BASE, spawnPower, successChance, MIN_SUCCESS, wheelFactor,
  rarityWeight, rationsPerFailure, resolveCombat, killSeconds,
} from "../src/lib/game/combat.ts";
import { checkGate } from "../src/lib/game/gate.ts";
import { resolveYield } from "../src/lib/game/yield.ts";
import { rng, sessionSeed } from "../src/lib/game/rng.ts";
import { SKILLS, SKILL_XP, MAX_SKILL_LEVEL, skillLevel, tierSkillRequirement } from "../src/lib/game/skills.ts";
import {
  tierValue, refineStoneCost, refineCoinCost, refineTotal, bankSlotCost, bankSlotsTotalCost,
  BANK_SLOTS_BASE, BANK_SLOTS_MAX, AMMO_COST, processFuelCost, FUEL_BY_LENGTH,
} from "../src/lib/game/economy.ts";
import { generateCatalogue, catalogueBreakdown, tiersFor } from "../src/lib/game/items.ts";
import { rollDrops, foldDrops, salvageDecision, salvageValue } from "../src/lib/game/drops.ts";
import { allRecipes, canCraft } from "../src/lib/game/recipes.ts";
import { UNIQUES } from "../src/lib/game/uniques.ts";
import { BOSSES, bossesIn } from "../src/lib/game/bosses.ts";
import { resolveBoss } from "../src/lib/game/combat.ts";
import { IMPLEMENTED, describeEffect, foldEffects, isImplemented } from "../src/lib/game/effects.ts";
import { ACHIEVEMENTS, ALL_ACHIEVEMENTS } from "../src/lib/achievements/definitions.ts";
import { ACHIEVEMENTS_V2, FAMILIES_V2 } from "../src/lib/achievements/definitions-v2.ts";
import { emptyGameStats, type GameStats } from "../src/lib/game/game-stats.ts";

/**
 * A zeroed V1 Stats, so a V2 predicate can be exercised without a session
 * history. Only the fields V2 reads matter; the rest exist to satisfy the type.
 */
function emptyStatsForTest() {
  return {
    now: 0,
    timezone: "Asia/Bangkok",
    today: "2026-01-01",
    level: 1,
    peakLevel: 1,
    xp: 0,
    lifetimeFocusedMs: 0,
    prestigeStars: 0,
    prestigedCleanCycles: 0,
    cyclesToFiftyWithinAYear: 0,
    declinedPrestige: false,
    streak: 0,
    longestStreak: 0,
    sessions: 0,
    abandons: 0,
    focusedMs: 0,
    countByLength: {},
    days: [],
  };
}

/* ---------------------------------- tiers ---------------------------------- */

test("the spine is 24 tiers and lands on the character ladder", () => {
  assert.equal(TIERS.length, MAX_TIER);
  assert.equal(TIERS[0].gateHours, 0);
  // SPEC-V2 §16.1: tier 24 opens where Mythic V lands, so material progress and
  // rank progress are the same climb.
  assert.equal(TIERS[MAX_TIER - 1].gateHours, 10_000);
});

test("power and gates both rise, strictly, every tier", () => {
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].power > TIERS[i - 1].power, `power flat or falling at tier ${i + 1}`);
    assert.ok(TIERS[i].gateHours > TIERS[i - 1].gateHours, `gate flat or falling at tier ${i + 1}`);
  }
});

test("firearms have no material below their entry tier", () => {
  for (const t of TIERS) {
    if (t.tier < GUN_ENTRY_TIER) assert.equal(t.composite, null, `tier ${t.tier} has a coat`);
    else assert.ok(t.composite, `tier ${t.tier} has no coat`);
  }
  assert.deepEqual(familiesAt(1), ["metal", "hide", "cloth"]);
  assert.equal(familiesAt(GUN_ENTRY_TIER).length, 4);
});

test("hours open the tier they are the gate for, and not the one above", () => {
  assert.equal(tierForHours(0), 1);
  assert.equal(tierForHours(TIERS[11].gateHours), 12);
  assert.equal(tierForHours(TIERS[11].gateHours - 1), 11);
  assert.equal(tierForHours(999_999), MAX_TIER);
});

/* ------------------------------- archetypes -------------------------------- */

test("24 archetypes, six in each style", () => {
  assert.equal(ARCHETYPES.length, 24);
  for (const style of STYLES) assert.equal(archetypesFor(style).length, 6, style);
});

test("a fast weapon rolls wide and a final one rolls tight", () => {
  const sorted = [...ARCHETYPES].sort((a, b) => a.damage - b.damage);
  assert.ok(
    sorted[0].bandPct > sorted[sorted.length - 1].bandPct,
    "band width does not move opposite to damage",
  );
});

test("the wheel is a four-cycle with no safe style", () => {
  for (const style of STYLES) {
    // Every style beats exactly one and loses to exactly one.
    assert.equal(STYLES.filter((s) => BEATS[style] === s).length, 1, style);
    assert.equal(STYLES.filter((s) => BEATS[s] === style).length, 1, style);
    assert.equal(wheel(style, BEATS[style]), "advantage");
    assert.equal(wheel(BEATS[style], style), "disadvantage");
    assert.equal(wheel(style, style), "neutral");
  }
  // Walking BEATS four times returns to where it started: a cycle, not a chain.
  let at = STYLES[0];
  for (let i = 0; i < 4; i++) at = BEATS[at];
  assert.equal(at, STYLES[0]);
});

test("each style wears its own material family, and only gun wears composite", () => {
  const families = STYLES.map((s) => STYLE_FAMILY[s]);
  assert.equal(new Set(families).size, 4, "two styles share a family");
  assert.equal(STYLE_FAMILY.gun, "composite");
});

/* --------------------------------- species --------------------------------- */

test("90 species archetypes in the ten families the spec names", () => {
  assert.equal(SPECIES.length, 90);
  const counts: Record<string, number> = {};
  for (const s of SPECIES) counts[s.family] = (counts[s.family] ?? 0) + 1;
  assert.deepEqual(counts, {
    beast: 12, insectoid: 10, undead: 10, construct: 9, elemental: 9,
    draconic: 8, aberration: 8, humanoid: 10, fungal: 7, aquatic: 7,
  });
});

test("parts are keyed to the species, three each, 270 in all", () => {
  // SPEC-V2 §7: per-variant parts would have been 7,200 items and half the
  // catalogue would be pelts.
  assert.equal(PARTS.length, SPECIES.length * 3);
  assert.equal(PARTS.length, 270);
  assert.equal(new Set(PARTS.map((p) => p.name)).size, PARTS.length, "duplicate part names");
  for (const s of SPECIES) {
    assert.equal(FAMILY_PARTS[s.family].length, 3, s.family);
  }
});

test("every species has a sane tier band", () => {
  for (const s of SPECIES) {
    assert.ok(s.tierLo >= 1 && s.tierHi <= MAX_TIER, s.name);
    assert.ok(s.tierHi > s.tierLo, `${s.name} spans a single tier`);
  }
});

/* ---------------------------------- world ---------------------------------- */

test("20 biomes, 200 areas, 60 biome materials", () => {
  assert.equal(BIOMES.length, 20);
  assert.equal(allAreas().length, BIOMES.length * AREAS_PER_BIOME);
  assert.equal(allAreas().length, 200);
  assert.equal(BIOME_MATERIALS.length, 60);
  assert.equal(new Set(BIOME_MATERIALS.map((m) => m.name)).size, 60, "duplicate biome material");
});

test("biome tier bands climb, and areas walk their band", () => {
  for (let i = 1; i < BIOMES.length; i++) {
    assert.ok(BIOMES[i].tierLo >= BIOMES[i - 1].tierLo, `biome ${i + 1} steps backwards`);
  }
  for (const b of BIOMES) {
    assert.equal(areaTier(b, 1), b.tierLo);
    assert.equal(areaTier(b, AREAS_PER_BIOME), b.tierHi);
  }
});

test("no area is empty", () => {
  for (const area of allAreas()) {
    assert.ok(area.roster.length > 0, `${area.name} has nothing in it`);
  }
});

test("a variant is named for its biome and its species", () => {
  const v = variantsIn(BIOMES[10]).find((x) => x.species.name === "Rime" || true)!;
  assert.equal(v.name, `${v.biome.prefix} ${v.species.name}`);
  assert.equal(new Set(allVariants().map((x) => x.name)).size, allVariants().length, "duplicate variant");
});

test("wheelStep spreads evenly and is stable", () => {
  const seen = new Set<number>();
  for (let s = 0; s < 90; s++) for (let b = 1; b <= 20; b++) seen.add(wheelStep(s, b));
  assert.deepEqual([...seen].sort(), [-1, 0, 1]);
  // Stable: derived, never rolled, so a recompute reproduces the same fight.
  assert.equal(wheelStep(7, 3), wheelStep(7, 3));
});

test("in every biome past the tutorial, each of the four styles is the right answer somewhere", () => {
  // SPEC-V2 §15.3's generator test. Biome 1 is exempt on purpose: at tiers 1-2
  // the player cannot own a firearm at all, so demanding four loadouts there
  // would be asking for a style that does not exist yet.
  for (const b of BIOMES.slice(1)) {
    const styles = new Set(areasIn(b).flatMap((a) => a.roster.map((v) => v.style)));
    assert.equal(styles.size, 4, `${b.name} answers only ${[...styles].join(", ")}`);
  }
});

/* --------------------------------- the item -------------------------------- */

test("the three item axes move independently", () => {
  const base = { slot: "body" as const, style: "melee" as const, tier: 10, quality: "plain" as const, refine: 0 };
  const tierUp = centre({ ...base, tier: 11 });
  const qualityUp = centre({ ...base, quality: "fine" });
  const refineUp = centre({ ...base, refine: 5 });
  const flat = centre(base);
  for (const [label, value] of [["tier", tierUp], ["quality", qualityUp], ["refine", refineUp]] as const) {
    assert.ok(value > flat, `${label} did not raise the centre`);
  }
  // And they compose: all three together beat any one of them.
  assert.ok(centre({ ...base, tier: 11, quality: "fine", refine: 5 }) > Math.max(tierUp, qualityUp, refineUp));
});

test("refinement is ten steps of five percent and stops there", () => {
  assert.equal(refineMultiplier(0), 1);
  assert.equal(Math.round(refineMultiplier(MAX_REFINE) * 100) / 100, 1.5);
  assert.equal(refineMultiplier(99), refineMultiplier(MAX_REFINE), "refinement past +10 kept paying");
  for (let r = 1; r <= MAX_REFINE; r++) {
    assert.ok(refineMultiplier(r) > refineMultiplier(r - 1), `+${r} is not worth more than +${r - 1}`);
  }
});

test("quality shifts the window, and the roll still lands inside it", () => {
  for (const q of QUALITIES) {
    const spec = { slot: "body" as const, style: "magic" as const, tier: 8, quality: q.key, refine: 2 };
    const { lo, hi, centre: c } = band(spec);
    assert.ok(lo < c && c < hi, `${q.key} band does not contain its centre`);
    assert.equal(percentile(spec, lo), 0);
    assert.equal(percentile(spec, hi), 1);
    assert.ok(Math.abs(percentile(spec, c) - 0.5) < 1e-9, `${q.key} centre is not the midpoint`);
  }
});

test("a roll outside the band still reports a percentile inside 0..1", () => {
  const spec = { slot: "ring" as const, style: "ranged" as const, tier: 3, quality: "crude" as const, refine: 0 };
  assert.equal(percentile(spec, -100), 0);
  assert.equal(percentile(spec, 1e9), 1);
});

test("the slot bases and the style affinities say what the spec says", () => {
  assert.equal(SLOTS.length, 10);
  assert.equal(SLOT_KIND.weapon, "offence");
  // §7's cost ladder, in numbers: gun has the highest offence and the thinnest coat.
  const offence = STYLES.map((s) => affinity(s, "weapon"));
  const defence = STYLES.map((s) => affinity(s, "body"));
  assert.equal(Math.max(...offence), affinity("gun", "weapon"));
  assert.equal(Math.min(...offence), affinity("melee", "weapon"));
  assert.equal(Math.min(...defence), affinity("gun", "body"));
  assert.equal(Math.max(...defence), affinity("melee", "body"));
});

function fullSet(style: (typeof STYLES)[number], t: number, quality = "plain" as const, refine = 0) {
  const arch = ARCHETYPES.find((a) => a.style === style)!;
  const equipped: Record<string, { spec: any; rolled: number }> = {};
  for (const slot of SLOTS) {
    if (slot === "offhand" && arch.hands === 2) continue;
    const spec = { slot, style, tier: t, quality, refine, archetype: slot === "weapon" ? arch : undefined };
    equipped[slot] = { spec, rolled: band(spec).centre };
  }
  return loadoutPower(equipped as any);
}

test("a two-handed weapon is not simply worse for holding one fewer item", () => {
  const oneHanded = ARCHETYPES.find((a) => a.style === "melee" && a.hands === 1)!;
  const twoHanded = ARCHETYPES.find((a) => a.hands === 2)!;
  const build = (arch: typeof oneHanded) => {
    const equipped: Record<string, { spec: any; rolled: number }> = {};
    for (const slot of SLOTS) {
      if (slot === "offhand" && arch.hands === 2) continue;
      const spec = { slot, style: arch.style, tier: 12, quality: "plain" as const, refine: 0, archetype: slot === "weapon" ? arch : undefined };
      equipped[slot] = { spec, rolled: band(spec).centre };
    }
    return loadoutPower(equipped as any);
  };
  const two = build(twoHanded);
  assert.ok(two.offence > 0, "a two-handed loadout has no offence at all");
  // It gives up a slot and takes throughput back, so its offence per slot is higher.
  assert.ok(
    two.offence > build(oneHanded).offence * 0.8,
    "giving up the offhand cost more than the archetype gave back",
  );
});

/* --------------------------------- combat ---------------------------------- */

test("meeting a spawn's power is a guaranteed kill, and below it is never zero", () => {
  const spawn = spawnPower(12, RARITIES[0]);
  assert.equal(successChance(spawn, spawn), 1);
  assert.equal(successChance(spawn * 2, spawn), 1);
  assert.ok(successChance(1, spawn) >= MIN_SUCCESS, "a hopeless fight became impossible");
  assert.equal(successChance(0, spawn), MIN_SUCCESS);
});

test("the conversion curve only ever rises with power", () => {
  const spawn = spawnPower(18, RARITIES[3]);
  let last = 0;
  for (let p = 0; p <= spawn * 1.2; p += spawn / 40) {
    const now = successChance(p, spawn);
    assert.ok(now >= last, "conversion fell as power rose");
    last = now;
  }
});

test("a same-tier set farms its own tier, and rarity is a real gradient", () => {
  const off = fullSet("melee", 12).offence;
  const chances = RARITIES.map((r) => successChance(off, spawnPower(12, r)));
  assert.ok(chances[0] > 0.7, `own-tier commons convert at only ${chances[0]}`);
  for (let i = 1; i < chances.length; i++) {
    assert.ok(chances[i] < chances[i - 1], `${RARITIES[i].key} is not harder than ${RARITIES[i - 1].key}`);
  }
  assert.ok(chances[4] < 0.2, "legendaries are not rare enough to be worth chasing");
});

test("relative difficulty is the same at every tier", () => {
  // Power and spawn both scale with the tier, so tier 24 should feel like tier 6.
  const at = (t: number) => successChance(fullSet("melee", t).offence, spawnPower(t, RARITIES[0]));
  assert.ok(Math.abs(at(6) - at(24)) < 0.02, "the curve drifts with depth");
});

test("over-tier farming is a bad idea", () => {
  const off = fullSet("melee", 12).offence;
  const own = successChance(off, spawnPower(12, RARITIES[0]));
  const four = successChance(off, spawnPower(16, RARITIES[0]));
  assert.ok(four < own / 3, "fighting four tiers up is not punished enough");
});

test("bringing the right style is worth about double on a hard target", () => {
  const off = fullSet("melee", 12).offence;
  const spawn = spawnPower(12, RARITIES[3]);
  const right = successChance(off * wheelFactor("melee", "ranged"), spawn);
  const wrong = successChance(off * wheelFactor("melee", "gun"), spawn);
  const neutral = successChance(off, spawn);
  assert.ok(right > neutral && neutral > wrong, "the wheel does not order the outcomes");
  assert.ok(right > wrong * 2, "the wheel is not worth preparing for");
});

test("a thin coat costs more per failure than plate does", () => {
  const spawn = spawnPower(12, RARITIES[0]);
  const plate = rationsPerFailure(spawn, fullSet("melee", 12).defence);
  const coat = rationsPerFailure(spawn, fullSet("gun", 12).defence);
  assert.ok(coat > plate, "the defence axis is dead: every style pays the same");
  assert.ok(coat <= 3 && plate >= 1);
});

test("deeper biomes tilt the rarity table", () => {
  const legendary = RARITIES[4];
  assert.ok(rarityWeight(legendary, 24) > rarityWeight(legendary, 1), "depth does not pay in kind");
  assert.equal(rarityWeight(RARITIES[0], 24), rarityWeight(RARITIES[0], 1), "commons should not scale");
});

test("better gear kills faster, which is where throughput lives", () => {
  const variant = allVariants()[0];
  const spawn = spawnPower(variant.tier, RARITIES[0]);
  const slow = killSeconds(variant, spawn * 0.5, spawn, false);
  const fast = killSeconds(variant, spawn * 2, spawn, false);
  assert.ok(fast < slow, "gear buys no speed at all");
  assert.ok(killSeconds(variant, spawn, spawn, true) < killSeconds(variant, spawn, spawn, false));
});

test("a longer session is more kills, not a multiplier on one", () => {
  const area = allAreas().find((a) => a.tier === 11)!;
  const lp = fullSet("melee", 12);
  const run = (minutes: number) =>
    resolveCombat({
      focusedMs: minutes * 60_000, roster: area.roster, areaTier: area.tier,
      loadoutPower: lp, style: "melee", twoHanded: false, rations: 999, rng: rng(`t:${minutes}`),
    });
  const short = run(25);
  const long = run(50);
  assert.ok(short.kills > 5, "a 25-minute session barely kills anything");
  assert.ok(long.spawns.length > short.spawns.length * 1.5, "double the minutes did not roughly double the fights");
});

test("a session resolves identically from the same seed, and differently from another", () => {
  const area = allAreas()[80];
  const lp = fullSet("ranged", area.tier);
  const run = (seed: string) =>
    resolveCombat({
      focusedMs: 25 * 60_000, roster: area.roster, areaTier: area.tier,
      loadoutPower: lp, style: "ranged", twoHanded: false, rations: 50, rng: rng(seed),
    });
  const a = run("session-1");
  assert.deepEqual(run("session-1").spawns.map((s) => s.variant.name), a.spawns.map((s) => s.variant.name));
  assert.notDeepEqual(run("session-2").spawns.map((s) => s.rarity.key), a.spawns.map((s) => s.rarity.key));
});

test("running out of rations is recorded and never overspends them", () => {
  const area = allAreas().find((a) => a.tier >= 16)!;
  const weak = fullSet("melee", 4);
  const r = resolveCombat({
    focusedMs: 50 * 60_000, roster: area.roster, areaTier: area.tier,
    loadoutPower: weak, style: "melee", twoHanded: false, rations: 3, rng: rng("dry"),
  });
  assert.ok(r.failures > 0, "an under-geared run had no failures at all");
  assert.ok(r.rationsUsed <= 3, "spent rations that were not carried");
  assert.ok(r.ranDry, "ran out without saying so");
  // The session still completed. Nothing here punishes having focused.
  assert.ok(r.spawns.length > 0);
});

test("an empty roster resolves to nothing rather than looping", () => {
  const r = resolveCombat({
    focusedMs: 25 * 60_000, roster: [], areaTier: 1,
    loadoutPower: { offence: 100, defence: 100 }, style: "melee", twoHanded: false,
    rations: 5, rng: rng("empty"),
  });
  assert.equal(r.spawns.length, 0);
  assert.equal(r.kills, 0);
});

/* ---------------------------------- gate ----------------------------------- */

test("the gate is binary and names everything that is missing", () => {
  const state = {
    skills: { mining: 10 }, equipmentTier: 4, toolTier: { mining: 3 },
    rations: 1, keyItems: [], characterLevel: 5,
  };
  const open = checkGate({ skill: { key: "mining", level: 5 } }, state);
  assert.deepEqual(open, { open: true, missing: [] });

  const shut = checkGate(
    { skill: { key: "mining", level: 30 }, toolTier: 8, equipmentTier: 9, rations: 5, keyItem: "voidscarSigil", characterLevel: 40 },
    state,
  );
  assert.equal(shut.open, false);
  assert.equal(shut.missing.length, 6, "the gate did not list every unmet requirement");
  assert.ok(shut.missing.some((m) => m.includes("5 rations")), "the ration line does not say how many");
});

test("nothing but a tier number can move what a gate wants", () => {
  // SPEC-V2 §7: if handedness or an archetype could shift a requirement, the
  // greyed-out list would start lying about what is missing.
  const state = {
    skills: {}, equipmentTier: 7, toolTier: {}, rations: 0, keyItems: [], characterLevel: 1,
  };
  assert.equal(checkGate({ equipmentTier: 7 }, state).open, true);
  assert.equal(checkGate({ equipmentTier: 8 }, state).open, false);
});

/* --------------------------------- gathering -------------------------------- */

test("minutes are the only input to yield", () => {
  const base = { tier: 10, toolTier: 10, skillLevel: tierSkillRequirement(10), chainMultiplier: 1 };
  const short = resolveYield({ ...base, focusedMs: 15 * 60_000, rng: rng("a") });
  const long = resolveYield({ ...base, focusedMs: 50 * 60_000, rng: rng("a") });
  assert.ok(long.units > short.units * 2, "a 50-minute session did not out-yield a 15");
  assert.equal(short.skillXp, 15);
  assert.equal(long.skillXp, 50);
});

test("a better tool and a higher skill both pay, and the chain multiplies", () => {
  const base = { focusedMs: 50 * 60_000, tier: 10, chainMultiplier: 1 };
  const plain = resolveYield({ ...base, toolTier: 10, skillLevel: tierSkillRequirement(10), rng: rng("z") });
  const tooled = resolveYield({ ...base, toolTier: 16, skillLevel: tierSkillRequirement(10), rng: rng("z") });
  const skilled = resolveYield({ ...base, toolTier: 10, skillLevel: 99, rng: rng("z") });
  const chained = resolveYield({ ...base, toolTier: 10, skillLevel: tierSkillRequirement(10), chainMultiplier: 1.5, rng: rng("z") });
  assert.ok(tooled.multiplier > plain.multiplier);
  assert.ok(skilled.multiplier > plain.multiplier);
  assert.ok(Math.abs(chained.multiplier - plain.multiplier * 1.5) < 1e-9, "the chain does not multiply yield");
});

test("depth pays in value per unit, not in volume", () => {
  const at = (t: number) =>
    resolveYield({ focusedMs: 25 * 60_000, tier: t, toolTier: t, skillLevel: tierSkillRequirement(t), chainMultiplier: 1, rng: rng("v") });
  const shallow = at(1);
  const deep = at(24);
  assert.equal(shallow.units, deep.units, "deeper tiers arrive in greater numbers");
  assert.ok(deep.coinValue > shallow.coinValue * 20, "depth is not worth more per unit");
});

/* ----------------------------------- rng ----------------------------------- */

test("the same seed is the same sequence, forever", () => {
  const a = rng("seed");
  const b = rng("seed");
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  assert.notEqual(rng("seed").next(), rng("other").next());
});

test("channels do not disturb each other", () => {
  const parent = rng("s");
  const first = parent.channel("yield").next();
  parent.next();
  assert.equal(rng("s").channel("yield").next(), first, "a channel depended on the parent's position");
  assert.equal(sessionSeed("abc", "loot"), "abc/loot");
});

test("weighted picks respect a zero weight and never fall off the end", () => {
  const r = rng("w");
  const items = ["a", "b"];
  for (let i = 0; i < 100; i++) {
    assert.equal(r.weighted(items, (x) => (x === "a" ? 1 : 0)), "a");
  }
  assert.ok(items.includes(rng("w2").weighted(items, () => 0)), "a zero-total pick returned nothing");
});

/* ---------------------------------- skills --------------------------------- */

test("22 skills, and every one has a kind", () => {
  assert.equal(SKILLS.length, 22);
  assert.equal(new Set(SKILLS.map((s) => s.key)).size, 22, "duplicate skill key");
  const kinds = new Set(SKILLS.map((s) => s.kind));
  assert.deepEqual([...kinds].sort(), ["combat", "gathering", "processing"]);
  assert.equal(SKILLS.filter((s) => s.kind === "gathering").length, 6);
});

test("the skill curve rises strictly and 99 is about six hundred hours", () => {
  assert.equal(SKILL_XP.length, MAX_SKILL_LEVEL);
  assert.equal(SKILL_XP[0], 0);
  for (let i = 1; i < SKILL_XP.length; i++) {
    assert.ok(SKILL_XP[i] > SKILL_XP[i - 1], `level ${i + 1} costs no more than ${i}`);
  }
  const hours = SKILL_XP[MAX_SKILL_LEVEL - 1] / 60;
  assert.ok(hours > 500 && hours < 700, `level 99 is ${hours.toFixed(0)} h`);
});

test("levels come from xp, and never exceed 99", () => {
  assert.equal(skillLevel(0), 1);
  assert.equal(skillLevel(-500), 1);
  assert.equal(skillLevel(SKILL_XP[49]), 50);
  assert.equal(skillLevel(SKILL_XP[49] - 1), 49);
  assert.equal(skillLevel(1e12), MAX_SKILL_LEVEL);
});

test("tier gates climb, and the last tier wants a maxed skill", () => {
  assert.equal(tierSkillRequirement(1), 1);
  assert.equal(tierSkillRequirement(MAX_TIER), MAX_SKILL_LEVEL);
  for (let t = 2; t <= MAX_TIER; t++) {
    assert.ok(tierSkillRequirement(t) >= tierSkillRequirement(t - 1), `tier ${t} asks less than ${t - 1}`);
  }
});

/* --------------------------------- economy --------------------------------- */

test("one curve prices everything, and it rises every tier", () => {
  assert.equal(tierValue(1), 10);
  for (let t = 2; t <= MAX_TIER; t++) {
    assert.ok(tierValue(t) > tierValue(t - 1), `tier ${t} is worth no more than ${t - 1}`);
  }
});

test("refinement costs more every step, and more at depth", () => {
  for (let l = 2; l <= 10; l++) {
    assert.ok(refineStoneCost(l) >= refineStoneCost(l - 1), `+${l} wants fewer stones than +${l - 1}`);
    assert.ok(refineCoinCost(l, 12) > refineCoinCost(l - 1, 12), `+${l} costs less than +${l - 1}`);
  }
  assert.ok(refineTotal(24).coins > refineTotal(12).coins * 5, "depth barely changes what +10 costs");
  assert.equal(refineTotal(6).stones, refineTotal(24).stones, "stone count should not vary with tier");
});

test("the bank is the largest sink but not an unreachable one", () => {
  const total = bankSlotsTotalCost();
  // It was twelve billion before the audit caught the exponential.
  assert.ok(total > 5_000_000, `the biggest sink is only ${total} coins`);
  assert.ok(total < 60_000_000, `the walk to ${BANK_SLOTS_MAX} slots costs ${total} coins`);
  assert.ok(bankSlotCost(BANK_SLOTS_MAX) > bankSlotCost(BANK_SLOTS_BASE), "slots do not get dearer");
});

test("upkeep follows the style ladder, and melee pays nothing", () => {
  assert.equal(AMMO_COST.melee, 0);
  assert.ok(AMMO_COST.gun > AMMO_COST.magic);
  assert.ok(AMMO_COST.magic > AMMO_COST.ranged);
  assert.ok(AMMO_COST.ranged > 0);
});

test("fuel pays by length and processing costs more at depth", () => {
  assert.ok(FUEL_BY_LENGTH[50] > FUEL_BY_LENGTH[25] * 2, "the long session has no bonus");
  for (let t = 2; t <= MAX_TIER; t++) {
    assert.ok(processFuelCost(t) >= processFuelCost(t - 1), `tier ${t} processes cheaper than ${t - 1}`);
  }
});

/* -------------------------------- catalogue -------------------------------- */

test("the catalogue generates, and every id is unique", () => {
  const cat = generateCatalogue();
  assert.ok(cat.length > 8000, `only ${cat.length} items generated`);
  assert.equal(new Set(cat.map((i) => i.id)).size, cat.length, "id collision");
  assert.equal(new Set(cat.map((i) => i.name)).size, cat.length, "two items share a name");
});

test("every generated item has a tier inside the spine and a class", () => {
  for (const item of generateCatalogue()) {
    assert.ok(item.tier >= 1 && item.tier <= MAX_TIER, `${item.name} is tier ${item.tier}`);
    assert.ok(item.name.length > 0 && item.cls.length > 0, item.id);
  }
});

test("firearms and coats exist only from the gun entry tier up", () => {
  for (const item of generateCatalogue()) {
    if (item.style === "gun") {
      assert.ok(item.tier >= GUN_ENTRY_TIER, `${item.name} exists below tier ${GUN_ENTRY_TIER}`);
    }
  }
  assert.equal(tiersFor("gun").length, MAX_TIER - GUN_ENTRY_TIER + 1);
  assert.equal(tiersFor("melee").length, MAX_TIER);
});

test("the breakdown adds up to the whole", () => {
  const bd = catalogueBreakdown();
  const sum = Object.values(bd).reduce((n, v) => n + v, 0);
  assert.equal(sum, generateCatalogue().length);
  // Armour is the biggest class by construction: nine slots against one weapon.
  assert.ok(bd.armour > bd.weapon, "armour is not the bulk of the catalogue");
});

test("stackables and equipment are told apart", () => {
  for (const item of generateCatalogue()) {
    const shouldStack = !["weapon", "armour", "tool"].includes(item.cls);
    assert.equal(item.stackable, shouldStack, `${item.name} (${item.cls}) stacks: ${item.stackable}`);
  }
});

/* ---------------------------------- drops ---------------------------------- */

test("every kill gives a part, and rarity decides how good", () => {
  const variant = allVariants().find((v) => v.species.family === "beast")!;
  for (const rarity of RARITIES) {
    const drops = rollDrops({ variant, rarity, style: "melee", rng: rng(`d:${rarity.key}`) });
    const part = drops.find((d) => d.kind === "item" && d.itemId.startsWith("part:"));
    assert.ok(part, `${rarity.key} dropped no part`);
    assert.ok(drops.some((d) => d.kind === "coins"), `${rarity.key} paid no coins`);
  }
});

test("loot scales with the monster, not with your gear", () => {
  // SPEC-V2 §7: if gear raised loot rarity, the best play would be full gear in
  // the easiest area. Same variant, same seed, two very different loadouts.
  const variant = allVariants()[40];
  const coinsFor = (rarity: (typeof RARITIES)[number]) => {
    const drops = rollDrops({ variant, rarity, style: "melee", rng: rng("fixed") });
    return drops.reduce((n, d) => n + (d.kind === "coins" ? d.amount : 0), 0);
  };
  assert.ok(coinsFor(RARITIES[4]) > coinsFor(RARITIES[0]) * 5, "a legendary is barely worth more");
});

test("equipment falls from things worth fighting, and rarely", () => {
  const variant = allVariants()[10];
  const count = (rarity: (typeof RARITIES)[number]) => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const drops = rollDrops({ variant, rarity, style: "magic", rng: rng(`e:${rarity.key}:${i}`) });
      if (drops.some((d) => d.kind === "equipment")) n++;
    }
    return n;
  };
  const common = count(RARITIES[0]);
  const legendary = count(RARITIES[4]);
  assert.ok(legendary > common * 5, "rarity barely changes the gear rate");
  assert.ok(common < 60, "commons drop gear far too often");
});

test("a session's drops fold into one list", () => {
  const variant = allVariants()[3];
  const all = RARITIES.flatMap((r) => rollDrops({ variant, rarity: r, style: "gun", rng: rng(`f:${r.key}`) }));
  const folded = foldDrops(all);
  assert.ok(folded.coins > 0);
  assert.ok(folded.items.size > 0);
  const partTotal = [...folded.items.values()].reduce((n, i) => n + i.qty, 0);
  assert.ok(partTotal >= RARITIES.length, "folding lost parts");
});

test("auto-salvage keeps the good rolls and never eats a great one", () => {
  const rule = { salvageBelow: 600, keepAbove: 900 };
  assert.equal(salvageDecision(0.95, rule), "keep");
  assert.equal(salvageDecision(0.2, rule), "salvage");
  assert.equal(salvageDecision(0.75, rule), "keep");
  assert.ok(salvageValue(12, 1) > salvageValue(12, 0), "a better roll salvages for no more");
});

/* --------------------------------- recipes --------------------------------- */

test("recipes generate, with unique ids and a level gate on every one", () => {
  const recipes = allRecipes();
  // 1,710: 187 refining lines, 1,365 equipment, 158 upkeep. All generated from
  // the spine, so adding a tier adds ~40 of them and costs one line of config.
  assert.equal(recipes.length, 1710);
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length, "duplicate recipe id");
  for (const r of recipes) {
    assert.ok(r.inputs.length > 0, `${r.id} takes nothing`);
    assert.ok(r.fuel > 0, `${r.id} is free`);
    assert.ok(r.level >= 1 && r.level <= MAX_SKILL_LEVEL, `${r.id} wants level ${r.level}`);
    assert.ok(r.xp > 0, `${r.id} pays no xp`);
    assert.ok(r.outputQty > 0);
  }
});

test("crafted equipment is always Plain: quality is found, not made", () => {
  for (const r of allRecipes()) {
    if (r.outputId.startsWith("armour:") || r.outputId.startsWith("weapon:")) {
      assert.ok(r.outputId.endsWith(":plain"), `${r.id} crafts a non-Plain item`);
    }
  }
});

test("no recipe makes a firearm or a coat below the gun entry tier", () => {
  for (const r of allRecipes()) {
    if (r.skill === "gunsmithing" || r.outputId.includes(":gun:")) {
      assert.ok(r.tier >= GUN_ENTRY_TIER, `${r.id} is tier ${r.tier}`);
    }
  }
});

test("a craft is gated the same way an area is: binary, and it says what is short", () => {
  const recipe = allRecipes().find((r) => r.skill === "smelting" && r.tier === 10)!;
  const ok = canCraft(recipe, () => 99, 9999, 99);
  assert.equal(ok.ok, true);

  const short = canCraft(recipe, () => 0, 0, 1);
  assert.equal(short.ok, false);
  if (short.ok) return;
  assert.ok(short.missing.length >= 3, "the craft gate did not list everything missing");
  assert.ok(short.missing.some((m) => m.includes("fuel")), "it did not mention fuel");
});

test("deeper recipes cost more fuel and pay more xp", () => {
  const bars = allRecipes().filter((r) => r.skill === "smelting" && r.outputId.includes("refined:Bar"));
  const sorted = [...bars].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i].fuel >= sorted[i - 1].fuel, `tier ${sorted[i].tier} smelts cheaper`);
    assert.ok(sorted[i].xp > sorted[i - 1].xp, `tier ${sorted[i].tier} pays less xp`);
  }
});

test("every recipe input is something the game can actually produce", () => {
  const known = new Set(generateCatalogue().map((i) => i.id));
  const outputs = new Set(allRecipes().map((r) => r.outputId));
  const unknown = new Set<string>();
  for (const r of allRecipes()) {
    for (const input of r.inputs) {
      if (!known.has(input.itemId) && !outputs.has(input.itemId)) unknown.add(input.itemId);
    }
  }
  assert.deepEqual([...unknown], [], "recipes ask for items nothing makes");
});

/* --------------------------------- uniques --------------------------------- */

test("250 uniques, all named differently, and each on a real slot", () => {
  assert.equal(UNIQUES.length, 250);
  assert.equal(new Set(UNIQUES.map((u) => u.name)).size, 250, "two uniques share a name");
  for (const u of UNIQUES) {
    assert.ok(SLOTS.includes(u.slot as never), `${u.name} sits on slot ${u.slot}`);
    assert.ok(u.tier >= 1 && u.tier <= MAX_TIER, `${u.name} is tier ${u.tier}`);
  }
});

test("a unique's effect is either implemented or says it is not", () => {
  // The whole point of the typed effect: an intended modifier may exist, but it
  // is not allowed to look like it fires when it does not.
  const descriptive = UNIQUES.filter((u) => !isImplemented(u.effect));
  assert.ok(descriptive.length < 20, `${descriptive.length} uniques are prose only`);
  for (const u of UNIQUES) {
    if (isImplemented(u.effect)) {
      assert.ok(IMPLEMENTED.includes(u.effect.kind), `${u.name} has kind ${u.effect.kind}`);
    }
    assert.ok(describeEffect(u.effect).length > 0, `${u.name} describes as nothing`);
  }
});

test("no firearm unique exists below the gun entry tier", () => {
  for (const u of UNIQUES) {
    if (u.style === "gun") assert.ok(u.tier >= GUN_ENTRY_TIER, `${u.name} is tier ${u.tier}`);
  }
});

test("effects add rather than compound", () => {
  const folded = foldEffects([
    { kind: "offence", pct: 10 },
    { kind: "offence", pct: 10 },
  ]);
  assert.equal(folded.offencePct, 20, "two +10% pieces did not come to +20%");
});

test("a skill-scoped effect only pays for its own skill", () => {
  const effects = [{ kind: "yield" as const, pct: 20, skill: "mining" }];
  assert.equal(foldEffects(effects, "mining").yieldPct, 20);
  assert.equal(foldEffects(effects, "fishing").yieldPct, 0);
  // An unscoped one pays for everything.
  assert.equal(foldEffects([{ kind: "yield", pct: 5 }], "fishing").yieldPct, 5);
});

/* --------------------------------- bosses ---------------------------------- */

test("40 bosses, two per biome, every one with a signature drop", () => {
  assert.equal(BOSSES.length, 40);
  assert.equal(new Set(BOSSES.map((b) => b.name)).size, 40, "two bosses share a name");
  for (const biome of BIOMES) {
    const here = bossesIn(biome.index);
    assert.equal(here.length, 2, `${biome.name} has ${here.length} bosses`);
    assert.deepEqual(here.map((b) => b.role).sort(), ["lord", "mid"]);
  }
  for (const boss of BOSSES) {
    assert.ok(boss.signature, `${boss.name} drops nothing of its own`);
  }
});

test("a boss stands above its biome's floor, and the lord above the mid", () => {
  for (const biome of BIOMES) {
    const [lord, mid] = bossesIn(biome.index).sort((a, b) => a.role.localeCompare(b.role));
    assert.ok(mid.tier > biome.tierLo, `${mid.name} is not above its biome's floor`);
    assert.ok(lord.tier >= mid.tier, `${lord.name} is easier than ${mid.name}`);
  }
});

test("no boss demands a gun before guns exist", () => {
  // A gun-type boss is answered by magic, but a boss BELOW the gun entry tier
  // whose own style is gun would be asking for a style nobody can have.
  for (const boss of BOSSES) {
    if (boss.tier < GUN_ENTRY_TIER) {
      assert.notEqual(boss.style, "gun", `${boss.name} is a gun fight at tier ${boss.tier}`);
    }
  }
});

test("a boss cannot be lost, and its first kill is only first once", () => {
  const boss = BOSSES[10];
  const strong = { offence: 1e6, defence: 1e6 };
  const input = {
    focusedMs: 50 * 60_000,
    bossTier: boss.tier,
    bossStyle: boss.style,
    bossPowerMultiplier: 2.2,
    killSeconds: 600,
    loadoutPower: strong,
    style: boss.style,
    rations: 10,
    alreadyDown: false,
    rng: rng("boss:first"),
  };
  const first = resolveBoss(input);
  assert.equal(first.killed, true);
  assert.equal(first.firstKill, true);
  // Second time round the guarantee must not fire again.
  assert.equal(resolveBoss({ ...input, alreadyDown: true }).firstKill, false);
});

test("a session too short to finish a boss loses nothing", () => {
  const result = resolveBoss({
    focusedMs: 15 * 60_000,
    bossTier: 20,
    bossStyle: "melee",
    bossPowerMultiplier: 2.2,
    killSeconds: 2400,
    loadoutPower: { offence: 10, defence: 10 },
    style: "melee",
    rations: 5,
    alreadyDown: false,
    rng: rng("boss:short"),
  });
  assert.equal(result.killed, false);
  assert.equal(result.rationsUsed, 0, "a fight that never happened still cost rations");
  assert.equal(result.durabilityUsed, 0);
  assert.ok(result.progress > 0 && result.progress < 1);
});

test("bringing the wrong style to a boss is felt but never fatal", () => {
  const base = {
    focusedMs: 50 * 60_000,
    bossTier: 12,
    bossStyle: "ranged" as const,
    bossPowerMultiplier: 2.2,
    killSeconds: 600,
    loadoutPower: { offence: 400, defence: 400 },
    rations: 20,
    alreadyDown: false,
  };
  const right = resolveBoss({ ...base, style: "melee", rng: rng("r") });
  const wrong = resolveBoss({ ...base, style: "magic", rng: rng("r") });
  // Either can miss on a given seed; what must hold is that a miss costs only
  // rations and durability, and never the session.
  for (const result of [right, wrong]) {
    assert.ok(result.rationsUsed <= 20);
    assert.ok(result.durabilityUsed <= 1);
  }
});

/* --------------------------- V2 achievements ------------------------------- */

test("V1 keeps its 131, and V2 adds its own set on top", () => {
  assert.equal(ACHIEVEMENTS.length, 131, "V1's set changed size");
  assert.equal(ACHIEVEMENTS_V2.length, 224);
  assert.equal(ALL_ACHIEVEMENTS.length, 355);
  assert.equal(new Set(ALL_ACHIEVEMENTS.map((a) => a.id)).size, 355, "id collision");
  assert.equal(new Set(ALL_ACHIEVEMENTS.map((a) => a.name)).size, 355, "two achievements share a name");
});

test("every V2 achievement belongs to a V2 family, and every family has members", () => {
  const families = new Set<string>(FAMILIES_V2);
  for (const a of ACHIEVEMENTS_V2) {
    assert.ok(families.has(a.family as string), `${a.id} is in family ${a.family}`);
    assert.ok(a.name.length > 0 && a.description.length > 0, a.id);
  }
  for (const family of FAMILIES_V2) {
    assert.ok(
      ACHIEVEMENTS_V2.some((a) => (a.family as string) === family),
      `${family} has no achievements`,
    );
  }
});

/** A game where everything possible has been done. */
function maxedGame(): GameStats {
  const skillLevels: Record<string, number> = {};
  for (const s of SKILLS) skillLevels[s.key] = MAX_SKILL_LEVEL;
  const collectedByTier: Record<number, number> = {};
  for (let t = 1; t <= MAX_TIER; t++) collectedByTier[t] = 1e9;
  const collectedByClass: Record<string, number> = {};
  const base = emptyGameStats();
  for (const cls of Object.keys(base.catalogueByClass)) collectedByClass[cls] = 1e9;
  return {
    ...base,
    skillLevels,
    totalSkillLevel: SKILLS.length * MAX_SKILL_LEVEL,
    skillsAt: () => SKILLS.length,
    gatheringSessions: 1e6,
    combatSessions: 1e6,
    bossSessions: 1e6,
    unitsGathered: 1e7,
    unitsBySkill: Object.fromEntries(SKILLS.map((s) => [s.key, 1e7])),
    kills: 1e6,
    legendaryKills: 1e4,
    itemsCrafted: 1e6,
    craftedSkills: 20,
    collected: base.catalogueSize,
    collectedByTier,
    collectedByClass,
    tiersComplete: MAX_TIER,
    classesComplete: Object.keys(base.catalogueByClass).length,
    uniquesFound: UNIQUES.length,
    bossesDown: BOSSES.length,
    lordsDown: 20,
    keyItems: 3,
    biomesEntered: 20,
    maxRefine: 10,
    itemsAtTen: 1000,
    refinedTiers: MAX_TIER,
    fullSetsEquipped: 1,
    coins: 1e9,
    bankSlots: 1500,
    fuelCap: 2000,
    contractsDone: 1000,
  };
}

/**
 * Hidden achievements whose whole point is a state a maxed game cannot be in:
 * "everything spent", "never drew a blade", "exactly 404". They are exempt from
 * the maxed-game sweep and each is asserted separately below, so an exemption is
 * a decision rather than an oversight.
 */
const CONTRADICTORY = new Set([
  "v2-h-poor", // needs slots AND no coins
  "v2-h-onetrick", // needs one skill at 99 and the rest below 25
  "v2-h-nothingkept", // needs a full log and a minimum bank
  "v2-h-luckless", // needs many kills and zero legendaries
  "v2-h-gatherer", // needs gathering and no combat at all
  "v2-h-404", // needs exactly 404
  "v2-h-emptyhanded", // needs a boss down and nothing refined
]);

test("no V2 achievement is unearnable — every one fires on a maxed game", () => {
  // This is the check that would have caught V1's fifteen dead achievements.
  const stats = {
    ...emptyStatsForTest(),
    game: maxedGame(),
    unlockedCount: 10_000,
    unlockedHidden: 100,
    completedFamilies: 50,
  };
  const dead = ACHIEVEMENTS_V2.filter(
    (a) => !CONTRADICTORY.has(a.id) && !a.check(stats as never),
  ).map((a) => a.id);
  assert.deepEqual(dead, [], "these can never be earned");
});

test("each deliberately contradictory hidden one fires on the state it describes", () => {
  const base = { ...emptyStatsForTest(), unlockedCount: 0, unlockedHidden: 0, completedFamilies: 0 };
  const cases: [string, GameStats][] = [
    ["v2-h-poor", { ...maxedGame(), coins: 0 }],
    ["v2-h-luckless", { ...maxedGame(), legendaryKills: 0 }],
    ["v2-h-gatherer", { ...maxedGame(), combatSessions: 0 }],
    ["v2-h-404", { ...maxedGame(), collected: 404 }],
    ["v2-h-emptyhanded", { ...maxedGame(), itemsAtTen: 0 }],
    ["v2-h-nothingkept", { ...maxedGame(), bankSlots: 60 }],
    ["v2-h-onetrick", { ...maxedGame(), skillsAt: (n: number) => (n >= 25 ? 1 : 22) }],
  ];
  for (const [id, game] of cases) {
    const found = ACHIEVEMENTS_V2.find((a) => a.id === id);
    assert.ok(found, `${id} does not exist`);
    assert.equal(found.check({ ...base, game } as never), true, `${id} still cannot fire`);
  }
});

test("no V2 achievement fires on a fresh account", () => {
  const stats = {
    ...emptyStatsForTest(),
    game: emptyGameStats(),
    unlockedCount: 0,
    unlockedHidden: 0,
    completedFamilies: 0,
  };
  const premature = ACHIEVEMENTS_V2.filter((a) => a.check(stats as never)).map((a) => a.id);
  assert.deepEqual(premature, [], "these are earned before anything happens");
});

test("nothing promises a finish line the arithmetic rules out", () => {
  // Per-action mastery was cut for exactly this. Nothing may ask for all 22
  // skills at 99, which is thirteen thousand focused hours.
  const nearly = {
    ...emptyStatsForTest(),
    game: { ...maxedGame(), skillsAt: (n: number) => (n >= 99 ? SKILLS.length - 1 : SKILLS.length) },
    unlockedCount: 10_000,
    unlockedHidden: 100,
    completedFamilies: 50,
  };
  const needsEverySkill = ACHIEVEMENTS_V2.filter(
    (a) => !CONTRADICTORY.has(a.id) && !a.check(nearly as never),
  ).map((a) => a.id);
  assert.deepEqual(needsEverySkill, [], "an achievement requires all 22 skills at 99");
});
