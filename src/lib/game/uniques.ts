/**
 * The uniques (SPEC-V2.md §9).
 *
 * Everything else in the catalogue comes out of a generator and obeys one
 * formula. These do not: each carries a modifier no generated item has, and each
 * is the reason some particular fight is worth repeating.
 *
 * Names are original, written in the genre's tradition rather than borrowed from
 * any specific game. Effects are TYPED where the engine can read them and
 * marked `descriptive` where it cannot — see `effects.ts`. An intended effect
 * that does nothing is allowed to exist, but it is not allowed to pretend.
 */
import type { Effect } from "./effects";
import type { Style } from "./archetypes";
import type { Slot } from "./power";

export type Unique = {
  name: string;
  slot: Slot;
  /** Null when any style can use it. */
  style: Style | null;
  tier: number;
  effect: Effect;
  /** The boss whose first kill always gives it up, where there is one. */
  source?: string;
};

const u = (
  name: string,
  slot: Slot,
  style: Style | null,
  tier: number,
  effect: Effect,
  source?: string,
): Unique => ({ name, slot, style, tier, effect, source });

/**
 * `descriptive` is still part of the type, deliberately: a future unique may be
 * named before its mechanism exists, and saying so is better than pretending.
 * Nothing uses it today.
 *
 * Eight did, and they were replaced rather than built. Each needed a whole
 * mechanism for one item — hidden areas, spawn suppression, a reroll economy —
 * and one of them, Gale Warden's Wings ("ignores one key-item gate"), could not
 * be built at all: a gate is a tier number, and nothing may move what it asks
 * for. The names were worth keeping and the effects were not.
 */

