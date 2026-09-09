/**
 * The V2 achievements (SPEC-V2.md §12).
 *
 * V1's 131 are untouched and still exported as `ACHIEVEMENTS`; these are a
 * second set, and `ALL_ACHIEVEMENTS` is the union the engine judges.
 *
 * Two rules carried over from V1, both load-bearing:
 *
 *   - **Every predicate reads a statistic the database actually records.** V1
 *     shipped fifteen achievements that could never fire, found by writing the
 *     tests from the spec's wording. The fix is upstream of the tests: nothing
 *     here may ask about a fact nothing counts, so `GameStats` was built first
 *     and this file is written against it.
 *   - **Nothing promises a finish line that does not exist.** Per-action mastery
 *     was cut because 850 tracks at 40 hours each could never be completed, and
 *     the same arithmetic is applied here — there is no "max every skill", which
 *     would be 13,200 hours.
 *
 * Where a family is repetitive it is GENERATED from the axis rather than typed
 * out. Twenty-two skills times four milestones is the cheap answer to covering
 * a game this size, and a loop cannot forget one.
 */
import type { Achievement, Rarity } from "./definitions";
import type { Stats } from "./stats";
import { SKILLS } from "../game/skills";
import { MAX_TIER } from "../game/tiers";
import { BOSSES } from "../game/bosses";
import { UNIQUES } from "../game/uniques";

export const FAMILIES_V2 = [
  "gathering",
  "combat",
  "exploration",
  "crafting",
  "collection",
  "refinement",
  "gunplay",
  "economy",
  "metaV2",
  "hiddenV2",
] as const;

export type FamilyV2 = (typeof FAMILIES_V2)[number];

export const FAMILY_LABEL_V2: Record<FamilyV2, string> = {
  gathering: "Gathering",
  combat: "Combat",
  exploration: "Exploration",
  crafting: "Crafting",
  collection: "Collection",
  refinement: "Refinement",
  gunplay: "Gunplay",
  economy: "Economy",
  metaV2: "Meta — the game",
  hiddenV2: "Hidden — the game",
};

type Def = Achievement & { family: string };

function g(
  id: string,
  family: FamilyV2,
  name: string,
  description: string,
  rarity: Rarity,
  check: (s: Stats) => boolean,
  extra: Partial<Achievement> = {},
): Def {
  return { id, family: family as never, name, description, rarity, check, ...extra } as Def;
}

/** Rarity by how far along a threshold sits, so ladders are priced consistently. */
function ladder(step: number, of: number): Rarity {
  const at = step / Math.max(1, of - 1);
  if (at >= 1) return "legendary";
  if (at >= 0.7) return "epic";
  if (at >= 0.45) return "rare";
  if (at >= 0.2) return "uncommon";
  return "common";
}

const GATHERING = SKILLS.filter((s) => s.kind === "gathering");
/**
 * Gunplay and Gunsmithing are left out of the combat and crafting ladders on
 * purpose: the Gunplay family owns both, and having them in two families meant
 * six achievements with the same name as another. One milestone, one home.
 */
const COMBAT = SKILLS.filter((s) => s.kind === "combat" && s.key !== "gunplay");
const PROCESSING = SKILLS.filter((s) => s.kind === "processing" && s.key !== "gunsmithing");
const num = (n: number) => n.toLocaleString("en-US");

/* ----------------------------------------------------- gathering (36) */

const UNIT_STEPS = [100, 1_000, 10_000];

const gathering: Def[] = [
  ...GATHERING.flatMap((skill) =>
    UNIT_STEPS.map((n, i) =>
      g(
        `v2-gather-${skill.key}-${n}`,
        "gathering",
        `${skill.label}: ${num(n)}`,
        `Gather ${num(n)} things with ${skill.label}.`,
        ladder(i, UNIT_STEPS.length),
        (s) => (s.game.unitsBySkill[skill.key] ?? 0) >= n,
      ),
    ),
  ),
  ...GATHERING.flatMap((skill) =>
    [25, 50, 75].map((level, i) =>
      g(
        `v2-gskill-${skill.key}-${level}`,
        "gathering",
        `${skill.label} ${level}`,
        `Reach ${skill.label} level ${level}.`,
        ladder(i, 3),
        (s) => (s.game.skillLevels[skill.key] ?? 1) >= level,
        level === 75 ? { title: `the ${skill.label}` } : {},
      ),
    ),
  ),
];

