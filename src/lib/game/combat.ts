/**
 * Combat, resolved from timed minutes (SPEC-V2.md §7).
 *
 * A session in an area is N kills, not one fight. There is no real-time combat
 * and no screen that wants attention: minutes go in, a kill list comes out.
 *
 * The shape of it, and every part is a decision recorded in the spec:
 *
 *   - Entry is a BINARY requirement gate. No RNG decides whether you may go.
 *   - Each spawn rolls a rarity, which sets both its power and its loot.
 *   - Meet a spawn's power and the kill is GUARANTEED. Below it you get a
 *     sliding chance that never reaches zero, so a Legendary is always at least
 *     a lottery ticket.
 *   - A failed kill costs one ration and one point of weapon durability. It
 *     never costs the session, which still completes and still pays.
 *
 * Nothing here punishes a completed session, and nothing here is unfair without
 * being visible beforehand.
 */
import { wheel, type Style } from "./archetypes";
import { tier } from "./tiers";
import type { Rng } from "./rng";
import type { Variant } from "./variants";
import type { Speed } from "./species";
import { emptyModifiers, type Modifiers } from "./effects";

/**
 * Ammunition spent per kill, by style. Melee pays nothing and has the lowest
 * ceiling; a firearm pays most and hits hardest. §7 describes this ladder, and
 * this is where it is actually charged.
 */
export const AMMO_PER_KILL: Record<Style, number> = {
  melee: 0,
  ranged: 1,
  magic: 1,
  // One expensive round, not two cheap ones. See the note on AMMO_COST: two a
  // kill left gun a third behind every other style on net coin.
  gun: 1,
};

export type Rarity = "common" | "uncommon" | "elite" | "rare" | "legendary";

export type RarityDef = {
  key: Rarity;
  label: string;
  /** Base drop weight at tier 1. */
  weight: number;
  /** How much of the tier's weight grows with depth. */
  depthBias: number;
  /** Multiplier on the spawn's power. */
  power: number;
  /** Multiplier on what it drops. */
  loot: number;
};

export const RARITIES: RarityDef[] = [
  { key: "common", label: "Common", weight: 1000, depthBias: 0, power: 1.0, loot: 1 },
  { key: "uncommon", label: "Uncommon", weight: 300, depthBias: 0.01, power: 1.15, loot: 1.5 },
  { key: "elite", label: "Elite", weight: 80, depthBias: 0.03, power: 1.45, loot: 3 },
  { key: "rare", label: "Rare", weight: 18, depthBias: 0.05, power: 1.9, loot: 6 },
  { key: "legendary", label: "Legendary", weight: 3, depthBias: 0.07, power: 2.6, loot: 14 },
];

export const RARITY_BY_KEY = new Map(RARITIES.map((r) => [r.key, r]));

/** Deeper biomes tilt the table, so depth pays in kind as well as in degree. */
export function rarityWeight(def: RarityDef, atTier: number): number {
  return def.weight * (1 + def.depthBias * (atTier - 1));
}

export function rollRarity(r: Rng, atTier: number): RarityDef {
  return r.weighted(RARITIES, (def) => rarityWeight(def, atTier));
}

/** Seconds to kill one, before gear. */
export const BASE_KILL_SECONDS: Record<Speed, number> = {
  fast: 20,
  medium: 35,
  slow: 60,
};

/**
 * The scale a spawn is measured on, calibrated against OFFENCE.
 *
 * This is the number the whole curve hangs off, and it has been moved once
 * already: it was 55 when a loadout was a single figure, and splitting offence
 * from defence dropped a same-tier set to converting 26% of its own tier's
 * commons — three failures in four, at the tier you are supposed to be farming.
 *
 * At 33 a full same-tier Plain melee set converts about four commons in five.
 * That is the balance point: your own tier is farmable but not free, and
 * anything rarer wants better gear, the right style, or both.
 */
export const SPAWN_BASE = 33;

export function spawnPower(atTier: number, rarity: RarityDef): number {
  return SPAWN_BASE * tier(atTier).power * rarity.power;
}

/** Advantage on the wheel is worth a third again; the wrong style costs a quarter. */
export const WHEEL_ADVANTAGE = 1.35;
export const WHEEL_DISADVANTAGE = 0.72;

export function wheelFactor(attacker: Style, defender: Style): number {
  const result = wheel(attacker, defender);
  if (result === "advantage") return WHEEL_ADVANTAGE;
  if (result === "disadvantage") return WHEEL_DISADVANTAGE;
  return 1;
}

/** Never zero: a Legendary you have no business fighting is still a ticket. */
export const MIN_SUCCESS = 0.05;
const SUCCESS_CURVE = 2.2;

