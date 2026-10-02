import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  equipmentInstances,
  farmPlots,
  focusSessions,
  sessionActivities,
  skillStates,
  slayingContracts,
  worldProgress,
} from "./db/schema";
import { append, adjustWallet, have, loadWallet, logCollected, type Grant } from "./inventory-service";
import { ARCHETYPE_BY_NAME, answerTo, type Style } from "./game/archetypes";
import { BIOME_BY_INDEX } from "./game/biomes";
import {
  MIN_SUCCESS,
  RARITIES,
  resolveCombat,
  spawnPower,
  successChance,
  wheelFactor,
} from "./game/combat";
import { foldDrops, rollDrops, salvageDecision, salvageValue } from "./game/drops";
import { FUEL_BY_LENGTH, salvageStoneYield } from "./game/economy";
import { checkGate, type GateState } from "./game/gate";
import { requirementFor } from "./game/requirements";
import { acceptableWards, tonicEffect, type Ward } from "./game/potions";
import { band, gateTier, loadoutPower, type Equipped, type ItemSpec, type Slot } from "./game/power";
import { rng, sessionSeed } from "./game/rng";
import { SKILLS, skillLevel } from "./game/skills";
import {
  BIOME_UNLOCK_XP,
  milestoneMarker,
  skillLevelXp,
  skillMilestonesCrossed,
} from "./game/milestones";
import { applyDelta, loadState } from "./game-state";
import { tier as tierAt } from "./game/tiers";
import { areasIn, type Variant } from "./game/variants";
import {
  BOSS_KILL_SECONDS,
  BOSS_POWER_MULTIPLIER,
  bossFight,
  bossMarker,
  bossPurse,
  bossesIn,
  rollBossRepeat,
} from "./game/bosses";
import {
  BIOME_TRINKET,
  contractPurse,
  rollContractUnique,
  trinketMarker,
} from "./game/contracts";
import { resolveBoss } from "./game/combat";
import { UNIQUE_BY_NAME, uniqueItemId, type Unique } from "./game/uniques";
import { describeEffect, foldEffects, type Effect, type Modifiers } from "./game/effects";
import { AMMO_LINES, STONE_KINDS, TOOL_SKILLS, gatheredItemId, itemName } from "./game/items";
import { BYPRODUCT, resolveYield } from "./game/yield";
import type { Activity } from "./game/activity";
import { chainMultiplier, linksBefore, type ChainSession } from "./chain";
import type { MilestonePaid, ResolutionSummary } from "./game-types";
import { quality, type Quality } from "./game/quality";

/*
 * Re-exported, because the declarations moved to game-types so a client
 * component can name them without importing a `server-only` module.
 */
export type { MilestonePaid, ResolutionSummary };

/**
 * Choosing what a session is, and turning a finished one into things you own.
 *
 * Two halves, and the order between them is the whole design:
 *
 *   - **Before the timer**, `chooseActivity` evaluates the requirement gate. It
 *     is binary and it names what is missing. Nothing is rolled here.
 *   - **After the timer**, `resolveActivity` resolves the session from its timed
 *     minutes, seeded from the session id so a recompute reproduces it exactly.
 *
 * Nothing is credited until a session COMPLETES. An abandoned session yields
 * nothing, which is why resolution is a separate step rather than something the
 * heartbeat does as it goes.
 */

export type { Activity } from "./game/activity";

const SKILL_LABEL = new Map(SKILLS.map((s) => [s.key, s.label]));
const label = (key: string) => SKILL_LABEL.get(key) ?? key;

/* --------------------------------- reading -------------------------------- */

export async function loadSkills(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ skill: skillStates.skill, xp: skillStates.xp })
    .from(skillStates)
    .where(eq(skillStates.userId, userId));
  const out: Record<string, number> = {};
  for (const s of SKILLS) out[s.key] = 1;
  for (const row of rows) out[row.skill] = skillLevel(row.xp);
  return out;
}

export async function loadSkillXp(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ skill: skillStates.skill, xp: skillStates.xp })
    .from(skillStates)
    .where(eq(skillStates.userId, userId));
  const out: Record<string, number> = {};
  for (const s of SKILLS) out[s.key] = 0;
  for (const row of rows) out[row.skill] = row.xp;
  return out;
}

/** What is worn right now, rebuilt into the shape the power rules want. */
export async function loadEquipped(userId: string): Promise<Equipped> {
  const rows = await db
    .select()
    .from(equipmentInstances)
    .where(and(eq(equipmentInstances.userId, userId), sql`${equipmentInstances.equippedSlot} is not null`));

  const equipped: Equipped = {};
  for (const row of rows) {
    const spec: ItemSpec = {
      slot: row.equippedSlot as Slot,
      style: row.style as Style,
      tier: row.tier,
      quality: row.quality as ItemSpec["quality"],
      refine: row.refine,
      archetype: row.archetype ? ARCHETYPE_BY_NAME.get(row.archetype) : undefined,
    };
    // Worn gear is never destroyed; it is halved until repaired (§7).
    const worn = row.durability <= 0 ? 0.5 : 1;
    equipped[spec.slot] = { spec, rolled: (row.rolled / 1000) * worn };
  }
  return equipped;
}

/**
 * A unique arrives as something you can wear.
 *
 * It used to arrive as a ledger stack, which meant the whole point of a
 * unique — its modifier — could never apply, because only an
 * `equipment_instance` can be equipped. A boss's signature rolls at the TOP of
 * its band: it is guaranteed, so there is nothing to be unlucky about.
 */
async function grantUnique(
  userId: string,
  unique: Unique,
  sessionId: string,
  /** Where in its band it lands. A guaranteed drop takes the top. */
  percentile = 1,
): Promise<void> {
  const spec: ItemSpec = {
    slot: unique.slot,
    // A style-agnostic unique has to resolve to something for affinity, and the
    // difference on a modifier slot is a couple of percent. Recorded rather than
    // hidden.
    style: (unique.style ?? "melee") as Style,
    tier: unique.tier,
    quality: "masterwork",
    refine: 0,
    archetype: undefined,
  };
  const { lo, hi } = band(spec);
  await db.insert(equipmentInstances).values({
    userId,
    itemId: uniqueItemId(unique),
    slot: unique.slot,
    style: spec.style,
    tier: unique.tier,
    quality: "masterwork",
    rolled: Math.round((lo + (hi - lo) * percentile) * 1000),
    sessionId,
  });
  await logCollected(userId, uniqueItemId(unique), percentile);
}