export const UNIQUES: Unique[] = [
  /* ------------------------------------------------ melee weapons — 30 */
  u("Thistlemaw's Grin", "weapon", "melee", 2, { kind: "rollTwice" }, "Thistlemaw"),
  u("Hollowfang", "weapon", "melee", 4, { kind: "ignoreWheelPenalty" }, "Hollow-Antler"),
  u("The Third Shift", "weapon", "melee", 6, { kind: "asTool", skill: "mining", tiersAbove: 2 }, "The Third Shift"),
  u("Rootfang", "weapon", "melee", 5, { kind: "offence", pct: 8 }, "Old Rootfang"),
  u("Emberthrone", "weapon", "melee", 8, { kind: "freeDurability" }, "Emberthrone"),
  u("Cold Engine Ram", "weapon", "melee", 20, { kind: "refineDiscount", pct: 50 }, "The Cold Engine"),
  u("Widow's Tithe", "weapon", "melee", 9, { kind: "dropRate", pct: 12 }),
  u("Kneeling Saint", "weapon", "melee", 15, { kind: "freeRations" }, "The Kneeling Saint"),
  u("Blackvein Cleaver", "weapon", "melee", 10, { kind: "offence", pct: 12 }, "Blackvein"),
  u("Solmourn", "weapon", "melee", 24, { kind: "characterXp", pct: 10 }, "Solmourn"),
  u("Gilded Hare's Tooth", "weapon", "melee", 2, { kind: "throughput", pct: 30 }, "The Gilded Hare"),
  u("Unmaking Edge", "weapon", "melee", 22, { kind: "dropRate", pct: 25 }, "The Unmaking"),
  u("Pale Tide", "weapon", "melee", 4, { kind: "offence", pct: 10 }, "The Pale Tide"),
  u("Antler of the Wild Hunt", "weapon", "melee", 11, { kind: "throughput", pct: 15 }, "The Wild Hunt"),
  u("Sand Sermon", "weapon", "melee", 13, { kind: "skillXp", pct: 20, skill: "excavation" }, "The Sand Sermon"),
  u("Warden's Null-Rod", "weapon", "melee", 20, { kind: "ignoreWheelPenalty" }, "Warden Null"),
  u("Bramblewretch Flail", "weapon", "melee", 5, { kind: "yield", pct: 10, skill: "foraging" }, "Bramblewretch"),
  u("Reedmother's Hook", "weapon", "melee", 7, { kind: "yield", pct: 12, skill: "fishing" }, "Reedmother"),
  u("Seamwyrm Spine", "weapon", "melee", 10, { kind: "offence", pct: 14 }, "Seamwyrm"),
  u("Thornsovereign Bill", "weapon", "melee", 11, { kind: "bankSlots", slots: 20 }, "Thornsovereign"),
  u("Rimehowl Maul", "weapon", "melee", 12, { kind: "defence", pct: 10 }, "Rimehowl"),
  u("Mirrorstride Sabre", "weapon", "melee", 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Sporecrown Cudgel", "weapon", "melee", 14, { kind: "yield", pct: 15, skill: "foraging" }, "Sporecrown"),
  u("Glassflame Falchion", "weapon", "melee", 16, { kind: "offence", pct: 18 }, "Glassflame"),
  u("Skyfracture Warhammer", "weapon", "melee", 17, { kind: "throughput", pct: 18 }, "Skyfracture"),
  u("Rotmother's Scythe", "weapon", "melee", 18, { kind: "dropRate", pct: 18 }, "Rotmother"),
  u("Scarborn Rend", "weapon", "melee", 21, { kind: "offence", pct: 22 }, "Scarborn"),
  u("Gravemaw Splitter", "weapon", "melee", 21, { kind: "freeDurability" }),
  u("Firstlight Blade", "weapon", "melee", 24, { kind: "rollTwice" }),
  u("Cavelight Pick-Axe", "weapon", "melee", 6, { kind: "asTool", skill: "mining", tiersAbove: 1 }, "Cavelight"),

  /* ----------------------------------------------- ranged weapons — 28 */
  u("Skyfracture", "weapon", "ranged", 17, { kind: "freeAmmoOnKill" }, "Skyfracture"),
  u("Rimehowl Draw", "weapon", "ranged", 12, { kind: "offence", pct: 16 }, "Rimehowl"),
  u("The Drowned Choir", "weapon", "ranged", 9, { kind: "throughput", pct: 22 }, "The Drowned Choir"),
  u("Bramblewretch Sling", "weapon", "ranged", 5, { kind: "freeAmmoOnKill" }, "Bramblewretch"),
  u("Old Poacher's Kit", "weapon", "ranged", 7, { kind: "dropRate", pct: 14 }),
  u("Thornsovereign Bow", "weapon", "ranged", 11, { kind: "bankSlots", slots: 15 }, "Thornsovereign"),
  u("Fenlantern", "weapon", "ranged", 7, { kind: "dropRate", pct: 14 }, "Fenlantern"),
  u("Wrackmaiden's Line", "weapon", "ranged", 9, { kind: "yield", pct: 25, skill: "fishing" }, "Wrackmaiden"),
  u("Mirrorstride", "weapon", "ranged", 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Whisper-Nock", "weapon", "ranged", 19, { kind: "throughput", pct: 18 }),
  u("Scarborn Recurve", "weapon", "ranged", 21, { kind: "offence", pct: 20 }, "Scarborn"),
  u("Gale Warden's Arc", "weapon", "ranged", 17, { kind: "throughput", pct: 20 }, "The Gale Warden"),
  u("Hare-Foot Sling", "weapon", "ranged", 2, { kind: "throughput", pct: 28 }, "The Gilded Hare"),
  u("Last Light Bow", "weapon", "ranged", 24, { kind: "dropRate", pct: 30 }, "The Last Light"),
  u("Thistlemaw Snarebow", "weapon", "ranged", 2, { kind: "yield", pct: 12, skill: "hunting" }, "Thistlemaw"),
  u("Oakenshade Longbow", "weapon", "ranged", 3, { kind: "yield", pct: 14, skill: "woodcutting" }, "Oakenshade"),
  u("Brinescuttle Harpoon", "weapon", "ranged", 4, { kind: "yield", pct: 14, skill: "fishing" }, "Brinescuttle"),
  u("Deadlamp Crossbow", "weapon", "ranged", 6, { kind: "throughput", pct: 14 }, "Cavelight"),
  u("Emberthrone Firelance", "weapon", "ranged", 8, { kind: "offence", pct: 12 }, "Emberthrone"),
  u("Blackvein Boltcaster", "weapon", "ranged", 10, { kind: "asTool", skill: "mining", tiersAbove: 1 }, "Blackvein"),
  u("Wild Hunt Horn-Bow", "weapon", "ranged", 11, { kind: "chainLink", links: 1 }, "The Wild Hunt"),
  u("White Elk Draw", "weapon", "ranged", 12, { kind: "skillXp", pct: 15, skill: "hunting" }, "The White Elk"),
  u("Sand Sermon Sling", "weapon", "ranged", 13, { kind: "yield", pct: 18, skill: "excavation" }, "The Sand Sermon"),
  u("Mycelia Spinebow", "weapon", "ranged", 14, { kind: "dropRate", pct: 16 }, "Mycelia Prime"),
  u("Obsidian Ordinal Bow", "weapon", "ranged", 16, { kind: "rollTwice" }, "The Obsidian Ordinal"),
  u("Plaguewright Dartcaster", "weapon", "ranged", 18, { kind: "offence", pct: 18 }, "Plaguewright"),
  u("Rimeworks Repeater Bow", "weapon", "ranged", 20, { kind: "refineDiscount", pct: 30 }, "Warden Null"),
  u("Unmade Recurve", "weapon", "ranged", 22, { kind: "ignoreWheelPenalty" }, "The Unmaking"),

  /* ------------------------------------------------ magic weapons — 28 */
  u("Mycelia Prime", "weapon", "magic", 14, { kind: "dropRate", pct: 20 }, "Mycelia Prime"),
  u("Choirmaster's Baton", "weapon", "magic", 15, { kind: "freeAmmoOnKill" }, "Choirmaster Vell"),
  u("Glassflame", "weapon", "magic", 16, { kind: "offence", pct: 25 }, "Glassflame"),
  u("Sporecrown Tome", "weapon", "magic", 14, { kind: "yield", pct: 18, skill: "foraging" }, "Sporecrown"),
  u("Rotmother's Censer", "weapon", "magic", 18, { kind: "throughput", pct: 16 }, "Rotmother"),
  u("Oakenshade Branch", "weapon", "magic", 3, { kind: "yield", pct: 15, skill: "woodcutting" }, "Oakenshade"),
  u("Cavelight", "weapon", "magic", 6, { kind: "throughput", pct: 15 }, "Cavelight"),
  u("The Obsidian Ordinal", "weapon", "magic", 16, { kind: "rollTwice" }, "The Obsidian Ordinal"),
  u("Reedmother's Reed", "weapon", "magic", 7, { kind: "freeRations" }, "Reedmother"),
  u("Seamwyrm Coil", "weapon", "magic", 10, { kind: "offence", pct: 15 }, "Seamwyrm"),
  u("Void Sermon", "weapon", "magic", 22, { kind: "offence", pct: 28 }),
  u("Brinescuttle Focus", "weapon", "magic", 4, { kind: "skillXp", pct: 12 }, "Brinescuttle"),
  u("Rime Sigil", "weapon", "magic", 12, { kind: "defence", pct: 12 }, "Rimehowl"),
  u("White Elk Antler", "weapon", "magic", 12, { kind: "skillXp", pct: 18, skill: "slaying" }, "The White Elk"),
  u("Thistlemaw Wand", "weapon", "magic", 2, { kind: "yield", pct: 10 }, "Thistlemaw"),
  u("Pale Tide Orb", "weapon", "magic", 4, { kind: "yield", pct: 14, skill: "fishing" }, "The Pale Tide"),
  u("Rootbound Staff", "weapon", "magic", 5, { kind: "yield", pct: 14, skill: "woodcutting" }, "Old Rootfang"),
  u("Fenlantern Wisp", "weapon", "magic", 7, { kind: "dropRate", pct: 12 }, "Fenlantern"),
  u("Cinderjaw Emberstaff", "weapon", "magic", 8, { kind: "offence", pct: 14 }, "Cinderjaw"),
  u("Wrackmaiden Tidecall", "weapon", "magic", 9, { kind: "yield", pct: 20, skill: "fishing" }, "Wrackmaiden"),
  u("Briar Wardstaff", "weapon", "magic", 11, { kind: "defence", pct: 14 }, "Thornsovereign"),
  u("Glasscut Prism", "weapon", "magic", 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Sanctum Thurible", "weapon", "magic", 15, { kind: "characterXp", pct: 8 }, "The Kneeling Saint"),
  u("Stormworn Conduit", "weapon", "magic", 17, { kind: "throughput", pct: 20 }, "The Gale Warden"),
  u("Blightfen Miasma", "weapon", "magic", 18, { kind: "dropRate", pct: 20 }, "Plaguewright"),
  u("Coldwrought Null-Orb", "weapon", "magic", 20, { kind: "ignoreWheelPenalty" }, "The Cold Engine"),
  u("Unmade Grimoire", "weapon", "magic", 22, { kind: "offence", pct: 24 }, "The Unmaking"),
  u("Spirelit Sunstaff", "weapon", "magic", 24, { kind: "characterXp", pct: 12 }, "The Last Light"),

  /* ---------------------------------------------------- firearms — 26 */
  u("Emberthrone Repeater", "weapon", "gun", 8, { kind: "refineDiscount", pct: 40 }, "Emberthrone"),
  u("Cinderjaw", "weapon", "gun", 8, { kind: "throughput", pct: 25 }, "Cinderjaw"),
  u("Warden Null", "weapon", "gun", 20, { kind: "ignoreWheelPenalty" }, "Warden Null"),
  u("Blackvein Drill-Gun", "weapon", "gun", 10, { kind: "asTool", skill: "mining", tiersAbove: 3 }, "Blackvein"),
  u("The Sand Sermon Piece", "weapon", "gun", 13, { kind: "dropRate", pct: 18 }, "The Sand Sermon"),
  u("Skyfracture Carbine", "weapon", "gun", 17, { kind: "freeAmmoOnKill" }, "Skyfracture"),
  u("Plaguewright's Bore", "weapon", "gun", 18, { kind: "offence", pct: 20 }, "Plaguewright"),
  u("Glasswaste Derringer", "weapon", "gun", 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Rimeworks Autoloader", "weapon", "gun", 20, { kind: "throughput", pct: 22 }, "The Cold Engine"),
  u("Solmourn Hand-Cannon", "weapon", "gun", 24, { kind: "dropRate", pct: 35 }, "Solmourn"),
  u("Scarborn Scattergun", "weapon", "gun", 21, { kind: "offence", pct: 24 }, "Scarborn"),
  u("The Last Volley", "weapon", "gun", 24, { kind: "offence", pct: 26 }, "The Last Light"),
  u("Fenlantern Flare", "weapon", "gun", 7, { kind: "dropRate", pct: 15 }, "Fenlantern"),
  u("Choir Piece", "weapon", "gun", 15, { kind: "freeAmmoOnKill" }, "Choirmaster Vell"),
  u("Brackish Blunderbuss", "weapon", "gun", 6, { kind: "throughput", pct: 16 }),
  u("Wrackshore Sealgun", "weapon", "gun", 9, { kind: "yield", pct: 15, skill: "fishing" }, "The Drowned Choir"),
  u("Deepvein Boltgun", "weapon", "gun", 10, { kind: "asTool", skill: "mining", tiersAbove: 2 }, "Seamwyrm"),
  u("Briar Coachgun", "weapon", "gun", 11, { kind: "bankSlots", slots: 10 }, "The Wild Hunt"),
  u("Rime Longrifle", "weapon", "gun", 12, { kind: "offence", pct: 16 }, "The White Elk"),
  u("Sporelit Sprayer", "weapon", "gun", 14, { kind: "yield", pct: 16, skill: "foraging" }, "Mycelia Prime"),
  u("Sanctum Handgonne", "weapon", "gun", 15, { kind: "characterXp", pct: 7 }, "The Kneeling Saint"),
  u("Emberglass Volleygun", "weapon", "gun", 16, { kind: "throughput", pct: 20 }, "The Obsidian Ordinal"),
  u("Stormworn Stormlock", "weapon", "gun", 17, { kind: "freeAmmoOnKill" }, "The Gale Warden"),
  u("Fenrot Pepperbox", "weapon", "gun", 18, { kind: "dropRate", pct: 18 }, "Rotmother"),
  u("Unmade Railpiece", "weapon", "gun", 22, { kind: "offence", pct: 25 }, "The Unmaking"),
  u("Firstlight Sunlock", "weapon", "gun", 24, { kind: "rollTwice" }),

  /* ------------------------------------------------------ armour — 52 */
  u("Thistlemaw Hide", "body", "ranged", 2, { kind: "yield", pct: 10 }, "Thistlemaw"),
  u("Cloak of the Wild Hunt", "cape", null, 11, { kind: "chainLink", links: 1 }, "The Wild Hunt"),
  u("Hollow-Antler Helm", "head", "melee", 4, { kind: "dropRate", pct: 10 }, "Hollow-Antler"),
  u("Third Shift Boots", "boots", "melee", 6, { kind: "throughput", pct: 12 }, "The Third Shift"),
  u("Drowned Choir Mantle", "cape", "magic", 9, { kind: "freeRations" }, "The Drowned Choir"),
  u("Rimehowl Pelt", "body", "ranged", 12, { kind: "defence", pct: 15 }, "Rimehowl"),
  u("Glassflame Greaves", "legs", "magic", 16, { kind: "offence", pct: 14 }, "Glassflame"),
  u("Kneeling Saint's Habit", "body", "magic", 15, { kind: "refineDiscount", pct: 100 }, "The Kneeling Saint"),
  u("Sporecrown Cowl", "head", "magic", 14, { kind: "yield", pct: 14, skill: "foraging" }, "Sporecrown"),
  u("Emberthrone Plate", "body", "melee", 8, { kind: "freeDurability" }, "Emberthrone"),
  u("Gale Warden's Wings", "cape", null, 17, { kind: "throughput", pct: 16 }, "The Gale Warden"),
  u("Blackvein Gauntlets", "gloves", "melee", 10, { kind: "yield", pct: 18, skill: "mining" }, "Blackvein"),
  u("Voidscar Shroud", "cape", null, 21, { kind: "defence", pct: 20 }, "Scarborn"),
  u("Sand Sermon Wraps", "gloves", "magic", 13, { kind: "yield", pct: 20, skill: "excavation" }, "The Sand Sermon"),
  u("Last Light Crown", "head", null, 24, { kind: "skillXp", pct: 15 }, "The Last Light"),
  u("Fenlantern Lamp-Harness", "body", "gun", 7, { kind: "yield", pct: 12 }, "Fenlantern"),
  u("Mirrorstride Sabatons", "boots", "ranged", 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Rootfang Bracers", "gloves", "melee", 5, { kind: "yield", pct: 15, skill: "woodcutting" }, "Old Rootfang"),
  u("Pale Tide Scale", "body", "melee", 4, { kind: "defence", pct: 12 }, "The Pale Tide"),
  u("Warden Null Visor", "head", "gun", 20, { kind: "ignoreWheelPenalty" }, "Warden Null"),
  u("Gilded Hare Slippers", "boots", "magic", 2, { kind: "throughput", pct: 20 }, "The Gilded Hare"),
  u("Oakenshade Mantle", "cape", "magic", 3, { kind: "yield", pct: 12, skill: "woodcutting" }, "Oakenshade"),
  u("Brinescuttle Carapace", "body", "melee", 4, { kind: "defence", pct: 10 }, "Brinescuttle"),
  u("Bramblewretch Chaps", "legs", "ranged", 5, { kind: "yield", pct: 12, skill: "foraging" }, "Bramblewretch"),
  u("Cavelight Hood", "head", "magic", 6, { kind: "throughput", pct: 12 }, "Cavelight"),
  u("Reedmother's Wading Boots", "boots", "ranged", 7, { kind: "yield", pct: 14, skill: "fishing" }, "Reedmother"),
  u("Cinderjaw Coat", "body", "gun", 8, { kind: "offence", pct: 12 }, "Cinderjaw"),
  u("Wrackmaiden Oilskin", "body", "gun", 9, { kind: "yield", pct: 15, skill: "fishing" }, "Wrackmaiden"),
  u("Seamwyrm Scale Legs", "legs", "melee", 10, { kind: "defence", pct: 14 }, "Seamwyrm"),
  u("Thornsovereign Circlet", "head", "magic", 11, { kind: "bankSlots", slots: 25 }, "Thornsovereign"),
  u("White Elk Hide", "body", "ranged", 12, { kind: "skillXp", pct: 12, skill: "hunting" }, "The White Elk"),
  u("Glasscut Visor", "head", "gun", 13, { kind: "dropRate", pct: 14 }, "Mirrorstride"),
  u("Mycelia Robe", "body", "magic", 14, { kind: "yield", pct: 16, skill: "foraging" }, "Mycelia Prime"),
  u("Choirmaster's Vestment", "body", "magic", 15, { kind: "freeAmmoOnKill" }, "Choirmaster Vell"),
  u("Obsidian Ordinal Plate", "body", "melee", 16, { kind: "defence", pct: 18 }, "The Obsidian Ordinal"),
  u("Stormworn Duster", "cape", "gun", 17, { kind: "throughput", pct: 16 }, "The Gale Warden"),
  u("Skyfracture Quiverbelt", "offhand", "ranged", 17, { kind: "freeAmmoOnKill" }, "Skyfracture"),
  u("Rotmother's Shawl", "cape", "magic", 18, { kind: "dropRate", pct: 16 }, "Rotmother"),
  u("Plaguewright Bracers", "gloves", "gun", 18, { kind: "offence", pct: 16 }, "Plaguewright"),
  u("Coldwrought Carapace", "body", "melee", 20, { kind: "freeDurability" }, "The Cold Engine"),
  u("Rimeworks Gasket Gloves", "gloves", "gun", 20, { kind: "refineDiscount", pct: 35 }, "Warden Null"),
  u("Scarborn Mantle", "cape", "melee", 21, { kind: "offence", pct: 18 }, "Scarborn"),
  u("Unmade Greaves", "legs", "magic", 22, { kind: "ignoreWheelPenalty" }, "The Unmaking"),
  u("Gravemaw Pauldrons", "head", "melee", 21, { kind: "defence", pct: 20 }, undefined),
  u("Spirelit Robe", "body", "magic", 23, { kind: "characterXp", pct: 10 }, "Solmourn"),
  u("Firstlight Sabatons", "boots", "melee", 24, { kind: "throughput", pct: 22 }),
  u("Dawnmane Cape", "cape", null, 24, { kind: "chainLink", links: 1 }, "The Last Light"),
  u("Kite of the Pale Tide", "offhand", "melee", 4, { kind: "defence", pct: 15 }, "The Pale Tide"),
  u("Briar Bandolier", "offhand", "gun", 11, { kind: "freeAmmoOnKill" }, "The Wild Hunt"),
  u("Sanctum Focus", "offhand", "magic", 15, { kind: "offence", pct: 12 }, "The Kneeling Saint"),
  u("Deadlamp Buckler", "offhand", "melee", 6, { kind: "defence", pct: 12 }, "Cavelight"),
  u("Unmade Ward", "offhand", "magic", 22, { kind: "defence", pct: 22 }, "The Unmaking"),

  /* --------------------------------------- jewellery and trinkets — 40 */
  u("Ring of the Third Shift", "ring", null, 6, { kind: "bankSlots", slots: 30 }, "The Third Shift"),
  u("Gilded Hare's Charm", "ring", null, 2, { kind: "throughput", pct: 18 }, "The Gilded Hare"),
  u("Thornsovereign Signet", "ring", null, 11, { kind: "dropRate", pct: 15 }, "Thornsovereign"),
  u("Wrackmaiden's Pearl", "amulet", null, 9, { kind: "yield", pct: 22, skill: "fishing" }, "Wrackmaiden"),
  u("Cinderjaw Ember", "ring", null, 8, { kind: "offence", pct: 10 }, "Cinderjaw"),
  u("Choirmaster's Chain", "amulet", "magic", 15, { kind: "freeAmmoOnKill" }, "Choirmaster Vell"),
  u("Rimeworks Cog", "ring", null, 20, { kind: "refineDiscount", pct: 45 }, "The Cold Engine"),
  u("Voidscar Sigil", "amulet", null, 21, { kind: "offence", pct: 20 }, "Scarborn"),
  u("Unmaking Band", "ring", null, 22, { kind: "rollTwice" }, "The Unmaking"),
  u("Mycelia Spore-Locket", "amulet", null, 14, { kind: "yield", pct: 15 }, "Mycelia Prime"),
  u("Solmourn Sunstone", "amulet", null, 24, { kind: "characterXp", pct: 15 }, "Solmourn"),
  u("Old Rootfang's Knot", "ring", null, 5, { kind: "yield", pct: 12, skill: "woodcutting" }, "Old Rootfang"),
  u("Sand Sermon Scarab", "ring", null, 13, { kind: "dropRate", pct: 16 }, "The Sand Sermon"),
  u("Blackvein Nugget", "ring", null, 10, { kind: "yield", pct: 20, skill: "mining" }, "Blackvein"),
  u("White Elk Token", "amulet", null, 12, { kind: "skillXp", pct: 12, skill: "slaying" }, "The White Elk"),
  u("Pale Tide Shell", "ring", null, 4, { kind: "defence", pct: 10 }, "The Pale Tide"),
  u("Fenlantern Wick", "ring", null, 7, { kind: "dropRate", pct: 18 }, "Fenlantern"),
  u("Last Light Circlet", "amulet", null, 24, { kind: "dropRate", pct: 30 }, "The Last Light"),
  u("Thistlemaw Thorn", "ring", null, 2, { kind: "yield", pct: 8 }, "Thistlemaw"),
  u("Hollow-Antler Torc", "amulet", "melee", 4, { kind: "ignoreWheelPenalty" }, "Hollow-Antler"),
  u("Brinescuttle Band", "ring", null, 4, { kind: "yield", pct: 10, skill: "fishing" }, "Brinescuttle"),
  u("Bramblewretch Seed-Ring", "ring", null, 5, { kind: "yield", pct: 12, skill: "foraging" }, "Bramblewretch"),
  u("Cavelight Loop", "ring", null, 6, { kind: "throughput", pct: 10 }, "Cavelight"),
  u("Reedmother's Reed-Ring", "ring", null, 7, { kind: "freeRations" }, "Reedmother"),
  u("Emberthrone Signet", "ring", "melee", 8, { kind: "freeDurability" }, "Emberthrone"),
  u("Drowned Choir Pendant", "amulet", null, 9, { kind: "skillXp", pct: 12 }, "The Drowned Choir"),
  u("Seamwyrm Coil-Ring", "ring", null, 10, { kind: "offence", pct: 12 }, "Seamwyrm"),
  u("Wild Hunt Horn-Charm", "amulet", null, 11, { kind: "chainLink", links: 1 }, "The Wild Hunt"),
  u("Rimehowl Icebead", "ring", null, 12, { kind: "defence", pct: 12 }, "Rimehowl"),
  u("Mirrorstride Loop", "ring", null, 13, { kind: "rollTwice" }, "Mirrorstride"),
  u("Sporecrown Amber", "amulet", null, 14, { kind: "yield", pct: 16, skill: "foraging" }, "Sporecrown"),
  u("Kneeling Saint's Reliquary", "amulet", null, 15, { kind: "freeRations" }, "The Kneeling Saint"),
  u("Glassflame Bead", "ring", null, 16, { kind: "offence", pct: 16 }, "Glassflame"),
  u("Obsidian Ordinal Seal", "amulet", null, 16, { kind: "refineDiscount", pct: 25 }, "The Obsidian Ordinal"),
  u("Skyfracture Feather", "amulet", "ranged", 17, { kind: "freeAmmoOnKill" }, "Skyfracture"),
  u("Gale Warden's Ring", "ring", null, 17, { kind: "throughput", pct: 18 }, "The Gale Warden"),
  u("Rotmother's Bloom", "amulet", null, 18, { kind: "dropRate", pct: 20 }, "Rotmother"),
  u("Plaguewright's Vial", "ring", null, 18, { kind: "offence", pct: 15 }, "Plaguewright"),
  u("Warden Null Seal", "ring", null, 20, { kind: "ignoreWheelPenalty" }, "Warden Null"),
  u("Gravemaw Tooth", "amulet", null, 21, { kind: "defence", pct: 18 }),

  /* ------------------------------------------------------- tools — 26 */
  u("The Third Shift Pick", "weapon", null, 6, { kind: "asTool", skill: "mining", tiersAbove: 2 }, "The Third Shift"),
  u("Oakenshade Axe", "weapon", null, 3, { kind: "yield", pct: 25, skill: "woodcutting" }, "Oakenshade"),
  u("Wrackmaiden's Rod", "weapon", null, 9, { kind: "asTool", skill: "fishing", tiersAbove: 1 }, "Wrackmaiden"),
  u("Rootfang Sickle", "weapon", null, 5, { kind: "yield", pct: 25, skill: "foraging" }, "Old Rootfang"),
  u("Poacher's Snare", "weapon", null, 7, { kind: "yield", pct: 22, skill: "hunting" }),
  u("Sand Sermon Trowel", "weapon", null, 13, { kind: "yield", pct: 28, skill: "excavation" }, "The Sand Sermon"),
  u("Cavelight Lantern-Pick", "weapon", null, 6, { kind: "yield", pct: 20, skill: "mining" }, "Cavelight"),
  u("Rimehowl Skinner", "weapon", null, 12, { kind: "yield", pct: 24, skill: "hunting" }, "Rimehowl"),
  u("Mycelia Trowel", "weapon", null, 14, { kind: "yield", pct: 26, skill: "foraging" }, "Mycelia Prime"),
  u("Blackvein Auger", "weapon", null, 10, { kind: "asTool", skill: "mining", tiersAbove: 2 }, "Blackvein"),
  u("Glassflame Tongs", "weapon", null, 16, { kind: "refineDiscount", pct: 20 }, "Glassflame"),
  u("Cold Engine Hammer", "weapon", null, 20, { kind: "refineDiscount", pct: 40 }, "The Cold Engine"),
  u("Thistlemaw Shears", "weapon", null, 2, { kind: "yield", pct: 18, skill: "foraging" }, "Thistlemaw"),
  u("Brinescuttle Netting-Rod", "weapon", null, 4, { kind: "yield", pct: 20, skill: "fishing" }, "Brinescuttle"),
  u("Bramblewretch Billhook", "weapon", null, 5, { kind: "yield", pct: 20, skill: "woodcutting" }, "Bramblewretch"),
  u("Reedmother's Creel", "weapon", null, 7, { kind: "asTool", skill: "fishing", tiersAbove: 1 }, "Reedmother"),
  u("Emberthrone Firetongs", "weapon", null, 8, { kind: "refineDiscount", pct: 15 }, "Emberthrone"),
  u("Drowned Choir Dredge", "weapon", null, 9, { kind: "yield", pct: 22, skill: "fishing" }, "The Drowned Choir"),
  u("Seamwyrm Bore", "weapon", null, 10, { kind: "yield", pct: 24, skill: "mining" }, "Seamwyrm"),
  u("Thornsovereign Pruner", "weapon", null, 11, { kind: "yield", pct: 24, skill: "woodcutting" }, "Thornsovereign"),
  u("White Elk Flensing-Knife", "weapon", null, 12, { kind: "asTool", skill: "hunting", tiersAbove: 2 }, "The White Elk"),
  u("Mirrorstride Loupe", "weapon", null, 13, { kind: "yield", pct: 24, skill: "excavation" }, "Mirrorstride"),
  u("Sanctum Censer-Spade", "weapon", null, 15, { kind: "yield", pct: 26, skill: "excavation" }, "The Kneeling Saint"),
  u("Stormworn Quill-Snare", "weapon", null, 17, { kind: "yield", pct: 28, skill: "hunting" }, "The Gale Warden"),
  u("Fenrot Bog-Rake", "weapon", null, 18, { kind: "yield", pct: 28, skill: "foraging" }, "Rotmother"),
  u("Firstlight Spade", "weapon", null, 24, { kind: "yield", pct: 35, skill: "excavation" }),

  /* ------------------------------------------------------ curios — 20 */
  u("Hedgerow Luckpenny", "ring", null, 1, { kind: "dropRate", pct: 8 }),
  u("Hushwood Tally", "ring", null, 3, { kind: "skillXp", pct: 8 }),
  u("Tidal Glass", "amulet", null, 3, { kind: "yield", pct: 8, skill: "fishing" }),
  u("Rootbound Whistle", "amulet", null, 4, { kind: "chainLink", links: 1 }),
  u("Deadlamp Tallow", "ring", null, 6, { kind: "throughput", pct: 8 }),
  u("Brackish Vial", "ring", null, 6, { kind: "defence", pct: 8 }),
  u("Ashen Coalstone", "ring", null, 7, { kind: "yield", pct: 12, skill: "mining" }),
  u("Wrackshore Driftbead", "amulet", null, 8, { kind: "dropRate", pct: 10 }),
  u("Deepvein Damp-Flask", "ring", null, 9, { kind: "freeDurability" }),
  u("Briar Honeycomb", "amulet", null, 10, { kind: "freeRations" }),
  u("Rime Coldiron", "ring", null, 11, { kind: "defence", pct: 12 }),
  u("Glasscut Fulgurite", "amulet", null, 12, { kind: "rollTwice" }),
  u("Sporelit Amberdrop", "ring", null, 13, { kind: "yield", pct: 14, skill: "foraging" }),
  u("Sanctum Votive", "amulet", null, 14, { kind: "characterXp", pct: 6 }),
  u("Emberglass Cinder", "ring", null, 15, { kind: "offence", pct: 12 }),
  u("Stormworn Thunderglass", "amulet", null, 16, { kind: "throughput", pct: 14 }),
  u("Fenrot Miasma-Bead", "ring", null, 17, { kind: "dropRate", pct: 16 }),
  u("Coldwrought Null-Gasket", "ring", null, 19, { kind: "refineDiscount", pct: 25 }),
  u("Unmade Ichorbead", "amulet", null, 21, { kind: "offence", pct: 18 }),
  u("Spirelit Firstlight", "amulet", null, 23, { kind: "characterXp", pct: 12 }),
];

export const UNIQUE_BY_NAME = new Map(UNIQUES.map((x) => [x.name, x]));

/** Signature drops, keyed by the boss whose first kill always gives them up. */
export const UNIQUE_BY_SOURCE = (() => {
  const out = new Map<string, Unique[]>();
  for (const unique of UNIQUES) {
    if (!unique.source) continue;
    const list = out.get(unique.source) ?? [];
    list.push(unique);
    out.set(unique.source, list);
  }
  return out;
})();

export function uniqueItemId(unique: Unique): string {
  return `unique:${unique.name}`;
}
