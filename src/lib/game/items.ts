/**
 * The catalogue, generated (SPEC-V2.md §9).
 *
 * Ten thousand items is not an authoring target, it is a product of axes. This
 * module is the whole content file: nothing here is a list of items, everything
 * here is a rule that makes them. Adding a tier, a slot or a style is a config
 * change, and never a migration.
 *
 * The one exception is the uniques, which exist precisely to break the curve the
 * rest of this obeys, and which live in `uniques.ts`.
 */
import { ARCHETYPES, STYLE_FAMILY, STYLES, type Style } from "./archetypes";
import { BIOME_MATERIALS } from "./biomes";
import { QUALITIES, type Quality } from "./quality";
import { SLOTS, type Slot } from "./power";
import { PARTS } from "./species";
import { GUN_ENTRY_TIER, MAX_TIER, TIERS, tier as tierAt } from "./tiers";

export type ItemClass =
  | "weapon"
  | "armour"
  | "tool"
  | "ammo"
  | "part"
  | "biomeMaterial"
  | "raw"
  | "refined"
  | "consumable"
  | "stone"
  | "seed";

export type ItemDef = {
  id: string;
  name: string;
  cls: ItemClass;
  tier: number;
  slot?: Slot;
  style?: Style;
  quality?: Quality;
  archetype?: string;
  /** The skill that makes or uses it. */
  skill?: string;
  stackable: boolean;
};

const id = (...parts: (string | number)[]) => parts.join(":");

/** Tiers a style has gear at. Firearms have no material below tier 6. */
export function tiersFor(style: Style): number[] {
  const from = style === "gun" ? GUN_ENTRY_TIER : 1;
  return TIERS.filter((t) => t.tier >= from).map((t) => t.tier);
}

/** The material word a style uses at a tier. */
export function materialFor(style: Style, t: number): string {
  const family = STYLE_FAMILY[style];
  return tierAt(t)[family] ?? tierAt(t).metal;
}

/** Hide armour inserts the word, so the family reads as itself. */
function armourName(style: Style, t: number, slot: Slot): string {
  const material = materialFor(style, t);
  const noun = SLOT_NOUN[style][slot];
  return style === "ranged" ? `${material} Hide ${noun}` : `${material} ${noun}`;
}

/** One noun per slot per style, so a set reads as a set. */
export const SLOT_NOUN: Record<Style, Record<Slot, string>> = {
  melee: {
    weapon: "", offhand: "Kite Shield", head: "Helm", body: "Platebody", legs: "Platelegs",
    boots: "Sabatons", gloves: "Gauntlets", cape: "Warcloak", amulet: "Torc", ring: "Signet",
  },
  ranged: {
    weapon: "", offhand: "Quiver", head: "Cowl", body: "Jerkin", legs: "Chaps",
    boots: "Treads", gloves: "Bracers", cape: "Cloak", amulet: "Pendant", ring: "Band",
  },
  magic: {
    weapon: "", offhand: "Focus", head: "Hood", body: "Robe Top", legs: "Robe Skirt",
    boots: "Slippers", gloves: "Wraps", cape: "Mantle", amulet: "Talisman", ring: "Loop",
  },
  gun: {
    weapon: "", offhand: "Bandolier", head: "Brim", body: "Coat", legs: "Breeches",
    boots: "Boots", gloves: "Grips", cape: "Duster", amulet: "Chain", ring: "Seal",
  },
};

export const ARMOUR_SLOTS: Slot[] = SLOTS.filter((s) => s !== "weapon");

export function generateWeapons(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const a of ARCHETYPES) {
    for (const t of tiersFor(a.style)) {
      for (const q of QUALITIES) {
        out.push({
          id: id("weapon", a.name, t, q.key),
          name: `${q.key === "plain" ? "" : q.label + " "}${materialFor(a.style, t)} ${a.name}`.trim(),
          cls: "weapon",
          tier: t,
          slot: "weapon",
          style: a.style,
          quality: q.key,
          archetype: a.name,
          stackable: false,
        });
      }
    }
  }
  return out;
}

export function generateArmour(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const style of STYLES) {
    for (const t of tiersFor(style)) {
      for (const slot of ARMOUR_SLOTS) {
        for (const q of QUALITIES) {
          out.push({
            id: id("armour", style, slot, t, q.key),
            name: `${q.key === "plain" ? "" : q.label + " "}${armourName(style, t, slot)}`.trim(),
            cls: "armour",
            tier: t,
            slot,
            style,
            quality: q.key,
            stackable: false,
          });
        }
      }
    }
  }
  return out;
}