/**
 * What the equipped uniques do.
 *
 * `effects.ts` types sixteen kinds and nothing was reading them, which made all
 * 250 uniques cosmetic — by exactly the standard that module sets against
 * modifiers written as prose. This is the reader.
 */
export async function loadModifiers(
  userId: string,
  skill?: string,
  extra: Effect[] = [],
): Promise<Modifiers> {
  const rows = await db
    .select({ itemId: equipmentInstances.itemId })
    .from(equipmentInstances)
    .where(
      and(eq(equipmentInstances.userId, userId), sql`${equipmentInstances.equippedSlot} is not null`),
    );

  const effects: Effect[] = [];
  for (const row of rows) {
    if (!row.itemId.startsWith("unique:")) continue;
    const unique = UNIQUE_BY_NAME.get(row.itemId.slice("unique:".length));
    if (unique) effects.push(unique.effect);
  }
  return foldEffects([...effects, ...extra], skill);
}

/** The effect of a tonic drunk with a session, if one was. */
export function tonicEffectOf(tonicItemId: string | null): Effect[] {
  if (!tonicItemId) return [];
  const [, effect, step] = tonicItemId.split(":");
  const found = tonicEffect(effect, Number(step));
  return found ? [found] : [];
}

/** Ammunition on hand for a style, at any tier. */
async function ammoCount(userId: string, style: Style): Promise<number> {
  const lines = AMMO_LINES.filter((l) => l.style === style).map((l) => l.name);
  if (lines.length === 0) return Number.POSITIVE_INFINITY;
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'ammo:%' and qty > 0`);
  return rows
    .filter((r) => lines.some((name) => String(r.itemId).startsWith(`ammo:${name}:`)))
    .reduce((n, r) => n + Number(r.qty), 0);
}

/** Spend ammunition, highest tier first — the good stuff is for the hard fights. */
async function spendAmmo(userId: string, style: Style, want: number): Promise<Grant[]> {
  if (want <= 0) return [];
  const lines = AMMO_LINES.filter((l) => l.style === style).map((l) => l.name);
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'ammo:%' and qty > 0`);
  const mine = rows
    .filter((r) => lines.some((name) => String(r.itemId).startsWith(`ammo:${name}:`)))
    .sort((a, b) => Number(String(b.itemId).split(":")[2]) - Number(String(a.itemId).split(":")[2]));

  const out: Grant[] = [];
  let left = want;
  for (const row of mine) {
    if (left <= 0) break;
    const take = Math.min(left, Number(row.qty));
    out.push({ itemId: String(row.itemId), delta: -take, reason: "consumed" });
    left -= take;
  }
  return out;
}

/**
 * Spend rations, cheapest tier first.
 *
 * `rationCount` counts them at any tier, so spending a hardcoded
 * `ration:{areaTier}` was a real bug: holding tier-3 rations and fighting in a
 * tier-9 area passed the gate and then spent rations that were never owned,
 * driving the balance negative — which `db:recompute` would refuse to refold,
 * correctly, because a negative fold is a spend-rule bug.
 */
