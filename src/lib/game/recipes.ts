/**
 * Crafting, generated (SPEC-V2.md §4).
 *
 * Recipes are not written out either. Each processing skill declares what it
 * turns into what, and the recipe for any tier follows from the spine — so
 * adding a tier adds ~40 recipes and costs one line of config.
 *
 * Fuel is what pays for all of it, and that is the whole reason fuel exists:
 * every MEANINGFUL action is a session, and fuel covers the trivia that should
 * never cost twenty-five real minutes.
 */
import { processFuelCost } from "./economy";
import { GUN_ENTRY_TIER, MAX_TIER, TIERS, tier as tierAt } from "./tiers";
import { CRAFTED_QUALITY } from "./quality";
import { STYLES, type Style } from "./archetypes";
import { ARCHETYPES } from "./archetypes";
import { ARMOUR_SLOTS, SLOT_NOUN, materialFor } from "./items";
import { processingXp, tierSkillRequirement } from "./skills";

export type Ingredient = { itemId: string; qty: number };

export type Recipe = {
  id: string;
  skill: string;
  /** What comes out. */
  outputId: string;
  outputName: string;
  outputQty: number;
  tier: number;
  inputs: Ingredient[];
  fuel: number;
  /** Skill level needed, which is the tier's own gate. */
  level: number;
  xp: number;
};

const raw = (name: string, t: number) => `raw:${name}:${t}`;
const refined = (name: string, t: number) => `refined:${name}:${t}`;

/** Refining: two raws and some fuel become one refined good. */
const REFINING: { skill: string; from: string; to: string; qty: number; extra?: string }[] = [
  { skill: "firemaking", from: "Log", to: "Charcoal", qty: 2 },
  { skill: "smelting", from: "Ore", to: "Bar", qty: 2, extra: "Charcoal" },
  { skill: "fletching", from: "Log", to: "Plank", qty: 2 },
  { skill: "leatherworking", from: "Hide", to: "Leather", qty: 2 },
  { skill: "tailoring", from: "Fibre", to: "Cloth", qty: 2 },
  { skill: "smithing", from: "Bar", to: "Alloy", qty: 3 },
  { skill: "runecrafting", from: "Gem", to: "Essence", qty: 1 },
];

export function refiningRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const line of REFINING) {
    for (const t of TIERS) {
      const fromId = ["Bar"].includes(line.from) ? refined(line.from, t.tier) : raw(line.from, t.tier);
      const inputs: Ingredient[] = [{ itemId: fromId, qty: line.qty }];
      if (line.extra) inputs.push({ itemId: refined(line.extra, t.tier), qty: 1 });
      out.push({
        id: `recipe:${line.skill}:${line.to}:${t.tier}`,
        skill: line.skill,
        outputId: refined(line.to, t.tier),
        outputName: `${t.metal} ${line.to}`,
        outputQty: 1,
        tier: t.tier,
        inputs,
        fuel: processFuelCost(t.tier),
        level: tierSkillRequirement(t.tier),
        xp: processingXp(t.tier),
      });
    }
  }
  // Gunpowder needs sulphur, which is why firearms start at tier 6.
  for (const t of TIERS.filter((x) => x.tier >= GUN_ENTRY_TIER)) {
    out.push({
      id: `recipe:gunsmithing:Powder:${t.tier}`,
      skill: "gunsmithing",
      outputId: refined("Powder", t.tier),
      outputName: `${t.metal} Powder`,
      outputQty: 2,
      tier: t.tier,
      inputs: [
        { itemId: raw("Ore", t.tier), qty: 1 },
        { itemId: refined("Charcoal", t.tier), qty: 1 },
      ],
      fuel: processFuelCost(t.tier),
      level: tierSkillRequirement(t.tier),
      xp: processingXp(t.tier),
    });
  }
  return out;
}

/** Which refined good and which skill each style's armour is made from. */
const ARMOUR_SOURCE: Record<Style, { skill: string; from: string }> = {
  melee: { skill: "smithing", from: "Bar" },
  ranged: { skill: "leatherworking", from: "Leather" },
  magic: { skill: "tailoring", from: "Cloth" },
  gun: { skill: "gunsmithing", from: "Leather" },
};

/**
 * Crafted equipment always lands at Plain: quality above that is found, never
 * made. That keeps a found item worth something in a game where you can build
 * anything you have the materials for.
 */