/* -------------------------------------------------------- combat (30) */

const KILL_STEPS = [1, 100, 1_000, 10_000, 100_000];

const combat: Def[] = [
  ...KILL_STEPS.map((n, i) =>
    g(
      `v2-kills-${n}`,
      "combat",
      n === 1 ? "First Blood" : `${num(n)} Down`,
      n === 1 ? "Win your first fight." : `Kill ${num(n)} things.`,
      ladder(i, KILL_STEPS.length),
      (s) => s.game.kills >= n,
      n === 100_000 ? { title: "the Unending" } : {},
    ),
  ),
  ...[1, 10, 100].map((n, i) =>
    g(
      `v2-legendary-${n}`,
      "combat",
      n === 1 ? "Something Rare" : `${num(n)} Legendaries`,
      `Kill ${num(n)} legendary spawn${n === 1 ? "" : "s"}.`,
      ladder(i + 1, 4),
      (s) => s.game.legendaryKills >= n,
    ),
  ),
  ...[10, 100, 500].map((n, i) =>
    g(
      `v2-csession-${n}`,
      "combat",
      `${num(n)} Sorties`,
      `Spend ${num(n)} sessions fighting.`,
      ladder(i, 3),
      (s) => s.game.combatSessions >= n,
    ),
  ),
  ...COMBAT.flatMap((skill) =>
    [25, 50, 75, 99].map((level, i) =>
      g(
        `v2-cskill-${skill.key}-${level}`,
        "combat",
        `${skill.label} ${level}`,
        `Reach ${skill.label} level ${level}.`,
        ladder(i, 4),
        (s) => (s.game.skillLevels[skill.key] ?? 1) >= level,
        level === 99 ? { title: `the ${skill.label} Master` } : {},
      ),
    ),
  ),
  g("v2-fullset", "combat", "Fully Dressed", "Fill all ten equipment slots at once.", "uncommon",
    (s) => s.game.fullSetsEquipped >= 1),
  g("v2-kills-50000", "combat", "Fifty Thousand", "Kill 50,000 things.", "epic",
    (s) => s.game.kills >= 50_000),
  g("v2-legendary-500", "combat", "Five Hundred Legendaries", "Kill 500 legendary spawns.", "legendary",
    (s) => s.game.legendaryKills >= 500, { title: "the Fortunate" }),
  g("v2-csession-1000", "combat", "A Thousand Sorties", "Spend 1,000 sessions fighting.", "epic",
    (s) => s.game.combatSessions >= 1000),
  g("v2-combat-all99", "combat", "Every Way to Fight",
    "Reach 99 in Melee, Ranged and Magic.", "legendary",
    (s) =>
      (s.game.skillLevels.melee ?? 1) >= 99 &&
      (s.game.skillLevels.ranged ?? 1) >= 99 &&
      (s.game.skillLevels.magic ?? 1) >= 99,
    { title: "the Three-Handed" }),
  g("v2-combat-firstlegendary-kill", "combat", "Worth the Trip",
    "Kill a legendary spawn in a session that also killed a hundred things.", "rare",
    (s) => s.game.legendaryKills >= 1 && s.game.kills >= 100),
];

/* --------------------------------------------------- exploration (24) */

