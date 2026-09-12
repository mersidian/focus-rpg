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
import {
  ARMOUR_SLOTS,
  POTION_EFFECTS,
  POTION_ROMAN,
  AMMO_LINES,
  POTION_TIERS,
  REFINED_BY_NAME,
  STONE_KINDS,
  TOOL_SKILLS,
  toolName,
  ammoName,
  armourName,
  lineName,
  materialFor,
  rationName,
} from "./items";
import type { Slot } from "./power";
import { processingXp, skillUnlock, tierSkillRequirement } from "./skills";

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
        outputName: lineName(REFINED_BY_NAME.get(line.to)!, t.tier),
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
/** The two slots a jeweller makes, in every style. */
export const JEWELLERY_SLOTS: Slot[] = ["amulet", "ring"];

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
      // Rings and amulets are the jeweller's, not the smith's — see
      // `jewelleryRecipes`. The ITEMS are unchanged; only who makes them moved.
      for (const slot of ARMOUR_SLOTS.filter((sl) => !JEWELLERY_SLOTS.includes(sl))) {
        out.push({
          id: `recipe:${source.skill}:${style}:${slot}:${t.tier}`,
          skill: source.skill,
          outputId: `armour:${style}:${slot}:${t.tier}:${CRAFTED_QUALITY}`,
          outputName: armourName(style, t.tier, slot),
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
  /*
   * Two ways to feed yourself, which is what "fish and meat to rations" said
   * from the start while only fish existed. They make the same ration — the
   * table tells them apart by what they need, which is the choice.
   *
   * Meat pays better per unit and there is far less of it: fishing is a whole
   * skill pointed at food, and meat is a quarter-rate byproduct of hunting. So
   * a hunter eats without fishing, and a fisher still feeds an army.
   */
  const FOOD: { from: string; qty: number; makes: number }[] = [
    { from: "Catch", qty: 2, makes: 4 },
    { from: "Meat", qty: 2, makes: 6 },
  ];
  for (const food of FOOD) {
    for (const t of TIERS) {
      out.push({
        id: `recipe:cooking:${food.from}:${t.tier}`,
        skill: "cooking",
        outputId: `ration:${t.tier}`,
        outputName: rationName(t.tier),
        outputQty: food.makes,
        tier: t.tier,
        inputs: [{ itemId: raw(food.from, t.tier), qty: food.qty }],
        fuel: processFuelCost(t.tier),
        level: tierSkillRequirement(t.tier),
        xp: processingXp(t.tier),
      });
    }
  }
  // One table, in `items`, so the catalogue and the recipe cannot disagree
  // about what an arrow is made of — which is exactly how they disagreed about
  // what to call one.
  for (const line of AMMO_LINES) {
    const from = line.style === "gun" ? GUN_ENTRY_TIER : 1;
    for (const t of TIERS.filter((x) => x.tier >= from)) {
      out.push({
        id: `recipe:${line.skill}:${line.name}:${t.tier}`,
        skill: line.skill,
        outputId: `ammo:${line.name}:${t.tier}`,
        outputName: ammoName(line.from, line.name, t.tier),
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

/**
 * Gems to rings and amulets, which is what Jewelcrafting always said it did.
 *
 * The skill shipped with a note, a fuel cost, a level curve and zero recipes,
 * while `equipmentRecipes` quietly made every ring and amulet out of bars and
 * cloth along with the rest of the armour. So this is not new content so much
 * as a job handed to the skill whose name is on it.
 *
 * The output ids, names, tiers and quality are untouched — a requirement gate
 * asks for a tier and never for a maker, so nothing about what a set counts for
 * changes. What changes is the input: a jeweller needs a gem, which gives
 * mining's byproduct a second customer beside runecrafting.
 */
export function jewelleryRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const style of STYLES) {
    const source = ARMOUR_SOURCE[style];
    const from = style === "gun" ? GUN_ENTRY_TIER : 1;
    for (const t of TIERS.filter((x) => x.tier >= from)) {
      for (const slot of JEWELLERY_SLOTS) {
        out.push({
          id: `recipe:jewelcrafting:${style}:${slot}:${t.tier}`,
          skill: "jewelcrafting",
          outputId: `armour:${style}:${slot}:${t.tier}:${CRAFTED_QUALITY}`,
          outputName: armourName(style, t.tier, slot),
          outputQty: 1,
          tier: t.tier,
          // A gem and a little of the style's own material, so a mage's talisman
          // still reads as cloth and a gunslinger's seal as leather.
          inputs: [
            { itemId: raw("Gem", t.tier), qty: 1 },
            { itemId: refined(source.from, t.tier), qty: 1 },
          ],
          fuel: processFuelCost(t.tier) * 2,
          level: tierSkillRequirement(t.tier),
          xp: processingXp(t.tier) * 2,
        });
      }
    }
  }
  return out;
}

/**
 * Herbs to potions, which is what Alchemy always said it did.
 *
 * `potions.ts` opens by recording the hole this fills: "Alchemy was a full
 * processing skill with a fuel cost and no customer anywhere in the design".
 * The effects were then written, typed and read by the engine — and the only
 * way to get one remained the shop. A ward is a toll you cannot craft and a
 * tonic is a session buff you cannot make is not an economy, it is a shop.
 *
 * Every potion in the catalogue gets exactly one recipe, so the list cannot
 * drift from the items: both walk POTION_EFFECTS × POTION_TIERS.
 */
export function alchemyRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const effect of POTION_EFFECTS) {
    for (let n = 0; n < POTION_TIERS; n++) {
      // The same tier the item itself is generated at, read from the same
      // expression, so a potion and its recipe can never land on different
      // rungs of the spine.
      const t = Math.min(MAX_TIER, 1 + n * 4);
      out.push({
        id: `recipe:alchemy:${effect}:${n + 1}`,
        skill: "alchemy",
        outputId: `potion:${effect}:${n + 1}`,
        outputName: `${effect} Tonic ${POTION_ROMAN[n]}`,
        outputQty: 2,
        tier: t,
        inputs: [{ itemId: raw("Herb", t), qty: 3 }],
        fuel: processFuelCost(t),
        level: tierSkillRequirement(t),
        xp: processingXp(t),
      });
    }
  }
  return out;
}

/**
 * Relics broken down into the stones that refine gear.
 *
 * Excavation was the last gathering skill whose output nothing consumed: you
 * dug up relics and they filled a limited bank forever. This is the third
 * faucet for upgrade stones, and the point is what it is paid in — the shop
 * charges coins, auto-salvage pays out on luck, and this costs time and nothing
 * else. So "I want to refine something" finally has an activity attached to it
 * rather than a balance.
 *
 * The jeweller does the work because the jeweller already handles what comes
 * out of the ground looking valuable, and because Setting Flux is a jeweller's
 * material by name. Nothing converts upward: a relic makes stones at its own
 * tier, so shallow digging can never fund deep refinement — which is the same
 * rule the downward-only stone exchange at the shop exists to protect.
 */
export function relicRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const kind of STONE_KINDS) {
    for (const t of TIERS) {
      out.push({
        id: `recipe:jewelcrafting:${kind}:${t.tier}`,
        skill: "jewelcrafting",
        outputId: `stone:${kind}:${t.tier}`,
        outputName: `${t.metal} ${kind}`,
        outputQty: 3,
        tier: t.tier,
        inputs: [{ itemId: raw("Relic", t.tier), qty: 2 }],
        fuel: processFuelCost(t.tier),
        level: tierSkillRequirement(t.tier),
        xp: processingXp(t.tier),
      });
    }
  }
  return out;
}

/**
 * Tools, which Smithing's note has always promised.
 *
 * "Bars to plate and tools", and no recipe in the game made one — so the eight
 * tools every gathering skill is gated behind could only ever be bought. That
 * is the same shape as Alchemy's empty recipe list, and it survived longer
 * because the shop covered for it.
 *
 * One bar apiece. A tool is manufactured but simpler than a weapon and it is
 * never destroyed, and at `SELL_MULTIPLIER.tool` a bar is worth almost exactly
 * what the shop charges — so buying and smithing sit level, and the tie breaks
 * toward whichever you already have: coins if you fight, ore if you mine.
 *
 * Crafted at Plain, like all crafted equipment: quality is found, never made.
 */
export function toolRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const { skill, noun } of TOOL_SKILLS) {
    for (const t of TIERS) {
      out.push({
        id: `recipe:smithing:tool:${skill}:${t.tier}`,
        skill: "smithing",
        outputId: `tool:${skill}:${t.tier}:${CRAFTED_QUALITY}`,
        outputName: toolName(noun, t.tier, CRAFTED_QUALITY),
        outputQty: 1,
        tier: t.tier,
        inputs: [{ itemId: refined("Bar", t.tier), qty: 1 }],
        fuel: processFuelCost(t.tier) * 2,
        level: tierSkillRequirement(t.tier),
        xp: processingXp(t.tier) * 2,
      });
    }
  }
  return out;
}

