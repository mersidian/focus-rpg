import type { IconName } from "./Icon";

/** Everything the mark chooser needs: the id says the line, the class the kind. */
export type MarkTarget = { id: string; cls: string; skill?: string; style?: string };

/**
 * Which of the fifty-six marks an item row wears.
 *
 * Tools take the mark of the skill they belong to, which already exists — a
 * pickaxe is the mining mark, an axe the woodcutting one — so eight of the
 * kinds cost nothing to add and read the same here as they do on the skills
 * page. The rest are drawn by line rather than by item: thirty tonics do not
 * want thirty glyphs, because no drawing distinguishes Deep Vein from Rich
 * Seam and pretending otherwise is decoration posing as information.
 */
export function markFor(row: MarkTarget): IconName {
  /*
   * Anything a skill makes wears that skill's mark, which covers three classes
   * without drawing anything: a pickaxe is the mining mark, a bar the smelting
   * one, a plank the fletching one. A weapon takes its combat style and armour
   * the equipment mark, so the only glyphs that had to be drawn are the ones
   * with no skill behind them.
   */
  if ((row.cls === "tool" || row.cls === "refined") && row.skill) return row.skill as IconName;
  if (row.cls === "weapon" && row.style) {
    return (row.style === "gun" ? "gunplay" : row.style) as IconName;
  }
  if (row.cls === "armour") return "equipment";
  if (row.cls === "raw") {
    /*
     * Raw lines mostly wear the skill that wins them — ore is a pickaxe, a
     * catch is a fish — but two would be lying about themselves. Gem and Herb
     * both come out of a skill whose mark is something else entirely, and a
     * gemstone drawn as a pickaxe is a mark that names the verb instead of the
     * noun.
     */
    const line = row.id.split(":")[1] ?? "";
    if (line === "Gem") return "flux";
    if (line === "Herb") return "herbseed";
    if (row.skill) return row.skill as IconName;
  }
  const line = row.id.split(":")[1] ?? "";
  if (row.cls === "ammo") {
    const map: Record<string, IconName> = {
      Arrow: "arrow",
      Bolt: "bolt",
      Dart: "dart",
      Rune: "rune",
      Cartridge: "cartridge",
      Shell: "shell",
    };
    return map[line] ?? "arrow";
  }
  if (row.cls === "consumable") {
    if (row.id.startsWith("ration:")) return "ration";
    return /Ward|Warded|Kindled|Still Water/.test(line) ? "ward" : "tonic";
  }
  if (row.cls === "stone") {
    return line === "Whetstone" ? "whetstone" : line === "Temper Salt" ? "temper" : "flux";
  }
  if (row.cls === "seed") {
    const map: Record<string, IconName> = {
      Herb: "herbseed",
      Fibre: "fibreseed",
      Sapling: "sapling",
      Stock: "stock",
    };
    return map[line] ?? "herbseed";
  }
  return "shop";
}
