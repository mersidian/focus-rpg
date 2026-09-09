/**
 * The 100-level ladder: 20 named tiers of five ranks (SPEC-V1.md §4.1).
 *
 * The spec's table gives two hour figures per tier. Two lines of prose pin down
 * what they mean: "level 50 (Sage V, ~1008 h)" and "Mythic V sits on exactly
 * 10,000 focused hours". Sage's second column is 1008 and Mythic's is 10,000, so
 * the second column is the hour cost of the tier's *fifth* rank — level 5k+5.
 *
 * The first column ("enter at") is the cost of rank I, level 5k+1. In the lower
 * ten tiers it sits above the previous tier's rank V, roughly a fifth of the way
 * into the new tier. In the upper ten it is written as an exact copy of the
 * previous tier's rank V, which cannot be a real threshold — two levels cannot
 * share one cost. There it is treated as a restatement and rank I is placed one
 * fifth into the tier instead, matching the shape of the lower half.
 *
 * Ranks II-V then divide the rest of the tier evenly. Every number in the spec's
 * table is reproduced exactly; the ladder is strictly increasing throughout.
 */

export const RANKS = ["I", "II", "III", "IV", "V"] as const;

type Tier = {
  /** Tier name as displayed. */
  title: string;
  /** Spec column 1: hours at rank I. */
  enterHours: number;
  /** Spec column 2: hours at rank V. */
  doneHours: number;
  /** Hue driving the tier's accent colour, in OKLCH degrees. */
  hue: number;
  /** Chroma multiplier — later tiers burn brighter. */
  intensity: number;
};

export const TIERS: Tier[] = [
  { title: "Drifter",    enterHours: 0,    doneHours: 3,     hue: 250, intensity: 0.10 },
  { title: "Novice",     enterHours: 5,    doneHours: 17,    hue: 236, intensity: 0.18 },
  { title: "Apprentice", enterHours: 21,   doneHours: 45,    hue: 218, intensity: 0.26 },
  { title: "Adept",      enterHours: 53,   doneHours: 93,    hue: 196, intensity: 0.34 },
  { title: "Journeyman", enterHours: 105,  doneHours: 163,   hue: 176, intensity: 0.42 },
  { title: "Artisan",    enterHours: 181,  doneHours: 262,   hue: 156, intensity: 0.50 },
  { title: "Specialist", enterHours: 285,  doneHours: 392,   hue: 132, intensity: 0.58 },
  { title: "Veteran",    enterHours: 422,  doneHours: 557,   hue: 108, intensity: 0.66 },
  { title: "Master",     enterHours: 594,  doneHours: 761,   hue: 92,  intensity: 0.74 },
  { title: "Sage",       enterHours: 807,  doneHours: 1008,  hue: 78,  intensity: 0.82 },
  { title: "Ascendant",  enterHours: 1008, doneHours: 1250,  hue: 66,  intensity: 0.88 },
  { title: "Luminary",   enterHours: 1250, doneHours: 1540,  hue: 54,  intensity: 0.94 },
  { title: "Paragon",    enterHours: 1540, doneHours: 1900,  hue: 42,  intensity: 1.00 },
  { title: "Archon",     enterHours: 1900, doneHours: 2350,  hue: 30,  intensity: 1.00 },
  { title: "Warden",     enterHours: 2350, doneHours: 2900,  hue: 18,  intensity: 1.00 },
  { title: "Oracle",     enterHours: 2900, doneHours: 3600,  hue: 6,   intensity: 1.00 },
  { title: "Sovereign",  enterHours: 3600, doneHours: 4500,  hue: 350, intensity: 1.00 },
  { title: "Demiurge",   enterHours: 4500, doneHours: 5700,  hue: 330, intensity: 1.00 },
  { title: "Eternal",    enterHours: 5700, doneHours: 7500,  hue: 308, intensity: 1.00 },
  { title: "Mythic",     enterHours: 7500, doneHours: 10000, hue: 286, intensity: 1.00 },
];

export const MAX_LEVEL = TIERS.length * RANKS.length; // 100

/** XP cost of every level, indexed by level - 1. Level 1 costs 0. */
export const LEVEL_XP: number[] = (() => {
  const xp: number[] = [];
  for (let k = 0; k < TIERS.length; k++) {
    const tier = TIERS[k];
    const lo = k === 0 ? 0 : TIERS[k - 1].doneHours;
    const hi = tier.doneHours;
    const rankI =
      k === 0 ? 0 : tier.enterHours > lo ? tier.enterHours : lo + (hi - lo) / 5;
    for (let r = 0; r < 5; r++) {
      const hours = rankI + ((hi - rankI) * r) / 4;
      xp.push(Math.round(hours * 60));
    }
  }
  return xp;
})();

export type LevelInfo = {
  level: number;
  tierIndex: number;
  title: string;
  rank: (typeof RANKS)[number];
  /** e.g. "Adept III" */
  fullTitle: string;
  hue: number;
  intensity: number;
  /** XP at which this level was reached. */
  floorXp: number;
  /** XP required for the next level, or null at level 100. */
  nextXp: number | null;
};

export function levelForXp(xp: number): number {
  const capped = Math.max(0, xp);
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (capped >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return level;
}

export function describeLevel(level: number): LevelInfo {
  const clamped = Math.min(Math.max(level, 1), MAX_LEVEL);
  const tierIndex = Math.floor((clamped - 1) / 5);
  const tier = TIERS[tierIndex];
  const rank = RANKS[(clamped - 1) % 5];
  return {
    level: clamped,
    tierIndex,
    title: tier.title,
    rank,
    fullTitle: `${tier.title} ${rank}`,
    hue: tier.hue,
    intensity: tier.intensity,
    floorXp: LEVEL_XP[clamped - 1],
    nextXp: clamped < MAX_LEVEL ? LEVEL_XP[clamped] : null,
  };
}

/** Progress toward the next rank, 0-1. Returns 1 at level 100. */
export function rankProgress(xp: number, level: number): number {
  const info = describeLevel(level);
  if (info.nextXp === null) return 1;
  const span = info.nextXp - info.floorXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (xp - info.floorXp) / span));
}

/** Hours of focus still owed before the next rank, given current XP. */
export function xpToNextRank(xp: number, level: number): number | null {
  const info = describeLevel(level);
  if (info.nextXp === null) return null;
  return Math.max(0, info.nextXp - xp);
}
