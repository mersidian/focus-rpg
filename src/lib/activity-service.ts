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
import { append, adjustWallet, loadWallet, type Grant } from "./inventory-service";
import { loadState } from "./game-state";
import { ARCHETYPE_BY_NAME, type Style } from "./game/archetypes";
import { BIOME_BY_INDEX } from "./game/biomes";
import { resolveCombat, RARITIES, rationsPerFailure, spawnPower } from "./game/combat";
import { foldDrops, rollDrops, salvageDecision, salvageValue } from "./game/drops";
import { FUEL_BY_LENGTH } from "./game/economy";
import { checkGate, type GateState, type Requirement } from "./game/gate";
import { band, loadoutPower, type Equipped, type ItemSpec, type Slot } from "./game/power";
import { rng, sessionSeed } from "./game/rng";
import { SKILLS, processingXp, skillLevel, tierSkillRequirement } from "./game/skills";
import { tier as tierAt } from "./game/tiers";
import { areasIn } from "./game/variants";
import { BOSS_POWER_MULTIPLIER, bossKillSeconds, bossMarker, bossesIn } from "./game/bosses";
import { resolveBoss } from "./game/combat";
import { uniqueItemId } from "./game/uniques";
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

  if (activity.kind === "boss") {
    const boss = bossesIn(activity.biome).find((b) => b.role === activity.role);
    const t = boss?.tier ?? 1;
    // A boss wants a full set AT its tier, not one below: it is the wall that
    // says come back better, and it should read that way in the gate.
    return {
      equipmentTier: t,
      rations: Math.max(2, Math.round(t / 3)),
      keyItem: biome?.keyItem ?? undefined,
      characterLevel: Math.max(1, Math.round(t * 1.8)),
    };
  }

  const area = biome ? areasIn(biome)[activity.area - 1] : undefined;
  const t = area?.tier ?? 1;
  return {
    equipmentTier: Math.max(1, t - 1),
    rations: Math.max(1, Math.round(t / 4)),
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

async function addSkillXp(userId: string, skill: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  await db
    .insert(skillStates)
    .values({ userId, skill, xp })
    .onConflictDoUpdate({
      target: [skillStates.userId, skillStates.skill],
      set: { xp: sql`${skillStates.xp} + ${xp}` },
    });
}

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
  const chain = chainMultiplier(links);

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
      grants.push({
        itemId: uniqueItemId(boss.signature),
        delta: 1,
        reason: "combat_drop",
        sessionId,
        percentile: 1,
      });
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
    await addSkillXp(userId, style, Math.round(focusedMs / 60_000));
    summary.kills = result.killed ? 1 : 0;
    summary.failures = result.killed ? 0 : 1;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.items = result.firstKill && boss?.signature ? [{ name: boss.signature.name, qty: 1 }] : [];
  } else if (row.kind === "gathering") {
    const skills = await loadSkills(userId);
    const gate = await loadGateState(userId);
    const result = resolveYield({
      focusedMs,
      tier: row.tier,
      toolTier: gate.toolTier[row.skill] ?? row.tier,
      skillLevel: skills[row.skill] ?? 1,
      chainMultiplier: chain,
      rng: rng(sessionSeed(sessionId, "yield")),
    });
    const itemId = gatheredItemId(row.skill, row.tier);
    await append(userId, [
      { itemId, delta: result.units, reason: "session_yield", sessionId },
    ]);
    await addSkillXp(userId, row.skill, result.skillXp);
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

    const combat = resolveCombat({
      focusedMs,
      roster: area?.roster ?? [],
      areaTier: area?.tier ?? row.tier,
      loadoutPower: power,
      style,
      twoHanded: equipped.weapon?.spec.archetype?.hands === 2,
      rations,
      rng: rng(sessionSeed(sessionId, "combat")),
    });

    const lootRng = rng(sessionSeed(sessionId, "loot"));
    const drops = combat.spawns
      .filter((s) => s.killed)
      .flatMap((s) => rollDrops({ variant: s.variant, rarity: s.rarity, style, rng: lootRng }));
    const folded = foldDrops(drops);

    const wallet = await loadWallet(userId);
    const grants: Grant[] = [...folded.items.entries()].map(([itemId, item]) => ({
      itemId,
      delta: item.qty,
      reason: "combat_drop",
      sessionId,
    }));

    // Rations are spent, and never more than were carried.
    if (combat.rationsUsed > 0) {
      grants.push({
        itemId: `ration:${row.tier}`,
        delta: -combat.rationsUsed,
        reason: "consumed",
        sessionId,
      });
    }
    await append(userId, grants);

    // Found gear meets the auto-salvage rules before it reaches the bank, which
    // is what stops a limited bank becoming an inventory minigame.
    let kept = 0;
    let salvaged = 0;
    let salvageCoins = 0;
    for (const piece of folded.equipment) {
      const decision = salvageDecision(piece.percentile, {
        salvageBelow: wallet.salvageBelow,
        keepAbove: wallet.keepAbove,
      });
      if (decision === "salvage") {
        salvaged += 1;
        salvageCoins += salvageValue(piece.tier, piece.percentile);
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
      kept += 1;
    }

    await adjustWallet(userId, { coins: folded.coins + salvageCoins, fuel });
    await addSkillXp(userId, style, Math.round(focusedMs / 60_000));
    await addSkillXp(userId, "slaying", Math.round(combat.kills / 4));

    summary.kills = combat.kills;
    summary.failures = combat.failures;
    summary.legendaryKills = combat.spawns.filter(
      (s) => s.killed && s.rarity.key === "legendary",
    ).length;
    summary.coins = folded.coins + salvageCoins;
    summary.skillXp = Math.round(focusedMs / 60_000);
    summary.equipmentKept = kept;
    summary.equipmentSalvaged = salvaged;
    summary.ranDry = combat.ranDry;
    summary.items = [...folded.items.values()].map((i) => ({ name: i.name, qty: i.qty }));

    await advanceContract(userId, combat.spawns.filter((s) => s.killed).map((s) => s.variant.name));
  }

  if (row.kind === "gathering") await adjustWallet(userId, { fuel });
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