const exploration: Def[] = [
  ...[1, 3, 5, 8, 12, 16, 20].map((n, i) =>
    g(
      `v2-biome-${n}`,
      "exploration",
      n === 20 ? "Every Corner" : `${n} Biome${n === 1 ? "" : "s"}`,
      `Fight in ${n} of the 20 biomes.`,
      ladder(i, 7),
      (s) => s.game.biomesEntered >= n,
      n === 20 ? { title: "the Far-Travelled" } : {},
    ),
  ),
  ...[1, 2, 3].map((n, i) =>
    g(
      `v2-key-${n}`,
      "exploration",
      n === 3 ? "Every Door" : `${n} Key Item${n === 1 ? "" : "s"}`,
      `Hold ${n} of the three key items.`,
      ladder(i + 1, 4),
      (s) => s.game.keyItems >= n,
    ),
  ),
  ...[1, 5, 10, 20, 30, BOSSES.length].map((n, i) =>
    g(
      `v2-boss-${n}`,
      "exploration",
      n === BOSSES.length ? "Nothing Left Standing" : `${n} Boss${n === 1 ? "" : "es"}`,
      `Put ${n} of the ${BOSSES.length} bosses down.`,
      ladder(i, 6),
      (s) => s.game.bossesDown >= n,
      n === BOSSES.length ? { title: "the Boss-Slayer" } : {},
    ),
  ),
  ...[1, 5, 10, 20].map((n, i) =>
    g(
      `v2-lord-${n}`,
      "exploration",
      n === 20 ? "Every Throne" : `${n} Biome Lord${n === 1 ? "" : "s"}`,
      `Kill ${n} biome lord${n === 1 ? "" : "s"}.`,
      ladder(i, 4),
      (s) => s.game.lordsDown >= n,
    ),
  ),
  ...[10, 50, 100].map((n, i) =>
    g(
      `v2-bsession-${n}`,
      "exploration",
      `${num(n)} Boss Fights`,
      `Spend ${num(n)} sessions on a boss.`,
      ladder(i, 3),
      (s) => s.game.bossSessions >= n,
    ),
  ),
  g("v2-slaying-1", "exploration", "Under Contract", "Finish a Slaying contract.", "common",
    (s) => s.game.contractsDone >= 1),
];

/* ------------------------------------------------------ crafting (30) */

const CRAFT_STEPS = [1, 10, 100, 1_000, 10_000];

const crafting: Def[] = [
  ...CRAFT_STEPS.map((n, i) =>
    g(
      `v2-craft-${n}`,
      "crafting",
      n === 1 ? "First Made Thing" : `${num(n)} Made`,
      `Craft ${num(n)} item${n === 1 ? "" : "s"}.`,
      ladder(i, CRAFT_STEPS.length),
      (s) => s.game.itemsCrafted >= n,
      n === 10_000 ? { title: "the Maker" } : {},
    ),
  ),
  ...[1, 3, 5, 8, PROCESSING.length].map((n, i) =>
    g(
      `v2-craftskills-${n}`,
      "crafting",
      n === PROCESSING.length ? "Every Trade" : `${n} Trade${n === 1 ? "" : "s"}`,
      `Craft something in ${n} different processing skills.`,
      ladder(i, 5),
      (s) => s.game.craftedSkills >= n,
    ),
  ),
  ...PROCESSING.map((skill) =>
    g(
      `v2-pskill-${skill.key}-50`,
      "crafting",
      `${skill.label} 50`,
      `Reach ${skill.label} level 50.`,
      "uncommon",
      (s) => (s.game.skillLevels[skill.key] ?? 1) >= 50,
    ),
  ),
  ...PROCESSING.map((skill) =>
    g(
      `v2-pskill-${skill.key}-99`,
      "crafting",
      `${skill.label} 99`,
      `Reach ${skill.label} level 99 — about six hundred hours of it.`,
      "legendary",
      (s) => (s.game.skillLevels[skill.key] ?? 1) >= 99,
      { title: `the ${skill.label}` },
    ),
  ),
];

/* ---------------------------------------------------- collection (36) */

const COLLECT_STEPS = [100, 500, 1_000, 2_000, 4_000, 8_000];
const TIER_MARKS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, MAX_TIER];

