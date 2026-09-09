/**
 * The 24 weapon archetypes: six roles in each of four styles (SPEC-V2.md §16.2).
 *
 * An archetype is the family noun in "{material} {archetype}" — Seamsteel
 * Fellmaul, Rime Hide Longdraw. Material carries the tier, quality carries the
 * window, refinement carries the plus; the archetype carries how the weapon
 * behaves, which is the hole SPEC-V2 §15.1 records as "the weapon archetype axis
 * is mechanically dead". These four fields are what fills it.
 *
 * `damage` is a coefficient, not a number of points: a weapon's damage is
 * damage x the tier's power x the quality window. `bandPct` is the half-width of
 * its rolled band, and it moves opposite to damage — a fast, shallow weapon
 * rolls wide, a slow and final one rolls tight. Two of the twenty-four had an
 * authored band; the rest are fitted to those two on a straight line.
 *
 * `hands: 2` forgoes the offhand slot entirely. That is the whole cost, and it
 * may move throughput and conversion but NEVER access: a gate stays a tier
 * number, or the greyed-out requirement list starts lying about what is missing.
 */
import type { Family } from "./tiers";

export type Style = "melee" | "ranged" | "magic" | "gun";
export const STYLES: Style[] = ["melee", "ranged", "magic", "gun"];

/** Which material family each style wears. */
export const STYLE_FAMILY: Record<Style, Family> = {
  melee: "metal",
  ranged: "hide",
  magic: "cloth",
  gun: "composite",
};

export type Archetype = {
  index: number;
  name: string;
  style: Style;
  /** 1-6 within the style. */
  role: number;
  /** Damage coefficient, multiplied by tier power and the quality window. */
  damage: number;
  /** Half-width of the rolled band, as a percent of the rolled centre. */
  bandPct: number;
  hands: 1 | 2;
  /** What the archetype is for, in one clause. */
  note: string;
};