export function equipmentRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const style of STYLES) {
    const source = ARMOUR_SOURCE[style];
    const from = style === "gun" ? GUN_ENTRY_TIER : 1;
    for (const t of TIERS.filter((x) => x.tier >= from)) {
      for (const slot of ARMOUR_SLOTS) {
        const noun = SLOT_NOUN[style][slot];
        const material = materialFor(style, t.tier);
        out.push({
          id: `recipe:${source.skill}:${style}:${slot}:${t.tier}`,
          skill: source.skill,
          outputId: `armour:${style}:${slot}:${t.tier}:${CRAFTED_QUALITY}`,
          outputName: style === "ranged" ? `${material} Hide ${noun}` : `${material} ${noun}`,
          outputQty: 1,
          tier: t.tier,
          inputs: [{ itemId: refined(source.from, t.tier), qty: 2 }],
          fuel: processFuelCost(t.tier) * 2,
          level: tierSkillRequirement(t.tier),
          xp: processingXp(t.tier) * 2,
        });
      }
      for (const arch of ARCHETYPES.filter((a) => a.style === style)) {
        out.push({
          id: `recipe:${source.skill}:${arch.name}:${t.tier}`,
          skill: source.skill,
          outputId: `weapon:${arch.name}:${t.tier}:${CRAFTED_QUALITY}`,
          outputName: `${materialFor(style, t.tier)} ${arch.name}`,
          outputQty: 1,
          tier: t.tier,
          inputs: [
            { itemId: refined(source.from, t.tier), qty: 3 },
            { itemId: refined("Plank", t.tier), qty: 1 },
          ],
          fuel: processFuelCost(t.tier) * 3,
          level: tierSkillRequirement(t.tier),
          xp: processingXp(t.tier) * 3,
        });
      }
    }
  }
  return out;
}

/** Rations, ammunition and potions: the upkeep the styles are priced around. */
export function upkeepRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const t of TIERS) {
    out.push({
      id: `recipe:cooking:ration:${t.tier}`,
      skill: "cooking",
      outputId: `ration:${t.tier}`,
      outputName: `${t.metal} Ration`,
      outputQty: 4,
      tier: t.tier,
      inputs: [{ itemId: raw("Catch", t.tier), qty: 2 }],
      fuel: processFuelCost(t.tier),
      level: tierSkillRequirement(t.tier),
      xp: processingXp(t.tier),
    });
  }
  const AMMO: { name: string; skill: string; style: Style; from: string; qty: number }[] = [
    { name: "Arrow", skill: "fletching", style: "ranged", from: "Plank", qty: 20 },
    { name: "Bolt", skill: "fletching", style: "ranged", from: "Bar", qty: 20 },
    { name: "Dart", skill: "fletching", style: "ranged", from: "Bar", qty: 20 },
    { name: "Rune", skill: "runecrafting", style: "magic", from: "Essence", qty: 10 },
    { name: "Cartridge", skill: "gunsmithing", style: "gun", from: "Powder", qty: 8 },
    { name: "Shell", skill: "gunsmithing", style: "gun", from: "Powder", qty: 6 },
  ];
  for (const line of AMMO) {
    const from = line.style === "gun" ? GUN_ENTRY_TIER : 1;
    for (const t of TIERS.filter((x) => x.tier >= from)) {
      out.push({
        id: `recipe:${line.skill}:${line.name}:${t.tier}`,
        skill: line.skill,
        outputId: `ammo:${line.name}:${t.tier}`,
        outputName: `${t.metal} ${line.name}`,
        outputQty: line.qty,
        tier: t.tier,
        inputs: [{ itemId: refined(line.from, t.tier), qty: 1 }],
        fuel: processFuelCost(t.tier),
        level: tierSkillRequirement(t.tier),
        xp: processingXp(t.tier),
      });
    }
  }
  return out;
}

/** Every recipe in the game. */
export function allRecipes(): Recipe[] {
  return [...refiningRecipes(), ...equipmentRecipes(), ...upkeepRecipes()];
}

export type CraftCheck =
  | { ok: true; recipe: Recipe }
  | { ok: false; missing: string[] };

/**
 * Whether a craft can go ahead. Same shape as the requirement gate: binary, and
 * it names everything that is short rather than just refusing.
 */
export function canCraft(
  recipe: Recipe,
  have: (itemId: string) => number,
  fuel: number,
  level: number,
  nameOf: (itemId: string) => string = (id) => id,
): CraftCheck {
  const missing: string[] = [];
  if (level < recipe.level) missing.push(`${recipe.skill} ${recipe.level}`);
  if (fuel < recipe.fuel) missing.push(`${recipe.fuel} fuel (you have ${fuel})`);
  for (const input of recipe.inputs) {
    const held = have(input.itemId);
    if (held < input.qty) missing.push(`${input.qty - held} more ${nameOf(input.itemId)}`);
  }
  return missing.length === 0 ? { ok: true, recipe } : { ok: false, missing };
}

export const MAX_RECIPE_TIER = MAX_TIER;
export const TIER_LABEL = (t: number) => tierAt(t).metal;