/** Every recipe in the game. */
export function allRecipes(): Recipe[] {
  return [
    ...refiningRecipes(),
    ...equipmentRecipes(),
    ...jewelleryRecipes(),
    ...relicRecipes(),
    ...toolRecipes(),
    ...alchemyRecipes(),
    ...upkeepRecipes(),
  ];
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
  /**
   * Both levels, as one argument rather than two adjacent numbers.
   *
   * The skill's own level and the character level that opens the skill at all
   * are different questions with the same type, and a positional pair of them
   * is a bug waiting for a refactor to swap it.
   */
  levels: { skill: number; character: number },
  nameOf: (itemId: string) => string = (id) => id,
): CraftCheck {
  const missing: string[] = [];
  /*
   * The skill has to be open before its levels mean anything. Worded exactly as
   * `checkGate` words it, because a player meets these two gates on different
   * screens and they are the same sentence about the same ladder.
   */
  const unlock = skillUnlock(recipe.skill);
  if (levels.character < unlock) missing.push(`character level ${unlock}`);
  if (levels.skill < recipe.level) missing.push(`${recipe.skill} ${recipe.level}`);
  if (fuel < recipe.fuel) missing.push(`${recipe.fuel} fuel (you have ${fuel})`);
  for (const input of recipe.inputs) {
    const held = have(input.itemId);
    if (held < input.qty) missing.push(`${input.qty - held} more ${nameOf(input.itemId)}`);
  }
  return missing.length === 0 ? { ok: true, recipe } : { ok: false, missing };
}

export const MAX_RECIPE_TIER = MAX_TIER;
export const TIER_LABEL = (t: number) => tierAt(t).metal;