async function spendRations(userId: string, want: number): Promise<Grant[]> {
  if (want <= 0) return [];
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'ration:%' and qty > 0`);
  const cheapest = rows.sort(
    (a, b) => Number(String(a.itemId).split(":")[1]) - Number(String(b.itemId).split(":")[1]),
  );

  const out: Grant[] = [];
  let left = want;
  for (const row of cheapest) {
    if (left <= 0) break;
    const take = Math.min(left, Number(row.qty));
    out.push({ itemId: String(row.itemId), delta: -take, reason: "consumed" });
    left -= take;
  }
  return out;
}

/** Tonics on hand, for the picker's "drink one with this" line. */
export async function tonicsHeld(
  userId: string,
): Promise<{ itemId: string; name: string; qty: number; does: string }[]> {
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'potion:%' and qty > 0`);

  const out: { itemId: string; name: string; qty: number; does: string }[] = [];
  for (const row of rows) {
    const id = String(row.itemId);
    const [, effect, step] = id.split(":");
    const found = tonicEffect(effect, Number(step));
    if (!found) continue; // a ward is a toll, not something you drink for a buff
    out.push({
      itemId: id,
      name: `${effect} ${["I", "II", "III", "IV", "V", "VI"][Number(step) - 1] ?? step}`,
      qty: Number(row.qty),
      does: describeEffect(found),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What a new character starts with.
 *
 * Granted once, recorded by a marker like every other one-time event. Without it
 * a fresh account had NO open activity: gathering wanted a tool, combat wanted a
 * full set of ten, tools cost coins, and coins came from selling things that
 * could not be gathered. Two hours of focus produced nothing.
 *
 * Deliberately small — six crude tools, ten rations, two wards and a purse. It
 * exists to break a deadlock, not to skip the early game.
 */
export async function ensureStarterKit(userId: string): Promise<boolean> {
  const created = await db
    .insert(worldProgress)
    .values({ userId, marker: "starter:kit" })
    .onConflictDoNothing()
    .returning({ marker: worldProgress.marker });
  if (created.length === 0) return false;

  await append(userId, [
    ...TOOL_SKILLS.map(({ skill }) => ({
      itemId: `tool:${skill}:1:crude`,
      delta: 1,
      reason: "bought" as const,
    })),
    { itemId: "ration:1", delta: 10, reason: "bought" },
    { itemId: "potion:Warded:1", delta: 2, reason: "bought" },
  ]);
  await adjustWallet(userId, { coins: 250 });
  return true;
}

/** Potions on hand, so a ward requirement can be checked against them. */
async function potionsHeld(userId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'potion:%' and qty > 0`);
  return new Map(rows.map((r) => [String(r.itemId), Number(r.qty)]));
}

/** Rations on hand, at any tier. A failed kill eats the cheapest first. */
async function rationCount(userId: string): Promise<number> {
  const rows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'ration:%' and qty > 0`);
  return rows.reduce((n, r) => n + Number(r.qty), 0);
}

export async function loadGateState(userId: string): Promise<GateState> {
  /*
   * Seven reads in one wait, where there used to be three waits.
   *
   * The tools were awaited after this batch and the potions were awaited inside
   * the returned object literal — `potions: await potionsHeld(userId)` — which
   * is the easiest kind of sequential round trip to write and the hardest to
   * see, because it does not look like a step at all. Neither depends on
   * anything above it, and the gate is on the path of every timer page load.
   */
  const [skills, equipped, state, rations, markers, toolRows, potions] = await Promise.all([
    loadSkills(userId),
    loadEquipped(userId),
    loadState(userId),
    rationCount(userId),
    db.select({ marker: worldProgress.marker }).from(worldProgress).where(eq(worldProgress.userId, userId)),
    db
      .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
      .from(sql`inventory_balance`)
      .where(sql`user_id = ${userId} and item_id like 'tool:%' and qty > 0`),
    potionsHeld(userId),
  ]);

  const toolTier: Record<string, number> = {};
  const toolGrade: Record<string, Quality> = {};
  for (const row of toolRows) {
    const [, skill, t, grade] = String(row.itemId).split(":");
    const n = Number(t);
    if (!skill || !Number.isFinite(n)) continue;
    const best = toolTier[skill] ?? 0;
    /*
     * Tier first, then grade. A crude tier-3 pickaxe beats a fine tier-2 one
     * because tier is what the gate reads and grade only scales what comes out
     * — so the better tool is always the deeper one, and grade breaks the tie
     * among equals rather than competing with depth.
     */
    if (n > best) {
      toolTier[skill] = n;
      toolGrade[skill] = (grade as Quality) ?? "plain";
    } else if (n === best) {
      const held = quality(toolGrade[skill] ?? "plain").window;
      const found = quality((grade as Quality) ?? "plain").window;
      if (found > held) toolGrade[skill] = (grade as Quality) ?? "plain";
    }
  }

  return {
    skills,
    // A loadout is only as good as its weakest slot: an empty slot is tier 0.
    equipmentTier: gateTier(equipped),
    toolTier,
    toolGrade,
    rations,
    potions,
    keyItems: markers
      .map((m) => m.marker)
      .filter((m) => m.startsWith("key:"))
      .map((m) => m.slice(4)) as GateState["keyItems"],
    characterLevel: state.level,
  };
}

/* --------------------------------- the gate -------------------------------- */


export type ActivityOffer = {
  activity: Activity;
  /** Everything the picker needs, so the client never imports the world. */
  label: string;
  /** What the character does to it: "gathers", "fights in", "fights". */
  verb: string;
  detail: string;
  group: string;
  tier: number;
  open: boolean;
  missing: string[];
};

/**
 * Everything selectable right now, with the gate already evaluated.
 *
 * The labels are built here on purpose. The picker is a client component, and
 * having it derive names would mean shipping the biome, species and variant
 * tables into the browser to render a list of twenty strings.
 */
export async function offers(userId: string): Promise<ActivityOffer[]> {
  // Cheap and idempotent after the first call, and the one place every player
  // passes through before they can do anything at all.
  await ensureStarterKit(userId);
  // The loadout rides beside the gate, so the list can say what a fight would
  // come to and not only whether you may start it.
  const [state, equipped] = await Promise.all([loadGateState(userId), loadEquipped(userId)]);
  const power = loadoutPower(equipped);
  const style = equipped.weapon?.spec.style ?? null;
  const out: ActivityOffer[] = [];

  for (const skill of SKILLS.filter((s) => s.kind === "gathering")) {
    const best = Math.max(1, state.toolTier[skill.key] ?? 1);
    /*
     * Deepest first, under the skill's own heading, and named for what comes
     * out of the ground.
     *
     * All six skills shared one group called "Gather", and the picker shows
     * twelve rows a group: woodcutting, fishing and mining filled it, so
     * Hunting and Excavation could not be chosen at any tier by a character
     * who had opened both. The rows that did show were named by gluing the
     * tier's metal onto the skill's note — "Copper logs", "Iron fish" — for
     * things the catalogue calls Pine Log and Pike.
     */
    for (let t = Math.min(24, best + 1); t >= 1; t--) {
      const activity: Activity = { kind: "gathering", skill: skill.key, tier: t };
      const requirement = requirementFor(activity);
      const gate = checkGate(requirement, state, label);
      out.push({
        activity,
        label: itemName(gatheredItemId(skill.key, t)),
        verb: "gathers",
        detail: `tier ${t}`,
        group: label(skill.key),
        tier: t,
        ...gate,
      });
    }
  }
  for (const [index, biome] of BIOME_BY_INDEX) {
    for (const area of areasIn(biome)) {
      const activity: Activity = { kind: "combat", biome: index, area: area.index };
      const requirement = requirementFor(activity);
      const gate = checkGate(requirement, state, label);
      out.push({
        activity,
        label: area.name,
        verb: "fights in",
        /*
         * The odds, before the minutes are spent. The gate for the first two
         * tiers asks for no gear at all, so it would wave an unarmed character
         * into a fifty-minute fight they would lose nineteen times in twenty —
         * and "6 monsters" was the only thing the row said about it.
         */
        detail: `tier ${area.tier} · ${landing(area.roster, power.offence, style)}`,
        group: biome.name,
        tier: area.tier,
        ...gate,
      });
    }
    for (const boss of bossesIn(index)) {
      const activity: Activity = { kind: "boss", biome: index, role: boss.role };
      const requirement = requirementFor(activity);
      const gate = checkGate(requirement, state, label);
      out.push({
        activity,
        label: boss.name,
        verb: "fights",
        detail: `boss · tier ${boss.tier} · weak to ${answerTo(boss.style)}${
          style
            ? ` · ${Math.round(bossFight(boss, power.offence, style).seconds / 60)} min, then ${Math.round(bossFight(boss, power.offence, style).chance * 100)}%`
            : " · unarmed"
        }`,
        group: biome.name,
        tier: boss.tier,
        ...gate,
      });
    }
  }
  return out;
}

/**
 * "you land 81% of commons", averaged across an area's roster.
 *
 * Averaged because the wheel differs monster to monster and a session draws
 * from all of them; against a common because that is most of what spawns.
 */
function landing(roster: Variant[], offence: number, style: Style | null): string {
  if (style === null) return `unarmed: ${Math.round(MIN_SUCCESS * 100)}% of fights land`;
  if (roster.length === 0) return "nothing lives here";
  const mean =
    roster.reduce(
      (n, v) =>
        n + successChance(offence * wheelFactor(style, v.style), spawnPower(v.tier, RARITIES[0])),
      0,
    ) / roster.length;
  return `you land ${Math.round(mean * 100)}% of commons`;
}

/** Record the choice. Refuses if the gate is shut — it is checked, not trusted. */
export async function chooseActivity(
  userId: string,
  sessionId: string,
  activity: Activity,
  tonicItemId?: string,
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const state = await loadGateState(userId);
  const requirement = requirementFor(activity);
  const gate = checkGate(requirement, state, label);
  if (!gate.open) return { ok: false, missing: gate.missing };

  const combat = activity.kind === "combat" ? activity : null;
  const boss = activity.kind === "boss" ? activity : null;
  const biome = combat ? BIOME_BY_INDEX.get(combat.biome) : boss ? BIOME_BY_INDEX.get(boss.biome) : undefined;
  const area = biome && combat ? areasIn(biome)[combat.area - 1] : undefined;
  const bossDef = boss ? bossesIn(boss.biome).find((b) => b.role === boss.role) : undefined;
  const equipped = await loadEquipped(userId);

  /**
   * Consumables are spent HERE, at entry, not at resolution.
   *
   * That is what "spent on entry" means, and it is also what makes the cost
   * real: abandoning the session does not give the ward back. The gate was
   * already checked against these holdings by `offers`, and it is checked again
   * below, because a client may not be trusted to have told the truth about
   * what it had.
   */
  const spend: Grant[] = [];
  if (requirement.ward) {
    const accepted = acceptableWards(requirement.ward.ward as Ward, requirement.ward.step);
    const held = await have(userId, accepted);
    let left = requirement.ward.qty;
    for (const id of accepted) {
      if (left <= 0) break;
      const take = Math.min(left, Math.max(0, held.get(id) ?? 0));
      if (take > 0) {
        spend.push({ itemId: id, delta: -take, reason: "gate_entry", sessionId });
        left -= take;
      }
    }
    if (left > 0) {
      // The gate above already passed, so reaching here means the holdings
      // changed under us. Refuse rather than let the session start unpaid.
      return { ok: false, missing: [`${requirement.ward.qty} × ${requirement.ward.ward}`] };
    }
  }
  if (tonicItemId) {
    const held = await have(userId, [tonicItemId]);
    if ((held.get(tonicItemId) ?? 0) < 1) {
      return { ok: false, missing: ["that tonic"] };
    }
    spend.push({ itemId: tonicItemId, delta: -1, reason: "gate_entry", sessionId });
  }
  if (spend.length > 0) await append(userId, spend);

  await db
    .insert(sessionActivities)
    .values({
      sessionId,
      userId,
      kind: activity.kind,
      skill:
        activity.kind === "gathering"
          ? activity.skill
          : (equipped.weapon?.spec.style ?? "melee"),
      tier: activity.kind === "gathering" ? activity.tier : (area?.tier ?? bossDef?.tier ?? 1),
      biome: combat?.biome ?? boss?.biome ?? null,
      // A boss has no area, so the role rides in the same column: 1 for the
      // mid-boss, 2 for the lord.
      area: combat?.area ?? (boss ? (boss.role === "mid" ? 1 : 2) : null),
      style: activity.kind === "gathering" ? null : (equipped.weapon?.spec.style ?? "melee"),
      tonicItemId: tonicItemId ?? null,
    })
    .onConflictDoUpdate({
      target: sessionActivities.sessionId,
      set: {
        kind: activity.kind,
        tier: activity.kind === "gathering" ? activity.tier : (area?.tier ?? bossDef?.tier ?? 1),
        biome: combat?.biome ?? boss?.biome ?? null,
        area: combat?.area ?? (boss ? (boss.role === "mid" ? 1 : 2) : null),
      },
    });
  return { ok: true };
}

/* -------------------------------- resolution ------------------------------- */

/**
 * Pay a milestone into V1's ladder, at most once, ever.
 *
 * `applyDelta` does not deduplicate by reason, so the marker does it: the insert
 * is `onConflictDoNothing` and the XP is only paid when it actually created a
 * row. A milestone that fires twice would inflate the ladder silently, which is
 * the worst shape a bug can take here.
 */
async function payMilestone(
  userId: string,
  marker: string,
  xp: number,
  label: string,
): Promise<MilestonePaid | null> {
  if (xp <= 0) return null;
  const created = await db
    .insert(worldProgress)
    .values({ userId, marker })
    .onConflictDoNothing()
    .returning({ marker: worldProgress.marker });
  if (created.length === 0) return null;

  /*
   * The level change is kept rather than dropped. A milestone lump can carry
   * the character over a rank, and this was the one path where the *game*
   * levelled you up — so it was the one rank-up with no full-screen moment,
   * because applyDelta's return value went in the bin.
   */
  const { levelChange } = await applyDelta(userId, null, `milestone:${marker}`, { xp });
  return { marker, label, xp, levelChange };
}

/**
 * Add skill XP and pay for any milestone level it crossed.
 *
 * A single session can carry a low skill through more than one milestone, so
 * every crossing is paid rather than only the level landed on.
 */
async function addSkillXp(
  userId: string,
  skill: string,
  xp: number,
  /**
   * Told the skill's total after the add, when a caller wants to draw it.
   *
   * The result screen printed "+25 Mining XP" in its smallest type and could
   * not say whether that was a level, because the one statement that knew the
   * running total returned it and nothing kept it.
   */
  onTotal?: (total: number) => void,
): Promise<MilestonePaid[]> {
  if (xp <= 0) return [];
  const [row] = await db
    .insert(skillStates)
    .values({ userId, skill, xp })
    .onConflictDoUpdate({
      target: [skillStates.userId, skillStates.skill],
      set: { xp: sql`${skillStates.xp} + ${xp}` },
    })
    .returning({ xp: skillStates.xp });

  onTotal?.(row?.xp ?? xp);
  const after = skillLevel(row?.xp ?? xp);
  const before = skillLevel(Math.max(0, (row?.xp ?? xp) - xp));

  const paid: MilestonePaid[] = [];
  for (const level of skillMilestonesCrossed(before, after)) {
    const got = await payMilestone(
      userId,
      milestoneMarker("skill", skill, level),
      skillLevelXp(level),
      `${label(skill)} ${level}`,
    );
    if (got) paid.push(got);
  }
  return paid;
}


/**
 * Resolve one completed session, exactly once.
 *
 * `resolved_at` is the guard: a session that has already paid never pays again,
 * which matters because this runs from a server action that a retry or a double
 * click could fire twice.
 */
export async function resolveActivity(
  userId: string,
  sessionId: string,
): Promise<ResolutionSummary | null> {
  const [row] = await db
    .select()
    .from(sessionActivities)
    .where(and(eq(sessionActivities.sessionId, sessionId), eq(sessionActivities.userId, userId)))
    .limit(1);
  if (!row || row.resolvedAt) return null;

  const [session] = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
    .limit(1);
  if (!session || session.status !== "completed") return null;

  const focusedMs = Math.max(
    0,
    (session.endedAt?.getTime() ?? session.startedAt.getTime()) - session.startedAt.getTime() - session.pausedMs,
  );

  // The chain multiplies yield as well as XP, read from the ledger rather than
  // stored, so it can never drift.
  const history = await db
    .select({
      status: focusSessions.status,
      startedAt: focusSessions.startedAt,
      endedAt: focusSessions.endedAt,
    })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), sql`${focusSessions.id} <> ${sessionId}`))
    .orderBy(sql`${focusSessions.startedAt} desc`)
    .limit(20);
  const links = linksBefore(
    history.map<ChainSession>((h) => ({
      status: h.status as ChainSession["status"],
      startedAt: h.startedAt.getTime(),
      endedAt: h.endedAt?.getTime() ?? null,
    })),
    session.startedAt.getTime(),
  );
  // A unique can add links to the chain — the only place V2 reaches into a V1
  // mechanic, and it reaches by adding to the count rather than by storing a
  // multiplier, which would let it drift from the ledger.
  const chainMods = await loadModifiers(userId, undefined, tonicEffectOf(row.tonicItemId));
  const chain = chainMultiplier(links + chainMods.chainLinks, session.plannedMinutes);

  const fuel = FUEL_BY_LENGTH[session.plannedMinutes] ?? 0;
  const summary: ResolutionSummary = {
    kind: row.kind,
    skill: row.skill,
    tier: row.tier,
    minutes: Math.round(focusedMs / 60_000),
    coins: 0,
    fuel,
    skillXp: 0,
    items: [],
    equipmentKept: 0,
    equipmentSalvaged: 0,
    milestones: [],
  };

  if (row.kind === "boss") {
    const boss = bossesIn(row.biome ?? 1).find((b) => (row.area === 1 ? b.role === "mid" : b.role === "lord"));
    const equipped = await loadEquipped(userId);
    const power = loadoutPower(equipped);
    const style = (row.style ?? equipped.weapon?.spec.style ?? "melee") as Style;
    const rations = await rationCount(userId);
    const marker = boss ? bossMarker(boss) : "boss:unknown";
    const [down] = boss
      ? await db
          .select({ marker: worldProgress.marker })
          .from(worldProgress)
          .where(and(eq(worldProgress.userId, userId), eq(worldProgress.marker, marker)))
          .limit(1)
      : [];

    // How long this loadout needs, worked out once and read by both the
    // resolver and the screen that explains what the resolver did.
    const needed = boss ? bossFight(boss, power.offence, style).seconds : BOSS_KILL_SECONDS;
    const result = resolveBoss({
      focusedMs,
      bossTier: boss?.tier ?? row.tier,
      bossStyle: boss?.style ?? "melee",
      bossPowerMultiplier: BOSS_POWER_MULTIPLIER,
      killSeconds: needed,
      loadoutPower: power,
      style,
      rations,
      alreadyDown: Boolean(down),
      rng: rng(sessionSeed(sessionId, "boss")),
    });

    /*
     * Spent from what is held, like every other ration in the game.
     *
     * This was `ration:${row.tier}` — the id the invariant names as the bug,
     * fixed in the area fight and left standing here. The gate counts rations
     * at any tier, so losing to a tier-9 boss on tier-3 rations spent a stack
     * that did not exist and drove its balance negative.
     */
    await append(
      userId,
      (await spendRations(userId, result.rationsUsed)).map((g) => ({ ...g, sessionId })),
    );
    // A lost fight wears the weapon. `resolveBoss` has always returned this and
    // nothing applied it, so only an area could ever dull an edge.
    if (result.durabilityUsed > 0) {
      await db
        .update(equipmentInstances)
        .set({
          durability: sql`greatest(0, ${equipmentInstances.durability} - ${result.durabilityUsed})`,
        })
        .where(
          and(eq(equipmentInstances.userId, userId), eq(equipmentInstances.equippedSlot, "weapon")),
        );
    }

    // The signature is guaranteed on the first kill and never rolled — and
    // `world_progress` is what stops a guarantee firing twice. Every kill after
    // it rolls the rest of the boss's table, seeded from the session.
    const taken: string[] = [];
    if (result.firstKill && boss?.signature) {
      await grantUnique(userId, boss.signature, sessionId);
      taken.push(boss.signature.name);
    } else if (result.killed && boss) {
      const again = rollBossRepeat(boss, rng(sessionSeed(sessionId, "boss-table")));
      if (again) {
        await grantUnique(userId, again.unique, sessionId, again.percentile);
        taken.push(again.unique.name);
      }
    }
    const purse = result.killed && boss ? bossPurse(boss) : 0;

    if (result.killed && boss) {
      await db
        .insert(worldProgress)
        .values({ userId, marker })
        .onConflictDoUpdate({
          target: [worldProgress.userId, worldProgress.marker],
          set: { count: sql`${worldProgress.count} + 1` },
        });
      if (boss.role === "lord") {
        const keyed = BIOME_BY_INDEX.get(boss.biome)?.keyItem;
        if (keyed) {
          await db
            .insert(worldProgress)
            .values({ userId, marker: `key:${keyed}` })
            .onConflictDoNothing();
        }
      }
    }

    await adjustWallet(userId, { coins: purse, fuel });
    summary.milestones.push(
      ...(await addSkillXp(userId, style, Math.round(focusedMs / 60_000), (total) => {
        summary.skillXpTotal = total;
      })),
    );
    summary.kills = result.killed ? 1 : 0;
    summary.failures = result.killed ? 0 : 1;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.skill = style;
    summary.coins = purse;
    summary.coinsFromDrops = purse;
    summary.items = taken.map((name) => ({ itemId: `unique:${name}`, name, qty: 1 }));
    summary.bossFirstKill = result.firstKill;
    summary.bossSeconds = Math.round(needed);
    summary.bossDown = result.killed;
    summary.bossProgress = result.progress;
    summary.bossName = boss?.name;
    summary.bossWeakTo = boss?.style;
    summary.style = style;
    summary.where = boss?.name;
    summary.rationsUsed = result.rationsUsed;
    // A fifty that fell short of the kill and a fifty that was simply too short
    // for one are different problems with different answers, so the screen has
    // to be able to tell them apart.
    summary.bossTooShort = !result.killed && focusedMs / 1000 < needed;
  } else if (row.kind === "gathering") {
    /*
     * Two waits, and the skills come free.
     *
     * These were three sequential round trips, and the first of them was a
     * repeat: `loadGateState` reads `skill_state` itself and hands it back on
     * `gate.skills`, so `loadSkills` here was asking the same question twice
     * and waiting for the answer before asking the next one.
     */
    const [gate, mods] = await Promise.all([
      loadGateState(userId),
      loadModifiers(userId, row.skill, tonicEffectOf(row.tonicItemId)),
    ]);
    const skills = gate.skills;
    const result = resolveYield({
      focusedMs,
      skill: row.skill,
      tier: row.tier,
      toolTier: Math.max(
        gate.toolTier[row.skill] ?? row.tier,
        // A unique that "counts as a tool two tiers above itself" is read here.
        (gate.toolTier[row.skill] ?? row.tier) + (mods.toolBonus[row.skill] ?? 0),
      ),
      // The grade of the tool the gate just accepted, and the only thing grade
      // moves anywhere in the game.
      toolWindow: quality(gate.toolGrade[row.skill] ?? "plain").window,
      skillLevel: skills[row.skill] ?? 1,
      chainMultiplier: chain,
      modifiers: mods,
      rng: rng(sessionSeed(sessionId, "yield")),
    });
    const itemId = gatheredItemId(row.skill, row.tier);
    const extraId = `raw:${BYPRODUCT[row.skill]?.line}:${tierAt(row.tier).tier}`;
    await append(userId, [
      { itemId, delta: result.units, reason: "session_yield", sessionId },
      // The second line: gems from mining, meat from hunting. Both were named
      // in the catalogue and consumed by a recipe before anything produced them.
      ...(result.byproduct > 0
        ? [{ itemId: extraId, delta: result.byproduct, reason: "session_yield" as const, sessionId }]
        : []),
    ]);
    summary.milestones.push(
      ...(await addSkillXp(userId, row.skill, result.skillXp, (total) => {
        summary.skillXpTotal = total;
      })),
    );
    summary.units = result.units;
    summary.skillXp = result.skillXp;
    // The NAME, not the id. This was `name: itemId`, so a gathering result
    // would have read literally "raw:Ore:12" — combat already used the name.
    summary.items = [
      { itemId, name: itemName(itemId), qty: result.units },
      ...(result.byproduct > 0
        ? [{ itemId: extraId, name: itemName(extraId), qty: result.byproduct }]
        : []),
    ];
    summary.where = itemName(itemId);
    summary.yieldParts = result.parts;
    summary.unitsExpected = result.expected;
  } else {
    const biome = BIOME_BY_INDEX.get(row.biome ?? 1);
    const area = biome ? areasIn(biome)[(row.area ?? 1) - 1] : undefined;
    const equipped = await loadEquipped(userId);
    const power = loadoutPower(equipped);
    const style = (row.style ?? equipped.weapon?.spec.style ?? "melee") as Style;
    const rations = await rationCount(userId);
    const carriedAmmo = await ammoCount(userId, style);

    const mods = await loadModifiers(userId, undefined, tonicEffectOf(row.tonicItemId));
    const combat = resolveCombat({
      focusedMs,
      roster: area?.roster ?? [],
      areaTier: area?.tier ?? row.tier,
      loadoutPower: power,
      style,
      twoHanded: equipped.weapon?.spec.archetype?.hands === 2,
      rations,
      ammo: carriedAmmo,
      modifiers: mods,
      rng: rng(sessionSeed(sessionId, "combat")),
    });

    const lootRng = rng(sessionSeed(sessionId, "loot"));
    // +rare drop chance is read here, and nowhere else: rarity belongs to the
    // monster, so a unique may only move how often a rare table pays out.
    const dropBonus = 1 + mods.dropRatePct / 100;
    const drops = combat.spawns
      .filter((s) => s.killed)
      .flatMap((s) =>
        rollDrops({
          variant: s.variant,
          rarity: s.rarity,
          style,
          dropBonus,
          rollTwice: mods.rollTwice,
          rng: lootRng,
        }),
      );
    const folded = foldDrops(drops);

    const wallet = await loadWallet(userId);
    const grants: Grant[] = [...folded.items.entries()].map(([itemId, item]) => ({
      itemId,
      delta: item.qty,
      reason: "combat_drop",
      sessionId,
    }));

    // Rations and ammunition are both spent from what is actually held, at
    // whatever tier that is, rather than from an id assumed to exist.
    grants.push(
      ...(await spendRations(userId, combat.rationsUsed)).map((g) => ({ ...g, sessionId })),
    );
    grants.push(
      ...(await spendAmmo(userId, style, combat.ammoUsed)).map((g) => ({ ...g, sessionId })),
    );
    await append(userId, grants);

    // A failure wears the weapon. Worn gear is never destroyed — it is halved
    // until repaired — and without this it never wore at all, so `repairAll`
    // had nothing to mend and the cost of a failure was only ever rations.
    if (combat.durabilityUsed > 0) {
      await db
        .update(equipmentInstances)
        .set({
          durability: sql`greatest(0, ${equipmentInstances.durability} - ${combat.durabilityUsed})`,
        })
        .where(
          and(
            eq(equipmentInstances.userId, userId),
            eq(equipmentInstances.equippedSlot, "weapon"),
          ),
        );
    }

    // Found gear meets the auto-salvage rules before it reaches the bank, which
    // is what stops a limited bank becoming an inventory minigame.
    let kept = 0;
    const keptPieces: NonNullable<ResolutionSummary["equipment"]> = [];
    let salvaged = 0;
    let salvageCoins = 0;
    const salvageStones: Grant[] = [];
    for (const piece of folded.equipment) {
      const decision = salvageDecision(piece.percentile, {
        salvageBelow: wallet.salvageBelow,
        keepAbove: wallet.keepAbove,
      });
      if (decision === "salvage") {
        salvaged += 1;
        if (wallet.salvageOutput === "stones") {
          // Set once, and this is the whole of it: the junk the threshold was
          // already eating becomes upgrade stones at the item's own tier rather
          // than coins. Nothing here converts upward, so shallow junk can never
          // fund deep refinement — the downward exchange is at the shop.
          salvageStones.push({
            itemId: `stone:${STONE_KINDS[piece.tier % STONE_KINDS.length]}:${piece.tier}`,
            delta: salvageStoneYield(piece.tier, piece.percentile),
            reason: "salvage",
            sessionId,
          });
        } else {
          salvageCoins += salvageValue(piece.tier, piece.percentile);
        }
        continue;
      }
      /*
       * The archetype comes through with the drop now, and it has to: `centre`
       * takes a weapon's power from `archetype.damage` and `band` its width
       * from `archetype.bandPct`, so a found weapon built without one was
       * rolled against the flat slot fallback — the wrong power, in the wrong
       * band, under a name that did not exist.
       */
      const spec: ItemSpec = {
        slot: piece.slot as Slot,
        style: piece.style as Style,
        tier: piece.tier,
        quality: piece.quality,
        refine: 0,
        archetype: piece.archetype ? ARCHETYPE_BY_NAME.get(piece.archetype) : undefined,
      };
      const { lo, hi } = band(spec);
      await db.insert(equipmentInstances).values({
        userId,
        itemId: piece.itemId,
        slot: piece.slot,
        style: piece.style as Style,
        tier: piece.tier,
        quality: piece.quality,
        // Without this a found two-hander never gives up the offhand, which is
        // the whole of what a two-hander costs.
        archetype: piece.archetype ?? null,
        rolled: Math.round((lo + (hi - lo) * piece.percentile) * 1000),
        sessionId,
      });
      // An instance never passes through the ledger, so the collection log has
      // to be told separately — otherwise found equipment would never count
      // toward a collection achievement, which reads the log and not holdings.
      await logCollected(userId, piece.itemId, piece.percentile);
      keptPieces.push({
        name: itemName(piece.itemId),
        slot: piece.slot,
        quality: piece.quality,
        percentile: piece.percentile,
      });
      kept += 1;
    }

    if (salvageStones.length > 0) await append(userId, salvageStones);
    await adjustWallet(userId, { coins: folded.coins + salvageCoins, fuel });
    summary.milestones.push(
      ...(await addSkillXp(userId, style, Math.round(focusedMs / 60_000), (total) => {
        summary.skillXpTotal = total;
      })),
    );
    summary.milestones.push(...(await addSkillXp(userId, "slaying", Math.round(combat.kills / 4))));

    summary.kills = combat.kills;
    summary.failures = combat.failures;
    summary.legendaryKills = combat.spawns.filter(
      (s) => s.killed && s.rarity.key === "legendary",
    ).length;
    summary.coins = folded.coins + salvageCoins;
    // The two halves of that sum, so the screen can say which was which
    // rather than quoting a total with no account of itself.
    summary.coinsFromDrops = folded.coins;
    summary.coinsFromSalvage = salvageCoins;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.skill = style;
    summary.equipmentKept = kept;
    summary.equipmentSalvaged = salvaged;
    summary.salvageStones = salvageStones.reduce((n, g) => n + g.delta, 0);
    summary.ranDry = combat.ranDry;
    summary.outOfAmmo = combat.outOfAmmo;
    summary.ammoUsed = combat.ammoUsed;
    summary.ammoCarried = carriedAmmo;
    summary.rationsUsed = combat.rationsUsed;
    summary.secondsFought = combat.secondsFought;
    summary.where = area?.name;
    summary.style = style;
    summary.equipment = keptPieces;
    summary.killsByRarity = combat.spawns
      .filter((sp) => sp.killed)
      .reduce<Record<string, number>>((acc, sp) => {
        acc[sp.rarity.key] = (acc[sp.rarity.key] ?? 0) + 1;
        return acc;
      }, {});
    summary.items = [...folded.items.entries()].map(([itemId, i]) => ({
      itemId,
      name: i.name,
      qty: i.qty,
    }));

    const contract = await advanceContract(
      userId,
      sessionId,
      combat.spawns.filter((s) => s.killed).map((s) => s.variant.name),
    );
    if (contract) {
      summary.contract = contract.progress;
      summary.milestones.push(...contract.milestones);
    }
  }

  if (row.kind === "gathering") await adjustWallet(userId, { fuel });

  // A biome opening up pays once. The marker is the record, so a hundred later
  // sessions in the same biome pay nothing.
  if (row.biome !== null) {
    const biomeName = BIOME_BY_INDEX.get(row.biome)?.name ?? `biome ${row.biome}`;
    const got = await payMilestone(
      userId,
      milestoneMarker("biome", row.biome),
      BIOME_UNLOCK_XP,
      `${biomeName} opened`,
    );
    if (got) summary.milestones.push(got);
  }

  // A `characterXp` unique pays a lump here rather than inside V1's XP path.
  // Reaching into `session-service` would put a V2 dependency in the one code
  // path that must never break, and the arithmetic is the same either way.
  if (chainMods.characterXpPct > 0) {
    // Derived from the minutes actually focused rather than the planned length:
    // this runs after resolution, where only the timed figure is to hand, and it
    // is the timed figure that the ladder is paid on anyway.
    const base = Math.round(focusedMs / 60_000);
    const bonus = Math.round(base * (chainMods.characterXpPct / 100));
    if (bonus > 0) {
      await applyDelta(userId, null, `unique:characterXp:${sessionId}`, { xp: bonus });
      summary.milestones.push({
        marker: `unique:${sessionId}`,
        label: "Unique XP bonus",
        xp: bonus,
      });
    }
  }

  // The last rank a milestone paid for, so the overlay can fire for it.
  summary.levelChange =
    [...summary.milestones].reverse().find((m) => m.levelChange)?.levelChange ?? null;

  summary.plots = await advancePlots(userId);
  /*
   * The summary is written in the same statement that sets `resolved_at`, so
   * there is no window where a session is settled but has no record of what it
   * paid — and a retry, which the guard turns into a no-op, can still read back
   * the result the first call produced instead of showing the user nothing.
   */
  await db
    .update(sessionActivities)
    .set({
      resolvedAt: new Date(),
      kills: summary.kills ?? 0,
      failures: summary.failures ?? 0,
      legendaryKills: summary.legendaryKills ?? 0,
      unitsGathered: summary.units ?? 0,
      result: summary,
    })
    .where(eq(sessionActivities.sessionId, sessionId));

  return summary;
}