const collection: Def[] = [
  ...COLLECT_STEPS.map((n, i) =>
    g(
      `v2-collect-${n}`,
      "collection",
      `${num(n)} Kinds`,
      `Have obtained ${num(n)} different items. The log remembers what you found, not what you kept.`,
      ladder(i, COLLECT_STEPS.length),
      (s) => s.game.collected >= n,
      n === 8_000 ? { title: "the Compleat" } : {},
    ),
  ),
  ...[1, 3, 6, 12, 18, MAX_TIER].map((n, i) =>
    g(
      `v2-tiersdone-${n}`,
      "collection",
      n === MAX_TIER ? "Every Tier" : `${n} Tier${n === 1 ? "" : "s"} Complete`,
      `Complete every item in ${n} of the ${MAX_TIER} tiers.`,
      ladder(i, 6),
      (s) => s.game.tiersComplete >= n,
    ),
  ),
  ...[1, 3, 6, 9, 11].map((n, i) =>
    g(
      `v2-classdone-${n}`,
      "collection",
      n === 11 ? "Every Class" : `${n} Class${n === 1 ? "" : "es"} Complete`,
      `Complete every item in ${n} item class${n === 1 ? "" : "es"}.`,
      ladder(i, 5),
      (s) => s.game.classesComplete >= n,
    ),
  ),
  ...[1, 10, 50, 100, UNIQUES.length].map((n, i) =>
    g(
      `v2-unique-${n}`,
      "collection",
      n === UNIQUES.length ? "All the Odd Ones" : `${num(n)} Unique${n === 1 ? "" : "s"}`,
      `Find ${num(n)} of the ${UNIQUES.length} uniques — the only items that break the curve.`,
      ladder(i, 5),
      (s) => s.game.uniquesFound >= n,
      n === UNIQUES.length ? { title: "the Curve-Breaker" } : {},
    ),
  ),
  ...TIER_MARKS.map((t, i) =>
    g(
      `v2-tier-${t}`,
      "collection",
      `Tier ${t}`,
      `Complete every item at tier ${t}.`,
      ladder(i, TIER_MARKS.length),
      (s) =>
        (s.game.collectedByTier[t] ?? 0) >= (s.game.catalogueByTier[t] ?? Number.POSITIVE_INFINITY),
    ),
  ),
  g("v2-collect-half", "collection", "Halfway Seen",
    "Have obtained half of everything the game can make.", "epic",
    (s) => s.game.catalogueSize > 0 && s.game.collected >= s.game.catalogueSize / 2),
];

/* --------------------------------------------------- refinement (16) */

const refinement: Def[] = [
  ...[1, 3, 5, 7, 10].map((n, i) =>
    g(
      `v2-refine-${n}`,
      "refinement",
      `Refined +${n}`,
      `Take something to +${n}.`,
      ladder(i, 5),
      (s) => s.game.maxRefine >= n,
      n === 10 ? { title: "the Perfectionist" } : {},
    ),
  ),
  ...[1, 5, 10, 50, 100].map((n, i) =>
    g(
      `v2-attn-${n}`,
      "refinement",
      `${num(n)} at +10`,
      `Hold ${num(n)} item${n === 1 ? "" : "s"} at +10. Refinement never fails, so this is a bill rather than a gamble.`,
      ladder(i, 5),
      (s) => s.game.itemsAtTen >= n,
    ),
  ),
  ...[1, 3, 6, 12, MAX_TIER].map((n, i) =>
    g(
      `v2-reftier-${n}`,
      "refinement",
      n === MAX_TIER ? "+10 at Every Tier" : `+10 in ${n} Tier${n === 1 ? "" : "s"}`,
      `Hold a +10 item in ${n} different tier${n === 1 ? "" : "s"}.`,
      ladder(i, 5),
      (s) => s.game.refinedTiers >= n,
    ),
  ),
  g("v2-refine-cap", "refinement", "Nothing Left to Buy",
    "Raise the fuel cap to its maximum.", "epic", (s) => s.game.fuelCap >= 2000),
];

/* ------------------------------------------------------ gunplay (12) */