/** The eight tool lines, and the noun each skill's tool takes. */
export const TOOL_SKILLS: { skill: string; noun: string }[] = [
  { skill: "woodcutting", noun: "Axe" },
  { skill: "fishing", noun: "Rod" },
  { skill: "mining", noun: "Pickaxe" },
  { skill: "foraging", noun: "Sickle" },
  { skill: "hunting", noun: "Snare" },
  { skill: "excavation", noun: "Trowel" },
  { skill: "smelting", noun: "Tongs" },
  { skill: "smithing", noun: "Hammer" },
];

/** Tools come in three grades rather than five: they are equipment you work with. */
export const TOOL_GRADES: Quality[] = ["crude", "plain", "fine"];

export function generateTools(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const { skill, noun } of TOOL_SKILLS) {
    for (const t of TIERS) {
      for (const q of TOOL_GRADES) {
        out.push({
          id: id("tool", skill, t.tier, q),
          name: `${q === "plain" ? "" : QUALITIES.find((x) => x.key === q)!.label + " "}${t.metal} ${noun}`.trim(),
          cls: "tool",
          tier: t.tier,
          quality: q,
          skill,
          stackable: false,
        });
      }
    }
  }
  return out;
}

export const AMMO_LINES: { name: string; style: Style; skill: string }[] = [
  { name: "Arrow", style: "ranged", skill: "fletching" },
  { name: "Bolt", style: "ranged", skill: "fletching" },
  { name: "Dart", style: "ranged", skill: "fletching" },
  { name: "Rune", style: "magic", skill: "runecrafting" },
  { name: "Cartridge", style: "gun", skill: "gunsmithing" },
  { name: "Shell", style: "gun", skill: "gunsmithing" },
];

export function generateAmmo(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const line of AMMO_LINES) {
    for (const t of tiersFor(line.style)) {
      out.push({
        id: id("ammo", line.name, t),
        name: `${tierAt(t).metal} ${line.name}`,
        cls: "ammo",
        tier: t,
        style: line.style,
        skill: line.skill,
        stackable: true,
      });
    }
  }
  return out;
}

/** The eight raw lines, one per gathering output. */
export const RAW_LINES: { name: string; skill: string; family: "metal" | "hide" | "cloth" }[] = [
  { name: "Log", skill: "woodcutting", family: "metal" },
  { name: "Catch", skill: "fishing", family: "metal" },
  { name: "Ore", skill: "mining", family: "metal" },
  { name: "Gem", skill: "mining", family: "metal" },
  { name: "Herb", skill: "foraging", family: "cloth" },
  { name: "Hide", skill: "hunting", family: "hide" },
  { name: "Fibre", skill: "foraging", family: "cloth" },
  { name: "Relic", skill: "excavation", family: "metal" },
];

export const REFINED_LINES: { name: string; skill: string }[] = [
  { name: "Bar", skill: "smelting" },
  { name: "Plank", skill: "fletching" },
  { name: "Leather", skill: "leatherworking" },
  { name: "Cloth", skill: "tailoring" },
  { name: "Charcoal", skill: "firemaking" },
  { name: "Alloy", skill: "smithing" },
  { name: "Essence", skill: "runecrafting" },
];

export function generateMaterials(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const line of RAW_LINES) {
    for (const t of TIERS) {
      out.push({
        id: id("raw", line.name, t.tier),
        name: `${t[line.family] ?? t.metal} ${line.name}`,
        cls: "raw",
        tier: t.tier,
        skill: line.skill,
        stackable: true,
      });
    }
  }
  for (const line of REFINED_LINES) {
    for (const t of TIERS) {
      out.push({
        id: id("refined", line.name, t.tier),
        name: `${t.metal} ${line.name}`,
        cls: "refined",
        tier: t.tier,
        skill: line.skill,
        stackable: true,
      });
    }
  }
  // Gunpowder only exists once there is sulphur to make it from.
  for (const t of TIERS.filter((x) => x.tier >= GUN_ENTRY_TIER)) {
    out.push({
      id: id("refined", "Powder", t.tier),
      name: `${t.metal} Powder`,
      cls: "refined",
      tier: t.tier,
      skill: "gunsmithing",
      stackable: true,
    });
  }
  return out;
}

