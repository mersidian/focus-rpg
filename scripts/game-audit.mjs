/**
 * A balance audit, run by hand rather than in CI.
 *
 * It answers the questions a spec cannot: does the catalogue actually come out
 * the size the budget claims, are the ids unique, and does the arc land — is a
 * same-tier set really at parity with a Common spawn, does over-tier farming
 * stay a bad idea, and does tier 24 sit where Mythic V sits.
 */
import { generateCatalogue, catalogueBreakdown } from "../src/lib/game/items.ts";
import { TIERS, tier } from "../src/lib/game/tiers.ts";
import { ARCHETYPES, STYLES } from "../src/lib/game/archetypes.ts";
import { SLOTS, SLOT_BASE, affinity, band, refineMultiplier, loadoutPower } from "../src/lib/game/power.ts";
import { QUALITIES } from "../src/lib/game/quality.ts";
import { RARITIES, spawnPower, successChance, wheelFactor, resolveCombat, rationsPerFailure, SPAWN_BASE } from "../src/lib/game/combat.ts";
import { allVariants, allAreas, areasIn } from "../src/lib/game/variants.ts";
import { BIOMES } from "../src/lib/game/biomes.ts";
import { SKILL_XP, skillLevel, tierSkillRequirement } from "../src/lib/game/skills.ts";
import { refineTotal, bankSlotsTotalCost, tierValue } from "../src/lib/game/economy.ts";
import { rng } from "../src/lib/game/rng.ts";
import { resolveYield } from "../src/lib/game/yield.ts";

const line = (s) => console.log(s);

line("=== CATALOGUE ===");
const cat = generateCatalogue();
line(`total generated: ${cat.length}`);
const bd = catalogueBreakdown();
for (const [k, v] of Object.entries(bd).sort((a, b) => b[1] - a[1])) line(`  ${k.padEnd(16)} ${v}`);
const ids = new Set(cat.map((i) => i.id));
line(`unique ids: ${ids.size} (${ids.size === cat.length ? "ok" : "COLLISIONS"})`);
const names = new Map();
for (const i of cat) names.set(i.name, (names.get(i.name) ?? 0) + 1);
const dupNames = [...names.entries()].filter(([, n]) => n > 1);
line(`duplicate names: ${dupNames.length}${dupNames.length ? " e.g. " + dupNames.slice(0, 5).map((d) => d[0]).join(", ") : ""}`);

line("\n=== WORLD ===");
const variants = allVariants();
const areas = allAreas();
line(`biomes ${BIOMES.length} | areas ${areas.length} | monster variants ${variants.length}`);
const emptyAreas = areas.filter((a) => a.roster.length === 0);
line(`empty areas: ${emptyAreas.length}`);
const wheelBad = [];
for (const b of BIOMES) {
  const styles = new Set(areasIn(b).flatMap((a) => a.roster.map((v) => v.style)));
  if (styles.size < 4) wheelBad.push(`${b.index} ${b.name} [${[...styles].join(",")}]`);
}
line(`biomes where fewer than 4 styles are the right answer: ${wheelBad.length ? wheelBad.join(" | ") : "none"}`);

line("\n=== A FULL PLAIN SET AT PARITY ===");
function fullSet(style, t, quality = "plain", refine = 0) {
  const arch = ARCHETYPES.find((a) => a.style === style);
  const equipped = {};
  for (const slot of SLOTS) {
    if (slot === "offhand" && arch.hands === 2) continue;
    const spec = { slot, style, tier: t, quality, refine, archetype: slot === "weapon" ? arch : undefined };
    equipped[slot] = { spec, rolled: band(spec).centre };
  }
  return loadoutPower(equipped);
}
for (const t of [1, 6, 12, 18, 24]) {
  const common = spawnPower(t, RARITIES[0]);
  const row = STYLES.filter((s) => s !== "gun" || t >= 6).map((s) => {
    const lp = fullSet(s, t);
    return `${s} ${lp.offence.toFixed(0)}/${lp.defence.toFixed(0)}`;
  });
  line(`tier ${String(t).padStart(2)}: common spawn ${common.toFixed(0)} | ${row.join("  ")}`);
}