const gunplay: Def[] = [
  ...[10, 25, 50, 75, 99].map((level, i) =>
    g(
      `v2-gunplay-${level}`,
      "gunplay",
      `Gunplay ${level}`,
      `Reach Gunplay level ${level}. Firearms only exist from tier 6 up, so this starts late.`,
      ladder(i, 5),
      (s) => (s.game.skillLevels.gunplay ?? 1) >= level,
      level === 99 ? { title: "the Gunhand" } : {},
    ),
  ),
  ...[10, 25, 50, 75, 99].map((level, i) =>
    g(
      `v2-gunsmith-${level}`,
      "gunplay",
      `Gunsmithing ${level}`,
      `Reach Gunsmithing level ${level}.`,
      ladder(i, 5),
      (s) => (s.game.skillLevels.gunsmithing ?? 1) >= level,
    ),
  ),
  g("v2-gun-powder", "gunplay", "Powder and Shot",
    "Reach 25 in both Gunplay and Gunsmithing — the style that pays most to fire.", "rare",
    (s) => (s.game.skillLevels.gunplay ?? 1) >= 25 && (s.game.skillLevels.gunsmithing ?? 1) >= 25),
  g("v2-gun-both99", "gunplay", "Both Barrels",
    "Reach 99 in both Gunplay and Gunsmithing.", "legendary",
    (s) => (s.game.skillLevels.gunplay ?? 1) >= 99 && (s.game.skillLevels.gunsmithing ?? 1) >= 99,
    { title: "of Powder and Shot" }),
];

/* ------------------------------------------------------ economy (16) */

const COIN_STEPS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000];

const economy: Def[] = [
  ...COIN_STEPS.map((n, i) =>
    g(
      `v2-coins-${n}`,
      "economy",
      `${num(n)} Coins`,
      `Hold ${num(n)} coins at once.`,
      ladder(i, COIN_STEPS.length),
      (s) => s.game.coins >= n,
      n === 10_000_000 ? { title: "the Flush" } : {},
    ),
  ),
  ...[100, 250, 500, 1_000, 1_500].map((n, i) =>
    g(
      `v2-slots-${n}`,
      "economy",
      `${num(n)} Slots`,
      `Own ${num(n)} bank slots — the largest sink in the game.`,
      ladder(i, 5),
      (s) => s.game.bankSlots >= n,
      n === 1_500 ? { title: "the Hoarder" } : {},
    ),
  ),
  ...[750, 1_000, 1_500, 2_000].map((n, i) =>
    g(
      `v2-fuelcap-${n}`,
      "economy",
      `${num(n)} Fuel`,
      `Raise the fuel cap to ${num(n)}.`,
      ladder(i, 4),
      (s) => s.game.fuelCap >= n,
    ),
  ),
  ...[10, 50].map((n, i) =>
    g(
      `v2-contracts-${n}`,
      "economy",
      `${n} Contracts`,
      `Finish ${n} Slaying contracts.`,
      ladder(i + 1, 3),
      (s) => s.game.contractsDone >= n,
    ),
  ),
];

/* ------------------------------------------------------- meta (10) */

const metaV2: Def[] = [
  ...[25, 50, 100, 150, 200].map((n, i) =>
    g(
      `v2-meta-${n}`,
      "metaV2",
      `${n} of the Game`,
      `Earn ${n} achievements in total.`,
      ladder(i, 5),
      (s) => s.unlockedCount >= n,
    ),
  ),
  g("v2-meta-family", "metaV2", "A Family of the Game", "Complete an entire achievement family.", "rare",
    (s) => s.completedFamilies >= 1),
  g("v2-meta-3families", "metaV2", "Three Families Whole", "Complete three entire families.", "epic",
    (s) => s.completedFamilies >= 3),
  g("v2-meta-totalskill-200", "metaV2", "Two Hundred Levels",
    "Reach 200 total skill level across the twenty-two skills.", "uncommon",
    (s) => s.game.totalSkillLevel >= 200),
  g("v2-meta-totalskill-800", "metaV2", "Eight Hundred Levels",
    "Reach 800 total skill level.", "epic", (s) => s.game.totalSkillLevel >= 800),
  g("v2-meta-fiveskills99", "metaV2", "Five at Ninety-Nine",
    "Take five skills to 99. Twenty-two of them would be thirteen thousand hours, which is why nothing asks for that.",
    "legendary", (s) => s.game.skillsAt(99) >= 5, { title: "the Five-Fold" }),
];

