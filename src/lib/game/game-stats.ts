import { generateCatalogue } from "./items";
import { SKILLS, MAX_SKILL_LEVEL, skillLevel } from "./skills";
import { MAX_TIER } from "./tiers";
import { UNIQUES } from "./uniques";
import { BOSSES } from "./bosses";

/**
 * The facts V2's achievements are judged against.
 *
 * Every field here is something the database can actually answer. That
 * constraint is the point: an achievement defined over a statistic nothing
 * records is an achievement that can never fire, and fifteen of those were
 * found in V1 by writing the tests from the spec's wording rather than from the
 * code. The same discipline applies to the data underneath.
 *
 * Kills and gathered units are counters on `session_activity`, written once at
 * resolution — not a row per goblin. Everything else is a fold of a table that
 * already exists.
 *
 * The shape lives here, pure, because `Stats` has to reference it and the
 * achievement engine must not acquire a database. Reading it is
 * `game-stats-service.ts`.
 */
export type GameStats = {
  /** Per-skill levels, and the shapes achievements ask about. */
  skillLevels: Record<string, number>;
  totalSkillLevel: number;
  skillsAt: (level: number) => number;

  /** Sessions by what the character was doing. */
  gatheringSessions: number;
  combatSessions: number;
  bossSessions: number;

  unitsGathered: number;
  unitsBySkill: Record<string, number>;
  kills: number;
  legendaryKills: number;

  itemsCrafted: number;
  craftedSkills: number;

  /** The collection log, which is what collection achievements read. */
  collected: number;
  catalogueSize: number;
  collectedByTier: Record<number, number>;
  catalogueByTier: Record<number, number>;
  tiersComplete: number;
  collectedByClass: Record<string, number>;
  catalogueByClass: Record<string, number>;
  classesComplete: number;
  uniquesFound: number;

  bossesDown: number;
  lordsDown: number;
  keyItems: number;
  biomesEntered: number;

  maxRefine: number;
  itemsAtTen: number;
  refinedTiers: number;
  fullSetsEquipped: number;

  coins: number;
  bankSlots: number;
  fuelCap: number;
  contractsDone: number;
};

const CATALOGUE = generateCatalogue();
const CATALOGUE_BY_TIER: Record<number, number> = {};
const CATALOGUE_BY_CLASS: Record<string, number> = {};
for (const item of CATALOGUE) {
  CATALOGUE_BY_TIER[item.tier] = (CATALOGUE_BY_TIER[item.tier] ?? 0) + 1;
  CATALOGUE_BY_CLASS[item.cls] = (CATALOGUE_BY_CLASS[item.cls] ?? 0) + 1;
}
const CATALOGUE_INDEX = new Map(CATALOGUE.map((i) => [i.id, i]));
const UNIQUE_IDS = new Set(UNIQUES.map((u) => `unique:${u.name}`));

/** Which gathering skill a raw item came from, read off its generated id. */
const RAW_SKILL: Record<string, string> = {
  Log: "woodcutting",
  Catch: "fishing",
  Ore: "mining",
  Gem: "mining",
  Herb: "foraging",
  Fibre: "foraging",
  Hide: "hunting",
  Relic: "excavation",
};

export function emptyGameStats(): GameStats {
  return {
    skillLevels: {},
    totalSkillLevel: 0,
    skillsAt: () => 0,
    gatheringSessions: 0,
    combatSessions: 0,
    bossSessions: 0,
    unitsGathered: 0,
    unitsBySkill: {},
    kills: 0,
    legendaryKills: 0,
    itemsCrafted: 0,
    craftedSkills: 0,
    collected: 0,
    catalogueSize: CATALOGUE.length,
    collectedByTier: {},
    catalogueByTier: CATALOGUE_BY_TIER,
    tiersComplete: 0,
    collectedByClass: {},
    catalogueByClass: CATALOGUE_BY_CLASS,
    classesComplete: 0,
    uniquesFound: 0,
    bossesDown: 0,
    lordsDown: 0,
    keyItems: 0,
    biomesEntered: 0,
    maxRefine: 0,
    itemsAtTen: 0,
    refinedTiers: 0,
    fullSetsEquipped: 0,
    coins: 0,
    bankSlots: 60,
    fuelCap: 500,
    contractsDone: 0,
  };
}


export const CATALOGUE_INDEX_EXPORT = CATALOGUE_INDEX;
export const UNIQUE_IDS_EXPORT = UNIQUE_IDS;
export const RAW_SKILL_EXPORT = RAW_SKILL;
export const CATALOGUE_TIER_TOTALS = CATALOGUE_BY_TIER;
export const CATALOGUE_CLASS_TOTALS = CATALOGUE_BY_CLASS;
export { MAX_SKILL_LEVEL, skillLevel, SKILLS };
export const MAX_SKILL = MAX_SKILL_LEVEL;
export const TIER_COUNT = MAX_TIER;
export const BOSS_COUNT = BOSSES.length;
export const UNIQUE_COUNT = UNIQUES.length;
