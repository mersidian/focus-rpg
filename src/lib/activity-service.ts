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
import { ARCHETYPE_BY_NAME, type Style } from "./game/archetypes";
import { BIOME_BY_INDEX } from "./game/biomes";
import { resolveCombat, RARITIES, rationsPerFailure, spawnPower } from "./game/combat";
import { foldDrops, rollDrops, salvageDecision, salvageValue } from "./game/drops";
import { FUEL_BY_LENGTH, salvageStoneYield } from "./game/economy";
import { checkGate, type GateState, type Requirement } from "./game/gate";
import { acceptableWards, hazardOf, tonicEffect, wardTierFor, type Ward } from "./game/potions";
import { band, loadoutPower, type Equipped, type ItemSpec, type Slot } from "./game/power";
import { rng, sessionSeed } from "./game/rng";
import { SKILLS, processingXp, skillLevel, tierSkillRequirement } from "./game/skills";
import {
  BIOME_UNLOCK_XP,
  FIRST_REFINE_TEN_XP,
  milestoneMarker,
  skillLevelXp,
  skillMilestonesCrossed,
} from "./game/milestones";
import { applyDelta, loadState } from "./game-state";
import { tier as tierAt } from "./game/tiers";
import { areasIn } from "./game/variants";
import { BOSS_POWER_MULTIPLIER, bossKillSeconds, bossMarker, bossesIn } from "./game/bosses";
import { resolveBoss } from "./game/combat";
import { UNIQUE_BY_NAME, uniqueItemId, type Unique } from "./game/uniques";
import { describeEffect, foldEffects, type Effect, type Modifiers } from "./game/effects";
import { AMMO_LINES, STONE_KINDS } from "./game/items";
import { resolveYield } from "./game/yield";
import type { Activity } from "./game/activity";
import { chainMultiplier, linksBefore, type ChainSession } from "./chain";

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
async function grantUnique(userId: string, unique: Unique, sessionId: string): Promise<void> {
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
  const { hi } = band(spec);
  await db.insert(equipmentInstances).values({
    userId,
    itemId: uniqueItemId(unique),
    slot: unique.slot,
    style: spec.style,
    tier: unique.tier,
    quality: "masterwork",
    rolled: Math.round(hi * 1000),
    sessionId,
  });
  await logCollected(userId, uniqueItemId(unique), 1);
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
  const [skills, equipped, state, rations, markers] = await Promise.all([
    loadSkills(userId),
    loadEquipped(userId),
    loadState(userId),
    rationCount(userId),
    db.select({ marker: worldProgress.marker }).from(worldProgress).where(eq(worldProgress.userId, userId)),
  ]);

  const tiers = Object.values(equipped).map((e) => e?.spec.tier ?? 0);
  const toolTier: Record<string, number> = {};
  const toolRows = await db
    .select({ itemId: sql<string>`item_id`, qty: sql<number>`qty` })
    .from(sql`inventory_balance`)
    .where(sql`user_id = ${userId} and item_id like 'tool:%' and qty > 0`);
  for (const row of toolRows) {
    const [, skill, t] = String(row.itemId).split(":");
    const n = Number(t);
    if (skill && Number.isFinite(n)) toolTier[skill] = Math.max(toolTier[skill] ?? 0, n);
  }

  return {
    skills,
    // A loadout is only as good as its weakest slot: an empty slot is tier 0.
    equipmentTier: tiers.length === 10 ? Math.min(...tiers) : 0,
    toolTier,
    rations,
    potions: await potionsHeld(userId),
    keyItems: markers
      .map((m) => m.marker)
      .filter((m) => m.startsWith("key:"))
      .map((m) => m.slice(4)) as GateState["keyItems"],
    characterLevel: state.level,
  };
}

/* --------------------------------- the gate -------------------------------- */

export function requirementFor(activity: Activity): Requirement {
  if (activity.kind === "gathering") {
    return {
      skill: { key: activity.skill, level: tierSkillRequirement(activity.tier) },
      toolTier: activity.tier,
    };
  }

  const biome = BIOME_BY_INDEX.get(activity.biome);

  const hazard = biome ? hazardOf(biome) : null;
  const ward = hazard
    ? { ward: hazard.ward, step: wardTierFor(biome!.tierLo), qty: hazard.qty }
    : undefined;

  if (activity.kind === "boss") {
    const boss = bossesIn(activity.biome).find((b) => b.role === activity.role);
    const t = boss?.tier ?? 1;
    // A boss wants a full set AT its tier, not one below: it is the wall that
    // says come back better, and it should read that way in the gate.
    return {
      equipmentTier: t,
      rations: Math.max(2, Math.round(t / 3)),
      // A boss stands deeper in its biome, so it wants more of the ward.
      ward: ward ? { ...ward, qty: ward.qty + 1 } : undefined,
      keyItem: biome?.keyItem ?? undefined,
      characterLevel: Math.max(1, Math.round(t * 1.8)),
    };
  }

  const area = biome ? areasIn(biome)[activity.area - 1] : undefined;
  const t = area?.tier ?? 1;
  return {
    equipmentTier: Math.max(1, t - 1),
    rations: Math.max(1, Math.round(t / 4)),
    ward,
    keyItem: biome?.keyItem ?? undefined,
    characterLevel: Math.max(1, Math.round(t * 1.5)),
  };
}