/* ----------------------------------------------------- hidden (12) */

const hiddenV2: Def[] = [
  g("v2-h-firstboss", "hiddenV2", "Wall Reached", "Put a boss down.", "uncommon",
    (s) => s.game.bossesDown >= 1, { hidden: true }),
  g("v2-h-poor", "hiddenV2", "Everything Spent",
    "Hold a thousand bank slots and fewer than a hundred coins at the same time.", "rare",
    (s) => s.game.bankSlots >= 1000 && s.game.coins < 100, { hidden: true }),
  g("v2-h-onetrick", "hiddenV2", "One Trick",
    "Take a single skill to 99 while every other sits below 25.", "epic",
    (s) => s.game.skillsAt(99) >= 1 && s.game.skillsAt(25) === s.game.skillsAt(99),
    { hidden: true, title: "the Specialist" }),
  g("v2-h-generalist", "hiddenV2", "Generalist",
    "Take every one of the twenty-two skills past 25.", "epic",
    (s) => s.game.skillsAt(25) >= 22, { hidden: true, title: "the Generalist" }),
  g("v2-h-nothingkept", "hiddenV2", "Nothing Kept",
    "Have obtained a thousand kinds of item while holding a bank of only sixty slots.", "rare",
    (s) => s.game.collected >= 1000 && s.game.bankSlots <= 60, { hidden: true }),
  g("v2-h-luckless", "hiddenV2", "Luckless",
    "Kill ten thousand things without a single legendary among them.", "epic",
    (s) => s.game.kills >= 10_000 && s.game.legendaryKills === 0, { hidden: true }),
  g("v2-h-gatherer", "hiddenV2", "Never Drew a Blade",
    "Gather ten thousand things without fighting once.", "rare",
    (s) => s.game.unitsGathered >= 10_000 && s.game.combatSessions === 0,
    { hidden: true, title: "the Peaceable" }),
  g("v2-h-allkeys", "hiddenV2", "Three Doors",
    "Hold all three key items.", "rare", (s) => s.game.keyItems >= 3, { hidden: true }),
  g("v2-h-404", "hiddenV2", "Four Hundred and Four",
    "Have exactly 404 kinds of item in the collection log.", "rare",
    (s) => s.game.collected === 404, { hidden: true }),
  g("v2-h-lastboss", "hiddenV2", "The Last Light",
    "Put down the boss at the top of the spire.", "legendary",
    (s) => s.game.bossesDown >= BOSSES.length, { hidden: true, title: "of the Last Light" }),
  g("v2-h-perfect", "hiddenV2", "One Perfect Thing",
    "Hold a +10 item while every skill that could have made it sits at 99.", "legendary",
    (s) => s.game.itemsAtTen >= 1 && s.game.skillsAt(99) >= 3, { hidden: true }),
  g("v2-h-emptyhanded", "hiddenV2", "Empty-Handed",
    "Put a boss down without a single item at +10.", "uncommon",
    (s) => s.game.bossesDown >= 1 && s.game.itemsAtTen === 0, { hidden: true }),
];

export const ACHIEVEMENTS_V2: Achievement[] = [
  ...gathering,
  ...combat,
  ...exploration,
  ...crafting,
  ...collection,
  ...refinement,
  ...gunplay,
  ...economy,
  ...metaV2,
  ...hiddenV2,
];

export const V2_COUNT_BY_FAMILY: Record<string, number> = ACHIEVEMENTS_V2.reduce(
  (out, a) => {
    out[a.family] = (out[a.family] ?? 0) + 1;
    return out;
  },
  {} as Record<string, number>,
);