export function successChance(effectivePower: number, against: number): number {
  if (against <= 0) return 1;
  if (effectivePower >= against) return 1;
  const ratio = effectivePower / against;
  return Math.min(1, Math.max(MIN_SUCCESS, Math.pow(ratio, SUCCESS_CURVE)));
}

/**
 * How long one kill takes with this loadout. Better gear kills faster, which is
 * where gear-side THROUGHPUT lives — §8's power formula has no throughput term,
 * so without this, gear could not buy speed at all.
 *
 * A two-handed weapon gives up the offhand and takes 15% off its kill time in
 * return. That moves throughput and conversion, never access.
 */
export function killSeconds(
  variant: Variant,
  effectivePower: number,
  spawn: number,
  twoHanded: boolean,
): number {
  const base = BASE_KILL_SECONDS[variant.species.speed];
  const ratio = spawn <= 0 ? 1 : spawn / Math.max(1, effectivePower);
  const scaled = base * Math.min(3, Math.max(0.4, ratio));
  return scaled * (twoHanded ? 0.85 : 1);
}

export type Spawn = {
  variant: Variant;
  rarity: RarityDef;
  killed: boolean;
  /** Loot weight this spawn contributed, zero if it got away. */
  loot: number;
};

/**
 * How many rations one failed kill eats.
 *
 * This is where a thin coat is paid for. Defence does not stop failures — the
 * conversion curve owns that — it decides what a failure costs, so the style
 * with the highest ceiling also has the highest upkeep, which is the ladder §7
 * describes.
 */
export const MAX_RATIONS_PER_FAILURE = 3;

export function rationsPerFailure(spawn: number, defence: number): number {
  if (defence <= 0) return MAX_RATIONS_PER_FAILURE;
  // The 1.5 is what makes the styles differ at all. Rounding the bare ratio put
  // every style on one ration and the whole defence axis went dead.
  return Math.min(MAX_RATIONS_PER_FAILURE, Math.max(1, Math.ceil((spawn / defence) * 1.5)));
}

export type CombatInput = {
  focusedMs: number;
  /** The area's roster, already gated. */
  roster: Variant[];
  areaTier: number;
  /** Offence drives conversion and kill speed; defence sets what a failure costs. */
  loadoutPower: { offence: number; defence: number };
  style: Style;
  twoHanded: boolean;
  /** Rations in the bank. A failed kill eats one or more. */
  rations: number;
  /**
   * Ammunition on hand. Melee needs none; every other style spends some per
   * kill, which is the cost ladder of §7 actually being charged rather than
   * described. Running dry stops the session's killing — a preparation failure,
   * never a penalty for minutes already spent. Omitted means unlimited, which
   * is what the pure tests use.
   */
  ammo?: number;
  /** Folded from equipped uniques (`effects.ts`). Omitted means none. */
  modifiers?: Modifiers;
  rng: Rng;
};

export type CombatResult = {
  spawns: Spawn[];
  kills: number;
  failures: number;
  /** Ammunition spent. Zero for melee, and zero with `freeAmmoOnKill`. */
  ammoUsed: number;
  /** True once ammunition ran out, so the session stopped fighting. */
  outOfAmmo: boolean;
  /** Rations eaten, never more than were carried. */
  rationsUsed: number;
  /** Durability spent on the weapon: one per failure. */
  durabilityUsed: number;
  /** Total loot weight, which the drop tables divide up. */
  lootWeight: number;
  /** True once rations ran out; failures then stop costing what is not there. */
  ranDry: boolean;
  /**
   * Seconds actually spent fighting.
   *
   * The loop already tracks this and threw it away. It is what lets a session
   * that stopped four minutes in say so, instead of reporting the minutes it
   * was given as if it had used them.
   */
  secondsFought: number;
};

/**
 * Resolve a whole session. Spawns are drawn until the minutes are spent, so a
 * 50-minute session is genuinely more kills rather than a multiplier on one.
 */