export function generateParts(): ItemDef[] {
  return [
    ...PARTS.map((p) => ({
      id: id("part", p.name),
      name: p.name,
      cls: "part" as ItemClass,
      tier: p.tier,
      stackable: true,
    })),
    ...BIOME_MATERIALS.map((m) => ({
      id: id("biome", m.name),
      name: m.name,
      cls: "biomeMaterial" as ItemClass,
      tier: m.tier,
      stackable: true,
    })),
  ];
}

/** Thirty potion effects, six tiers each, plus the upkeep lines. */
export const POTION_EFFECTS = [
  "Deep Vein", "Long Grain", "Full Net", "Green Hand", "Clean Kill", "Careful Dig",
  "Steady Aim", "Hard Guard", "Quick Step", "Cold Blood", "Keen Edge", "Sure Shot",
  "Warded", "Kindled", "Bright Eye", "Iron Gut", "Deft Hand", "Long Wind",
  "Sharp Sense", "Still Water", "Low Smoke", "Thick Skin", "Fine Thread", "True Weight",
  "Coin Sense", "Rich Seam", "Fair Weather", "Salt Ward", "Rot Ward", "Void Ward",
];

export const POTION_TIERS = 6;
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export function generateConsumables(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const effect of POTION_EFFECTS) {
    for (let n = 0; n < POTION_TIERS; n++) {
      out.push({
        id: id("potion", effect, n + 1),
        name: `${effect} Tonic ${ROMAN[n]}`,
        cls: "consumable",
        tier: Math.min(MAX_TIER, 1 + n * 4),
        skill: "alchemy",
        stackable: true,
      });
    }
  }
  for (const t of TIERS) {
    out.push({
      id: id("ration", t.tier),
      name: `${t.metal} Ration`,
      cls: "consumable",
      tier: t.tier,
      skill: "cooking",
      stackable: true,
    });
  }
  return out;
}

export const STONE_KINDS = ["Whetstone", "Temper Salt", "Setting Flux"];

export function generateStones(): ItemDef[] {
  return TIERS.flatMap((t) =>
    STONE_KINDS.map((kind) => ({
      id: id("stone", kind, t.tier),
      name: `${t.metal} ${kind}`,
      cls: "stone" as ItemClass,
      tier: t.tier,
      stackable: true,
    })),
  );
}

export const CROP_LINES = ["Herb", "Fibre", "Sapling", "Stock"];

export function generateSeeds(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const line of CROP_LINES) {
    for (let n = 0; n < 12; n++) {
      const t = Math.min(MAX_TIER, 1 + n * 2);
      out.push({
        id: id("seed", line, t),
        name: `${tierAt(t).cloth} ${line} Seed`,
        cls: "seed",
        tier: t,
        skill: "farming",
        stackable: true,
      });
    }
  }
  return out;
}

/** The whole catalogue. Built on demand; nothing here is stored. */
export function generateCatalogue(): ItemDef[] {
  return [
    ...generateWeapons(),
    ...generateArmour(),
    ...generateTools(),
    ...generateAmmo(),
    ...generateMaterials(),
    ...generateParts(),
    ...generateConsumables(),
    ...generateStones(),
    ...generateSeeds(),
  ];
}

export function catalogueBreakdown(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of generateCatalogue()) out[item.cls] = (out[item.cls] ?? 0) + 1;
  return out;
}

/* --------------------------- naming what you hold -------------------------- */

let INDEX: Map<string, ItemDef> | null = null;

/**
 * The catalogue by id, built once.
 *
 * This lived in `game-view-service`, which is a database module — so anything
 * that wanted an item's name had to import Postgres to get it, and
 * `activity-service` simply gave up and wrote the raw id into a session
 * summary. It is pure: no clock, no database, just the generated catalogue.
 */
export function itemIndex(): Map<string, ItemDef> {
  if (!INDEX) INDEX = new Map(generateCatalogue().map((i) => [i.id, i]));
  return INDEX;
}

export function itemName(itemId: string): string {
  const found = itemIndex().get(itemId);
  if (found) return found.name;
  // Parts, biome materials and rations carry their name in the id, because they
  // are generated from tables the catalogue reads rather than from the spine.
  const [, ...rest] = itemId.split(":");
  return rest.join(" ") || itemId;
}