line("\n=== CONVERSION: same-tier melee set vs each rarity ===");
for (const t of [6, 12, 24]) {
  const p = fullSet("melee", t);
  const cells = RARITIES.map((r) => {
    const sp = spawnPower(t, r);
    return `${r.key} ${(successChance(p.offence, sp) * 100).toFixed(0)}%`;
  });
  line(`tier ${t} (off ${p.offence.toFixed(0)}): ${cells.join("  ")}`);
}

line("\n=== THE WHEEL IS WORTH BRINGING ===");
{
  const t = 12;
  const p = fullSet("melee", t);
  const sp = spawnPower(t, RARITIES[3]);
  for (const [label, f] of [["advantage", wheelFactor("melee", "ranged")], ["neutral", 1], ["disadvantage", wheelFactor("melee", "gun")]]) {
    line(`  tier 12 Rare, ${label.padEnd(13)} x${f.toFixed(2)} -> ${(successChance(p.offence * f, sp) * 100).toFixed(0)}%`);
  }
}

line("\n=== OVER-TIER FARMING SHOULD BE A BAD IDEA ===");
{
  const p = fullSet("melee", 12);
  for (const t of [12, 14, 16, 18]) {
    const sp = spawnPower(t, RARITIES[0]);
    line(`  tier 12 gear vs tier ${t} common: ${(successChance(p.offence, sp) * 100).toFixed(0)}%`);
  }
}

line("\n=== UPKEEP BY STYLE: rations per failure, tier 12 ===");
{
  const sp = spawnPower(12, RARITIES[0]);
  for (const st of STYLES) {
    const lp = fullSet(st, 12);
    line(`  ${st.padEnd(7)} off ${lp.offence.toFixed(0)} def ${lp.defence.toFixed(0)} -> ${rationsPerFailure(sp, lp.defence)} ration(s)/failure, ${(successChance(lp.offence, sp) * 100).toFixed(0)}% on a common`);
  }
}

line("\n=== A SESSION ===");
for (const [len, t] of [[25, 6], [25, 12], [50, 12], [25, 24]]) {
  const area = areasIn(BIOMES.find((b) => b.tierLo <= t && b.tierHi >= t) ?? BIOMES[0])[4];
  const p = fullSet("melee", t);
  const r = resolveCombat({
    focusedMs: len * 60_000, roster: area.roster, areaTier: area.tier,
    loadoutPower: p, style: "melee", twoHanded: false, rations: 40, rng: rng(`audit:${len}:${t}`),
  });
  line(`  ${len}min in ${area.name} (t${area.tier}), tier ${t} gear: ${r.kills} kills, ${r.failures} failures, loot ${r.lootWeight.toFixed(0)}, rations ${r.rationsUsed}`);
}

line("\n=== GATHERING ===");
for (const [len, t] of [[25, 1], [25, 12], [50, 12], [25, 24]]) {
  const y = resolveYield({ focusedMs: len * 60_000, tier: t, toolTier: t, skillLevel: tierSkillRequirement(t), chainMultiplier: 1, rng: rng(`y:${len}:${t}`) });
  line(`  ${len}min at tier ${t}: ${y.units} units worth ${y.coinValue} coins (x${y.multiplier.toFixed(2)})`);
}

line("\n=== CURVES ===");
line(`skill 99 costs ${SKILL_XP[98]} xp = ${(SKILL_XP[98] / 60).toFixed(0)} focused hours on that skill`);
line(`skill 50 costs ${SKILL_XP[49]} xp = ${(SKILL_XP[49] / 60).toFixed(0)} h`);
line(`tier gates: ${[1, 6, 12, 18, 24].map((t) => `t${t}->skill ${tierSkillRequirement(t)}`).join(", ")}`);
line(`tier hours : ${[1, 6, 12, 18, 24].map((t) => `t${t}@${tier(t).gateHours}h`).join(", ")}`);
line(`refine +10 at t6 ${JSON.stringify(refineTotal(6))}, t12 ${JSON.stringify(refineTotal(12))}, t24 ${JSON.stringify(refineTotal(24))}`);
line(`bank 60 -> 1500 slots costs ${bankSlotsTotalCost().toLocaleString()} coins`);
line(`tier value: ${[1, 12, 24].map((t) => `t${t}=${tierValue(t)}`).join(", ")}`);