export type ActivityOffer = {
  activity: Activity;
  /** Everything the picker needs, so the client never imports the world. */
  label: string;
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
  const state = await loadGateState(userId);
  const out: ActivityOffer[] = [];

  for (const skill of SKILLS.filter((s) => s.kind === "gathering")) {
    const best = Math.max(1, state.toolTier[skill.key] ?? 1);
    for (let t = 1; t <= Math.min(24, best + 1); t++) {
      const activity: Activity = { kind: "gathering", skill: skill.key, tier: t };
      const requirement = requirementFor(activity);
      const gate = checkGate(requirement, state, label);
      out.push({
        activity,
        label: `${label(skill.key)} · tier ${t}`,
        detail: `${tierAt(t).metal} ${skill.note.split(",")[0]}`,
        group: "Gather",
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
        detail: `tier ${area.tier} · ${area.roster.length} monsters`,
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
        detail: `boss · tier ${boss.tier} · weak to ${
          boss.style === "melee" ? "gun" : boss.style === "ranged" ? "melee" : boss.style === "magic" ? "ranged" : "magic"
        }`,
        group: biome.name,
        tier: boss.tier,
        ...gate,
      });
    }
  }
  return out;
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

  await applyDelta(userId, null, `milestone:${marker}`, { xp });
  return { marker, label, xp };
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

export type MilestonePaid = { marker: string; label: string; xp: number };

export type ResolutionSummary = {
  kind: "gathering" | "combat" | "boss";
  skill: string;
  tier: number;
  units?: number;
  kills?: number;
  failures?: number;
  legendaryKills?: number;
  coins: number;
  fuel: number;
  skillXp: number;
  items: { name: string; qty: number }[];
  equipmentKept: number;
  equipmentSalvaged: number;
  ranDry?: boolean;
  /** True when ammunition ran out and the session stopped fighting. */
  outOfAmmo?: boolean;
  ammoUsed?: number;
  /** Upgrade stones from salvage, when the rule is set to stones. */
  salvageStones?: number;
  /** Lumps paid into V1's ladder by this session (§11). */
  milestones: MilestonePaid[];
};

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
  const chain = chainMultiplier(links + chainMods.chainLinks);

  const fuel = FUEL_BY_LENGTH[session.plannedMinutes] ?? 0;
  const summary: ResolutionSummary = {
    kind: row.kind,
    skill: row.skill,
    tier: row.tier,
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

    const result = resolveBoss({
      focusedMs,
      bossTier: boss?.tier ?? row.tier,
      bossStyle: boss?.style ?? "melee",
      bossPowerMultiplier: BOSS_POWER_MULTIPLIER,
      killSeconds: bossKillSeconds(power.offence, 1),
      loadoutPower: power,
      style,
      rations,
      alreadyDown: Boolean(down),
      rng: rng(sessionSeed(sessionId, "boss")),
    });

    const grants: Grant[] = [];
    if (result.rationsUsed > 0) {
      grants.push({
        itemId: `ration:${row.tier}`,
        delta: -result.rationsUsed,
        reason: "consumed",
        sessionId,
      });
    }
    // The signature is guaranteed on the first kill and never rolled — and
    // `world_progress` is what stops a guarantee firing twice.
    if (result.firstKill && boss?.signature) {
      await grantUnique(userId, boss.signature, sessionId);
    }
    await append(userId, grants);

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

    await adjustWallet(userId, { fuel });
    summary.milestones.push(...(await addSkillXp(userId, style, Math.round(focusedMs / 60_000))));
    summary.kills = result.killed ? 1 : 0;
    summary.failures = result.killed ? 0 : 1;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.items = result.firstKill && boss?.signature ? [{ name: boss.signature.name, qty: 1 }] : [];
  } else if (row.kind === "gathering") {
    const skills = await loadSkills(userId);
    const gate = await loadGateState(userId);
    const mods = await loadModifiers(userId, row.skill, tonicEffectOf(row.tonicItemId));
    const result = resolveYield({
      focusedMs,
      tier: row.tier,
      toolTier: Math.max(
        gate.toolTier[row.skill] ?? row.tier,
        // A unique that "counts as a tool two tiers above itself" is read here.
        (gate.toolTier[row.skill] ?? row.tier) + (mods.toolBonus[row.skill] ?? 0),
      ),
      skillLevel: skills[row.skill] ?? 1,
      chainMultiplier: chain,
      modifiers: mods,
      rng: rng(sessionSeed(sessionId, "yield")),
    });
    const itemId = gatheredItemId(row.skill, row.tier);
    await append(userId, [
      { itemId, delta: result.units, reason: "session_yield", sessionId },
    ]);
    summary.milestones.push(...(await addSkillXp(userId, row.skill, result.skillXp)));
    summary.units = result.units;
    summary.skillXp = result.skillXp;
    summary.items = [{ name: itemId, qty: result.units }];
  } else {
    const biome = BIOME_BY_INDEX.get(row.biome ?? 1);
    const area = biome ? areasIn(biome)[(row.area ?? 1) - 1] : undefined;
    const equipped = await loadEquipped(userId);
    const power = loadoutPower(equipped);
    const style = (row.style ?? equipped.weapon?.spec.style ?? "melee") as Style;
    const rations = await rationCount(userId);

    const mods = await loadModifiers(userId, undefined, tonicEffectOf(row.tonicItemId));
    const combat = resolveCombat({
      focusedMs,
      roster: area?.roster ?? [],
      areaTier: area?.tier ?? row.tier,
      loadoutPower: power,
      style,
      twoHanded: equipped.weapon?.spec.archetype?.hands === 2,
      rations,
      ammo: await ammoCount(userId, style),
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
      const spec: ItemSpec = {
        slot: piece.slot as Slot,
        style: piece.style as Style,
        tier: piece.tier,
        quality: piece.quality,
        refine: 0,
      };
      const { lo, hi } = band(spec);
      await db.insert(equipmentInstances).values({
        userId,
        itemId: piece.itemId,
        slot: piece.slot,
        style: piece.style as Style,
        tier: piece.tier,
        quality: piece.quality,
        rolled: Math.round((lo + (hi - lo) * piece.percentile) * 1000),
        sessionId,
      });
      // An instance never passes through the ledger, so the collection log has
      // to be told separately — otherwise found equipment would never count
      // toward a collection achievement, which reads the log and not holdings.
      await logCollected(userId, piece.itemId, piece.percentile);
      kept += 1;
    }

    if (salvageStones.length > 0) await append(userId, salvageStones);
    await adjustWallet(userId, { coins: folded.coins + salvageCoins, fuel });
    summary.milestones.push(...(await addSkillXp(userId, style, Math.round(focusedMs / 60_000))));
    summary.milestones.push(...(await addSkillXp(userId, "slaying", Math.round(combat.kills / 4))));

    summary.kills = combat.kills;
    summary.failures = combat.failures;
    summary.legendaryKills = combat.spawns.filter(
      (s) => s.killed && s.rarity.key === "legendary",
    ).length;
    summary.coins = folded.coins + salvageCoins;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.equipmentKept = kept;
    summary.equipmentSalvaged = salvaged;
    summary.salvageStones = salvageStones.reduce((n, g) => n + g.delta, 0);
    summary.ranDry = combat.ranDry;
    summary.outOfAmmo = combat.outOfAmmo;
    summary.ammoUsed = combat.ammoUsed;
    summary.items = [...folded.items.values()].map((i) => ({ name: i.name, qty: i.qty }));

    await advanceContract(userId, combat.spawns.filter((s) => s.killed).map((s) => s.variant.name));
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

  await advancePlots(userId);
  await db
    .update(sessionActivities)
    .set({
      resolvedAt: new Date(),
      kills: summary.kills ?? 0,
      failures: summary.failures ?? 0,
      legendaryKills: summary.legendaryKills ?? 0,
      unitsGathered: summary.units ?? 0,
    })
    .where(eq(sessionActivities.sessionId, sessionId));

  return summary;
}

/** Which raw item a gathering skill produces at a tier. */
export function gatheredItemId(skill: string, t: number): string {
  const line: Record<string, string> = {
    woodcutting: "Log",
    fishing: "Catch",
    mining: "Ore",
    foraging: "Herb",
    hunting: "Hide",
    excavation: "Relic",
  };
  return `raw:${line[skill] ?? "Ore"}:${tierAt(t).tier}`;
}

/**
 * Farming advances one stage per COMPLETED SESSION, whatever the session was
 * doing. Never by elapsed time: the user's focus is the only clock here.
 */
async function advancePlots(userId: string): Promise<void> {
  await db
    .update(farmPlots)
    .set({ stagesLeft: sql`greatest(0, ${farmPlots.stagesLeft} - 1)` })
    .where(and(eq(farmPlots.userId, userId), sql`${farmPlots.stagesLeft} > 0`));
}

async function advanceContract(userId: string, killed: string[]): Promise<void> {
  if (killed.length === 0) return;
  const [contract] = await db
    .select()
    .from(slayingContracts)
    .where(and(eq(slayingContracts.userId, userId), isNull(slayingContracts.completedAt)))
    .limit(1);
  if (!contract) return;
  const hits = killed.filter((name) => name === contract.variantName).length;
  if (hits === 0) return;
  const now = contract.killed + hits;
  await db
    .update(slayingContracts)
    .set({
      killed: now,
      completedAt: now >= contract.required ? new Date() : null,
    })
    .where(eq(slayingContracts.id, contract.id));
  if (now >= contract.required) {
    await addSkillXp(userId, "slaying", processingXp(contract.tier) * 4);
  }
}
