/**
 * What to do next.
 *
 * Every other module here answers a question somebody has to know to ask: what
 * a gate wants, what a recipe takes, where a contract's target lives. Nothing
 * asked them on the player's behalf, so the game's front page was an inventory
 * of what a character had — and a character twenty-two levels in could be
 * standing there with no weapon, five empty slots, no contract and four bare
 * plots, on a page that reported all of it accurately and suggested nothing.
 *
 * This is the same rule as the requirement gate, turned around. A gate names
 * what is missing so a refusal reads as a shopping list; this names the next
 * thing worth doing so a status page reads as a route. It invents no numbers:
 * every step is a gate, a recipe or a contract that already exists, quoted.
 *
 * Pure, like everything under `game/` — the state comes in as plain values, so
 * the test can stand a fresh account in front of it and read what it says.
 */
import { ARCHETYPES, answerTo, type Style } from "./archetypes";
import { BIOMES, BIOME_BY_INDEX } from "./biomes";
import { BOSSES, bossMarker } from "./bosses";
import { MIN_SUCCESS } from "./combat";
import { contractAreas } from "./contracts";
import { FUEL_BY_LENGTH } from "./economy";
import { checkGate, type GateState } from "./gate";
import { gatheredItemId, itemName } from "./items";
import { emptySlots, gateTier, SLOTS, type Equipped, type Slot } from "./power";
import { equipmentRecipes, jewelleryRecipes, type Recipe } from "./recipes";
import { requirementFor } from "./requirements";
import {
  MAX_SKILL_LEVEL,
  SKILLS,
  SKILL_XP,
  nextSkillUnlock,
  nextTierUnlock,
  skillLevel,
  skillUnlock,
} from "./skills";
import { areasIn } from "./variants";

export type GuideState = {
  gate: GateState;
  equipped: Equipped;
  /** Pieces owned and not worn, which beat any recipe: they are already made. */
  spare: { slot: string; tier: number; name: string }[];
  held: (itemId: string) => number;
  /** Running XP per skill, so a step can say how far off a level is. */
  skillXp: Record<string, number>;
  fuel: number;
  fuelCap: number;
  plots: { seedItemId: string | null; stagesLeft: number }[];
  /** Seeds on hand, of any line. */
  seeds: number;
  contract: { variantName: string; biome: number; killed: number; required: number } | null;
  /** `world_progress` markers: bosses down, keys held. */
  markers: ReadonlySet<string>;
};

export type Step = {
  key: string;
  /** The mark it wears — a skill's, or a screen's. */
  mark: string;
  /** Which of the three skill kinds it belongs to, for the mark's hue. */
  kind: "gathering" | "combat" | "processing";
  title: string;
  detail: string;
  href: string;
  /** What the link is called: the screen it opens. */
  go: string;
  progress?: { have: number; need: number };
};

/** The floor every fight has, said the way a player would: "one fight in twenty lands". */
const UNARMED = `one fight in ${Math.round(1 / MIN_SUCCESS)} lands`;

const LABEL = new Map(SKILLS.map((s) => [s.key, s.label]));
const label = (key: string) => LABEL.get(key) ?? key;

const GEAR_RECIPES: Recipe[] = [...equipmentRecipes(), ...jewelleryRecipes()];

/** The recipe that makes a given slot, in a style, at a tier. */
function recipeFor(slot: Slot, style: Style, t: number): Recipe | null {
  if (slot === "weapon") {
    // The first one-handed archetype: it keeps the offhand, so the first weapon
    // made is never the reason a second slot stays empty.
    const arch = ARCHETYPES.find((a) => a.style === style && a.hands === 1);
    return GEAR_RECIPES.find((r) => r.outputId === `weapon:${arch?.name}:${t}:plain`) ?? null;
  }
  return GEAR_RECIPES.find((r) => r.outputId === `armour:${style}:${slot}:${t}:plain`) ?? null;
}