/*
 * `gatheredItemId` moved to `game/items`, where the purity rule puts it: it has
 * no clock and no database, and a test cannot reach a `server-only` module to
 * ask what a session yields. Re-exported so its callers do not have to care.
 */
export { gatheredItemId } from "./game/items";

/**
 * Farming advances one stage per COMPLETED SESSION, whatever the session was
 * doing. Never by elapsed time: the user's focus is the only clock here.
 */
async function advancePlots(userId: string): Promise<{ advanced: number; ready: number }> {
  const moved = await db
    .update(farmPlots)
    .set({ stagesLeft: sql`greatest(0, ${farmPlots.stagesLeft} - 1)` })
    .where(and(eq(farmPlots.userId, userId), sql`${farmPlots.stagesLeft} > 0`))
    .returning({ stagesLeft: farmPlots.stagesLeft });
  return { advanced: moved.length, ready: moved.filter((p) => p.stagesLeft === 0).length };
}

/**
 * Count a session's kills against the open contract, and pay it if that
 * finishes it.
 *
 * One conditional UPDATE does the counting and the claiming, the same shape as
 * a session settling: the WHERE narrows to a contract that is still open, the
 * row comes back with `completed_at` set exactly once, and only the caller
 * holding that row pays. A contract read, compared and then written could be
 * finished twice by two reconciles overlapping.
 *
 * It returns what it did. It used to return nothing, so the one event a
 * contract exists for — finishing it — happened in silence, on a screen that
 * was already telling the player about the same kills.
 */