export function resolveCombat(input: CombatInput): CombatResult {
  const { focusedMs, roster, areaTier, loadoutPower, style, twoHanded, rng } = input;
  const { offence, defence } = loadoutPower;
  const mods = input.modifiers ?? emptyModifiers();
  const spawns: Spawn[] = [];
  let remaining = focusedMs / 1000;
  let rationsUsed = 0;
  let failures = 0;
  let kills = 0;
  let lootWeight = 0;
  let ranDry = false;
  let ammoUsed = 0;
  let outOfAmmo = false;

  const perKill = AMMO_PER_KILL[style];
  const ammoOnHand = input.ammo ?? Number.POSITIVE_INFINITY;
  const spendsAmmo = perKill > 0 && !mods.freeAmmoOnKill;

  // A roster should never be empty — an area with nothing in it is a content
  // bug, not a quiet no-op — but resolving to nothing is safer than looping.
  if (roster.length === 0) {
    return {
      spawns,
      kills: 0,
      failures: 0,
      secondsFought: 0,
      ammoUsed: 0,
      outOfAmmo: false,
      rationsUsed: 0,
      durabilityUsed: 0,
      lootWeight: 0,
      ranDry: false,
    };
  }

  let guard = 0;
  while (remaining > 0 && guard++ < 10_000) {
    // Out of ammunition stops the fighting. It is a preparation failure, and it
    // takes nothing away from the minutes already spent — the session still
    // completes and still pays.
    if (spendsAmmo && ammoUsed + perKill > ammoOnHand) {
      outOfAmmo = true;
      break;
    }

    const variant = roster[rng.int(0, roster.length - 1)];
    const rarity = rollRarity(rng, areaTier);
    const spawn = spawnPower(variant.tier, rarity);

    // A unique may excuse the wheel's penalty; it may not invent its bonus.
    const wheel = mods.ignoreWheelPenalty
      ? Math.max(1, wheelFactor(style, variant.style))
      : wheelFactor(style, variant.style);
    const effective = offence * (1 + mods.offencePct / 100) * wheel;

    const seconds =
      killSeconds(variant, effective, spawn, twoHanded) / (1 + mods.throughputPct / 100);
    if (seconds > remaining) break;
    remaining -= seconds;

    if (spendsAmmo) ammoUsed += perKill;

    const killed = rng.chance(successChance(effective, spawn));
    if (killed) {
      kills += 1;
      lootWeight += rarity.loot;
      spawns.push({ variant, rarity, killed: true, loot: rarity.loot });
    } else {
      failures += 1;
      if (!mods.freeRations) {
        const cost = rationsPerFailure(spawn, defence * (1 + mods.defencePct / 100));
        if (rationsUsed + cost <= input.rations) rationsUsed += cost;
        else ranDry = true;
      }
      spawns.push({ variant, rarity, killed: false, loot: 0 });
    }
  }

  return {
    spawns,
    kills,
    failures,
    ammoUsed,
    outOfAmmo,
    rationsUsed,
    // Only a failure wears the weapon, and a unique can excuse even that.
    durabilityUsed: mods.freeDurability ? 0 : failures,
    lootWeight,
    ranDry,
    secondsFought: Math.max(0, Math.round(focusedMs / 1000 - remaining)),
  };
}

/* ---------------------------------- bosses --------------------------------- */

export type BossResult = {
  killed: boolean;
  /** How far through the fight the session got, 0-1, when it did not land. */
  progress: number;
  rationsUsed: number;
  durabilityUsed: number;
  /** Set on the very first kill: the signature is guaranteed, never rolled. */
  firstKill: boolean;
};

export type BossInput = {
  focusedMs: number;
  bossTier: number;
  bossStyle: Style;
  bossPowerMultiplier: number;
  killSeconds: number;
  loadoutPower: { offence: number; defence: number };
  style: Style;
  rations: number;
  /** Whether `world_progress` already has this boss down. */
  alreadyDown: boolean;
  rng: Rng;
};

/**
 * One long fight rather than a roster.
 *
 * A boss cannot be *lost* — nothing here punishes a completed session — but it
 * can fail to fall, and then the session still paid its XP and the boss is still
 * standing. That is the whole shape of the wall: you come back better, and
 * nothing was taken from you for trying.
 */
export function resolveBoss(input: BossInput): BossResult {
  const power = spawnPower(input.bossTier, {
    ...RARITIES[0],
    power: input.bossPowerMultiplier,
  });
  const effective = input.loadoutPower.offence * wheelFactor(input.style, input.bossStyle);
  const needed = input.killSeconds;
  const have = input.focusedMs / 1000;

  if (have < needed) {
    return {
      killed: false,
      progress: Math.min(1, have / Math.max(1, needed)),
      rationsUsed: 0,
      durabilityUsed: 0,
      firstKill: false,
    };
  }

  const killed = input.rng.chance(successChance(effective, power));
  const cost = killed ? 0 : rationsPerFailure(power, input.loadoutPower.defence);
  return {
    killed,
    progress: killed ? 1 : 0.99,
    rationsUsed: Math.min(input.rations, cost),
    durabilityUsed: killed ? 0 : 1,
    firstKill: killed && !input.alreadyDown,
  };
}