/** "3 Copper Bar and 1 Pine Charcoal — you hold 1 and 0". */
function shoppingList(recipe: Recipe, held: (id: string) => number): string {
  const wants = recipe.inputs.map((i) => `${i.qty} ${itemName(i.itemId)}`).join(" and ");
  const short = recipe.inputs.some((i) => held(i.itemId) < i.qty);
  if (!short) return `${wants}, and you hold all of it`;
  return `${wants} — you hold ${recipe.inputs.map((i) => held(i.itemId)).join(" and ")}`;
}

function inputProgress(recipe: Recipe, held: (id: string) => number) {
  return {
    have: recipe.inputs.reduce((n, i) => n + Math.min(i.qty, held(i.itemId)), 0),
    need: recipe.inputs.reduce((n, i) => n + i.qty, 0),
  };
}

/** The style to build toward: what is already worn, or melee, which opens first. */
function styleOf(state: GuideState): Style {
  const worn = Object.values(state.equipped).map((e) => e?.spec.style);
  const counts = new Map<Style, number>();
  for (const s of worn) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return state.equipped.weapon?.spec.style ?? best ?? "melee";
}

/** The deepest tier of this slot's recipe the character's skill will run. */
function reachable(slot: Slot, style: Style, wanted: number, state: GuideState): Recipe | null {
  for (let t = Math.max(1, wanted); t >= 1; t--) {
    const recipe = recipeFor(slot, style, t);
    if (!recipe) continue;
    if (skillUnlock(recipe.skill) > state.gate.characterLevel) continue;
    if ((state.gate.skills[recipe.skill] ?? 1) >= recipe.level) return recipe;
  }
  return null;
}

function craftHref(recipe: Recipe): string {
  return `/game/crafting?q=${encodeURIComponent(recipe.outputName)}`;
}

/* --------------------------------- the steps ------------------------------- */

function gearStep(state: GuideState): Step | null {
  const style = styleOf(state);
  const tiers = SLOTS.map((s) => state.equipped[s]?.spec.tier ?? 0).filter((t) => t > 0);
  const deepest = tiers.length > 0 ? Math.max(...tiers) : 1;
  const empty = emptySlots(state.equipped);

  if (!state.equipped.weapon) {
    const owned = state.spare.find((p) => p.slot === "weapon");
    if (owned) {
      return {
        key: "weapon",
        mark: "equipment",
        kind: "combat",
        title: `Equip your ${owned.name}`,
        detail: `It is sitting in the bank. With no weapon your offence is zero, and ${UNARMED}.`,
        href: "/game/equipment",
        go: "Equipment",
      };
    }
    const recipe = reachable("weapon", style, deepest, state) ?? reachable("weapon", "melee", deepest, state);
    return {
      key: "weapon",
      mark: recipe?.skill ?? "smithing",
      kind: "processing",
      title: "Make a weapon",
      detail: recipe
        ? `${recipe.outputName} takes ${shoppingList(recipe, state.held)}. With no weapon your offence is zero, and ${UNARMED}.`
        : `With no weapon your offence is zero, and ${UNARMED}. Smithing makes the first one.`,
      href: recipe ? craftHref(recipe) : "/game/crafting",
      go: "Crafting",
      progress: recipe ? inputProgress(recipe, state.held) : undefined,
    };
  }

  if (empty.length > 0) {
    const owned = state.spare.find((p) => empty.includes(p.slot as Slot));
    const first = empty[0];
    const recipe = reachable(first, style, deepest, state) ?? reachable(first, "melee", deepest, state);
    const why = "The gate reads your shallowest slot, and an empty one is tier zero — so nothing past tier 2 opens until all ten are filled.";
    return {
      key: "slots",
      mark: "equipment",
      kind: "combat",
      title: `Fill ${empty.length === 1 ? `your ${first} slot` : `${empty.length} empty slots`}`,
      detail: owned
        ? `You already own a ${owned.name} for the ${owned.slot}. ${why}`
        : `${empty.join(", ")}. ${why}${recipe ? ` Start with ${recipe.outputName}: ${shoppingList(recipe, state.held)}.` : ""}`,
      href: owned ? "/game/equipment" : recipe ? craftHref(recipe) : "/game/crafting",
      go: owned ? "Equipment" : "Crafting",
      progress: { have: SLOTS.length - empty.length, need: SLOTS.length },
    };
  }

  const floor = gateTier(state.equipped);
  if (floor < deepest) {
    const low = SLOTS.filter((s) => (state.equipped[s]?.spec.tier ?? deepest) === floor);
    return {
      key: "floor",
      mark: "equipment",
      kind: "combat",
      title: `Raise your ${low.join(", ")}`,
      detail: `Tier ${floor}, against tier ${deepest} elsewhere. The gate reads the shallowest, so this is the piece standing between you and tier ${floor + 2} areas.`,
      href: "/game/crafting",
      go: "Crafting",
    };
  }
  return null;
}