async function advanceContract(
  userId: string,
  sessionId: string,
  killed: string[],
): Promise<{
  progress: NonNullable<ResolutionSummary["contract"]>;
  milestones: MilestonePaid[];
} | null> {
  if (killed.length === 0) return null;
  const [contract] = await db
    .select()
    .from(slayingContracts)
    .where(and(eq(slayingContracts.userId, userId), isNull(slayingContracts.completedAt)))
    .limit(1);
  if (!contract) return null;
  const hits = killed.filter((name) => name === contract.variantName).length;
  if (hits === 0) return null;

  const [claimed] = await db
    .update(slayingContracts)
    .set({
      killed: sql`least(${slayingContracts.required}, ${slayingContracts.killed} + ${hits})`,
      completedAt: sql`case when ${slayingContracts.killed} + ${hits} >= ${slayingContracts.required} then now() else null end`,
    })
    .where(and(eq(slayingContracts.id, contract.id), isNull(slayingContracts.completedAt)))
    .returning({ killed: slayingContracts.killed, completedAt: slayingContracts.completedAt });
  if (!claimed) return null;

  const progress: NonNullable<ResolutionSummary["contract"]> = {
    name: contract.variantName,
    before: contract.killed,
    after: claimed.killed,
    required: contract.required,
    done: claimed.completedAt !== null,
  };
  if (!progress.done) return { progress, milestones: [] };

  // Ledger first, wallet second, the instance last: a crash part-way leaves a
  // contract that is closed and under-paid, never one that can be paid twice.
  const purse = contractPurse(contract.tier, contract.required);
  await append(userId, [
    { itemId: purse.stoneItemId, delta: purse.stones, reason: "contract", sessionId },
  ]);
  await adjustWallet(userId, { coins: purse.coins });
  const milestones = await addSkillXp(userId, "slaying", purse.xp);

  // The biome's own trinket, the first time a contract is finished there. The
  // marker is the claim, so a guarantee cannot be handed out twice.
  const trinket = BIOME_TRINKET.get(contract.biome);
  const [first] = trinket
    ? await db
        .insert(worldProgress)
        .values({ userId, marker: trinketMarker(contract.biome) })
        .onConflictDoNothing()
        .returning({ marker: worldProgress.marker })
    : [];
  let unique: string | undefined;
  if (trinket && first) {
    await grantUnique(userId, trinket, sessionId);
    unique = trinket.name;
  } else {
    // Seeded from the contract, not the session: it is the contract being paid.
    const found = rollContractUnique(rng(`${contract.id}/unique`), contract.tier);
    if (found) {
      await grantUnique(userId, found.unique, sessionId, found.percentile);
      unique = found.unique.name;
    }
  }

  return {
    progress: { ...progress, coins: purse.coins, stones: purse.stones, xp: purse.xp, unique },
    milestones,
  };
}