export const ARCHETYPES: Archetype[] = [
  { index: 1, name: "Snapedge", style: "melee", role: 1, damage: 0.38, bandPct: 19.0, hands: 1, note: "Melee role 1 — fast and shallow: two hits an exchange at D 0.38, band +/-19%, one-handed so the offhand stays free, and melee pays no ammo, which makes it the cheapest weapon in the game to swing." },
  { index: 2, name: "Fellmaul", style: "melee", role: 2, damage: 0.95, bandPct: 14.0, hands: 2, note: "Melee role 2 — slow and final: one hit at D 0.95, two-handed, band +/-14%; the biggest thing melee can land in a single exchange." },
  { index: 3, name: "Farpike", style: "melee", role: 3, damage: 0.77, bandPct: 15.6, hands: 1, note: "Melee role 3 — reach: D 0.77 after paying 15% of its budget for one free opening hit that costs no durability, which is how a melee loadout survives an over-tier spawn." },
  { index: 4, name: "Sweeplash", style: "melee", role: 4, damage: 0.32, bandPct: 19.5, hands: 1, note: "Melee role 4 — multi-hit arc: three hits at D 0.32 and the widest band in the catalogue (+/-24%), so its rolls swing hardest, and the only role-4 weapon with no ammo bill at all." },
  { index: 5, name: "Threadspike", style: "melee", role: 5, damage: 0.74, bandPct: 15.8, hands: 1, note: "Melee role 5 — high crit, narrow band: 35% crit on one hit at D 0.74 inside +/-8%, the tightest numbers any weapon shows." },
  { index: 6, name: "Wardedge", style: "melee", role: 6, damage: 0.59, bandPct: 17.2, hands: 1, note: "Melee role 6 — one-handed and guarded: D 0.59, spending 35% of its offence budget on the free offhand slot and its own defence." },
  { index: 7, name: "Snapbow", style: "ranged", role: 1, damage: 0.38, bandPct: 19.0, hands: 1, note: "Ranged role 1 — light draw: two arrows an exchange at D 0.38 and two arrows of upkeep, cheap on the ammo ladder, one-handed." },
  { index: 8, name: "Fellwinch", style: "ranged", role: 2, damage: 0.95, bandPct: 14.0, hands: 1, note: "Ranged role 2 — cranked and slow: one bolt at D 0.95 for one unit of ammo, the heaviest hit the hide line can buy at any tier." },
  { index: 9, name: "Farloft", style: "ranged", role: 3, damage: 0.77, bandPct: 15.6, hands: 1, note: "Ranged role 3 — lobbed reach: D 0.77 plus the free opening shot, the standing answer to anything that has to close the distance." },
  { index: 10, name: "Hailcord", style: "ranged", role: 4, damage: 0.32, bandPct: 24.0, hands: 1, note: "Ranged role 4 — volley: three arrows at D 0.32 and three arrows of upkeep an attack, wide band +/-24%; affordable only because arrows sit low on the cost ladder." },
  { index: 11, name: "Threadbow", style: "ranged", role: 5, damage: 0.74, bandPct: 8.0, hands: 1, note: "Ranged role 5 — one aimed shot: 35% crit at D 0.74, band +/-8%, the best crit per unit of ammo in the game." },
  { index: 12, name: "Wardsling", style: "ranged", role: 6, damage: 0.59, bandPct: 17.2, hands: 1, note: "Ranged role 6 — one-handed sling: D 0.59 with the offhand free, the only ranged weapon that can carry a ward alongside it." },
  { index: 13, name: "Snaprod", style: "magic", role: 1, damage: 0.38, bandPct: 19.0, hands: 1, note: "Magic role 1 — two quick bolts at D 0.38, one-handed; two runes an attack is where medium ammo cost first bites." },
  { index: 14, name: "Fellstave", style: "magic", role: 2, damage: 0.95, bandPct: 14.0, hands: 1, note: "Magic role 2 — one slow heavy cast: D 0.95 for a single rune, the cheapest way to spend runes and the robes line's ceiling." },
  { index: 15, name: "Farglass", style: "magic", role: 3, damage: 0.77, bandPct: 15.6, hands: 1, note: "Magic role 3 — struck through a lens at distance: D 0.77 plus the free opening cast." },
  { index: 16, name: "Hailsigil", style: "magic", role: 4, damage: 0.32, bandPct: 24.0, hands: 1, note: "Magic role 4 — scattered bolts: three casts at D 0.32, three runes an attack and band +/-24%, expensive enough that Runecrafting becomes the limiting skill." },
  { index: 17, name: "Threadlens", style: "magic", role: 5, damage: 0.74, bandPct: 15.8, hands: 1, note: "Magic role 5 — 35% crit on one cast at D 0.74 inside +/-8%, one rune spent per attempt." },
  { index: 18, name: "Wardknot", style: "magic", role: 6, damage: 0.59, bandPct: 17.2, hands: 1, note: "Magic role 6 — one-handed charm: D 0.59 with the offhand free, the robes line's only offhand-compatible weapon." },
  { index: 19, name: "Snaplock", style: "gun", role: 1, damage: 0.38, bandPct: 19.0, hands: 1, note: "Gun role 1 — two light shots at D 0.38, one-handed; the cheapest gun to run and still two cartridges an attack, and the first firearm available at tier 6." },
  { index: 20, name: "Fellbore", style: "gun", role: 2, damage: 0.95, bandPct: 14.0, hands: 1, note: "Gun role 2 — one shot at D 0.95, the highest single hit in the catalogue, sitting at the top of the upkeep ladder as the cost curve intends." },
  { index: 21, name: "Farpiece", style: "gun", role: 3, damage: 0.77, bandPct: 15.6, hands: 1, note: "Gun role 3 — longest reach of any weapon: D 0.77 plus the free opening shot for one cartridge." },
  { index: 22, name: "Hailshot", style: "gun", role: 4, damage: 0.32, bandPct: 24.0, hands: 1, note: "Gun role 4 — spread: three pellets at D 0.32, three cartridges an attack and band +/-24%, which makes it the most expensive weapon in the game to fire." },
  { index: 23, name: "Threadsight", style: "gun", role: 5, damage: 0.74, bandPct: 8.0, hands: 1, note: "Gun role 5 — 35% crit at D 0.74, band +/-8%, one cartridge; the gun line's cheapest route into an over-tier spawn." },
  { index: 24, name: "Wardgrip", style: "gun", role: 6, damage: 0.59, bandPct: 17.2, hands: 1, note: "Gun role 6 — one-handed sidearm: D 0.59 with the offhand free, and like every gun it exists only across tiers 6-18." },
];

export const ARCHETYPE_BY_NAME = new Map(ARCHETYPES.map((a) => [a.name, a]));

export function archetypesFor(style: Style): Archetype[] {
  return ARCHETYPES.filter((a) => a.style === style);
}

/**
 * The style wheel: melee closes on ranged, ranged interrupts magic, magic wards
 * off gunfire, gunfire pierces plate. Four styles in a cycle, so no style is
 * merely safe.
 */
export const BEATS: Record<Style, Style> = {
  melee: "ranged",
  ranged: "magic",
  magic: "gun",
  gun: "melee",
};

export type WheelResult = "advantage" | "neutral" | "disadvantage";

export function wheel(attacker: Style, defender: Style): WheelResult {
  if (BEATS[attacker] === defender) return "advantage";
  if (BEATS[defender] === attacker) return "disadvantage";
  return "neutral";
}