function rationStep(state: GuideState): Step | null {
  if (state.gate.rations > 0) return null;
  return {
    key: "rations",
    mark: "cooking",
    kind: "processing",
    title: "Stock up on rations",
    detail: "You hold none, and every fight asks for at least one at the gate. Cooking turns a catch or meat into them, and the shop sells them.",
    href: "/game/crafting?q=ration",
    go: "Crafting",
  };
}

function farmStep(state: GuideState): Step | null {
  const ready = state.plots.filter((p) => p.seedItemId !== null && p.stagesLeft === 0).length;
  if (ready > 0) {
    return {
      key: "harvest",
      mark: "farm",
      kind: "gathering",
      title: `Harvest ${ready} ${ready === 1 ? "plot" : "plots"}`,
      detail: "Grown and waiting. A full plot cannot start its next crop.",
      href: "/game/farm",
      go: "Farm",
    };
  }
  const bare = state.plots.filter((p) => p.seedItemId === null).length;
  if (bare > 0 && state.seeds > 0) {
    return {
      key: "sow",
      mark: "farm",
      kind: "gathering",
      title: `Sow ${bare === 1 ? "your empty plot" : `${bare} empty plots`}`,
      detail: "You are holding seed. A plot grows one stage for every session you finish, whatever that session was, so a bare plot is a session's growth thrown away.",
      href: "/game/farm",
      go: "Farm",
    };
  }
  return null;
}

function contractStep(state: GuideState): Step {
  if (!state.contract) {
    return {
      key: "contract",
      mark: "slaying",
      kind: "combat",
      title: "Take a contract",
      detail: "One target and no deadline. Finishing it pays coins and upgrade stones, and the first one finished in each biome gives up that biome's trinket.",
      href: "/game/slaying",
      go: "Slaying",
    };
  }
  const c = state.contract;
  const biome = BIOME_BY_INDEX.get(c.biome);
  const areas = contractAreas(c.variantName, c.biome);
  const where =
    areas.length === 0
      ? (biome?.name ?? "")
      : areas.length === 1
        ? `${biome?.name} ${areas[0]}`
        : `${biome?.name} ${areas[0]}–${areas[areas.length - 1]}`;
  return {
    key: "contract",
    mark: "slaying",
    kind: "combat",
    title: `Hunt ${c.variantName}`,
    detail: `Found in ${where}. ${c.required - c.killed} to go.`,
    href: `/game/areas?b=${c.biome}`,
    go: "Areas",
    progress: { have: c.killed, need: c.required },
  };
}

function fuelStep(state: GuideState): Step | null {
  const most = Math.max(...Object.values(FUEL_BY_LENGTH));
  if (state.fuelCap - state.fuel >= most) return null;
  return {
    key: "fuel",
    mark: "firemaking",
    kind: "processing",
    title: "Spend some fuel",
    detail: `${state.fuel} of ${state.fuelCap}. A session pays up to ${most}, and anything over the cap is lost.`,
    href: "/game/crafting",
    go: "Crafting",
    progress: { have: state.fuel, need: state.fuelCap },
  };
}

function bossStep(state: GuideState): Step | null {
  const boss = BOSSES.find((b) => !state.markers.has(bossMarker(b)));
  if (!boss) return null;
  const biome = BIOME_BY_INDEX.get(boss.biome);
  const gate = checkGate(
    requirementFor({ kind: "boss", biome: boss.biome, role: boss.role }),
    state.gate,
    label,
  );
  const prize = boss.signature ? ` Its first kill always gives up ${boss.signature.name}.` : "";
  return {
    key: "boss",
    mark: "areas",
    kind: "combat",
    title: gate.open ? `${boss.name} is within reach` : `Next boss: ${boss.name}`,
    detail: gate.open
      ? `${biome?.name}, weak to ${answerTo(boss.style)}. Give it a fifty.${prize}`
      : `${biome?.name}. Wants ${gate.missing.join(", ")}.${prize}`,
    href: `/game/areas?b=${boss.biome}`,
    go: "Areas",
  };
}

function areaStep(state: GuideState): Step | null {
  for (const biome of BIOMES) {
    for (const area of areasIn(biome)) {
      const gate = checkGate(
        requirementFor({ kind: "combat", biome: biome.index, area: area.index }),
        state.gate,
        label,
      );
      if (gate.open) continue;
      return {
        key: "area",
        mark: "areas",
        kind: "combat",
        title: `Open ${area.name}`,
        detail: `Tier ${area.tier}. Wants ${gate.missing.join(", ")}.`,
        href: `/game/areas?b=${biome.index}`,
        go: "Areas",
      };
    }
  }
  return null;
}

/** The gathering skill closest to opening its next material. */
function skillStep(state: GuideState): Step | null {
  let best: { step: Step; gap: number } | null = null;
  for (const skill of SKILLS.filter((s) => s.kind === "gathering")) {
    if (skill.unlock > state.gate.characterLevel) continue;
    const xp = state.skillXp[skill.key] ?? 0;
    if (xp <= 0) continue;
    const level = skillLevel(xp);
    if (level >= MAX_SKILL_LEVEL) continue;
    const opens = nextTierUnlock(level);
    if (!opens) continue;
    const { tier: next, level: need } = opens;
    const target = SKILL_XP[need - 1];
    const gap = target - xp;
    if (best && best.gap <= gap) continue;
    best = {
      gap,
      step: {
        key: "skill",
        mark: skill.key,
        kind: "gathering",
        // The thing itself, by name: "Crucible Steel" is the tier's metal, and a
        // woodcutter is not waiting on a metal.
        title: `${skill.label} ${need} opens ${itemName(gatheredItemId(skill.key, next))}`,
        detail: `You are level ${level}, and ${gap} XP short. It is the tier ${next} material.`,
        href: "/game/skills",
        go: "Skills",
        progress: { have: xp, need: target },
      },
    };
  }
  return best?.step ?? null;
}

function unlockStep(state: GuideState): Step | null {
  const next = nextSkillUnlock(state.gate.characterLevel);
  if (!next) return null;
  return {
    key: "unlock",
    mark: next.key,
    kind: next.kind,
    title: `${next.label} opens at level ${next.unlock}`,
    detail: `You are level ${state.gate.characterLevel}. Focused minutes are the only thing that gets you there.`,
    href: "/game/skills",
    go: "Skills",
  };
}

/**
 * The route, most pressing first.
 *
 * The order is the argument. Gear leads because an unarmed character loses
 * nineteen fights in twenty and nothing else on the list matters until that is
 * fixed; a waiting harvest and a full fuel tank come next because both are
 * value being thrown away by the next session; and the long roads — a boss, a
 * closed area, a skill — come last, because they are where the hours go.
 */
export function nextSteps(state: GuideState): Step[] {
  return [
    gearStep(state),
    rationStep(state),
    farmStep(state),
    fuelStep(state),
    contractStep(state),
    bossStep(state),
    areaStep(state),
    skillStep(state),
    unlockStep(state),
  ].filter((s): s is Step => s !== null);
}
