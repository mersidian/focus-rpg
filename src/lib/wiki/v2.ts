/**
 * V2's figures, read from the code that owns them.
 *
 * This file used to hold hand-typed numbers, because V2 was a design and there
 * was nothing to read. Twice in one session a figure here went stale — a "21
 * skills" that had become 22, and a "~1,800 monsters" that measured at 709 the
 * moment a generator existed. Both were exactly the drift the wiki was built to
 * prevent, in the wiki itself.
 *
 * So nothing is typed here now. Every number is computed from the game modules,
 * which means the wiki cannot disagree with the game, and a config change to the
 * spine shows up on the page without anyone remembering to edit it.
 */
import { ARCHETYPES, STYLES } from "@/lib/game/archetypes";
import { BIOMES, BIOME_MATERIALS } from "@/lib/game/biomes";
import { generateCatalogue, catalogueBreakdown } from "@/lib/game/items";
import { MAX_REFINE, SLOTS } from "@/lib/game/power";
import { QUALITIES } from "@/lib/game/quality";
import { SKILLS } from "@/lib/game/skills";
import { PARTS, SPECIES } from "@/lib/game/species";
import { MAX_TIER, GUN_ENTRY_TIER } from "@/lib/game/tiers";
import { allAreas, allVariants } from "@/lib/game/variants";
import { BOSSES } from "@/lib/game/bosses";
import { UNIQUES } from "@/lib/game/uniques";
import { ACHIEVEMENTS_V2 } from "@/lib/achievements/definitions-v2";

export type V2Figures = {
  skills: number;
  items: number;
  itemsByClass: Record<string, number>;
  speciesArchetypes: number;
  monsters: number;
  parts: number;
  biomes: number;
  areas: number;
  biomeMaterials: number;
  styles: number;
  materialTiers: number;
  gunEntryTier: number;
  equipmentSlots: number;
  qualities: number;
  refinementMax: number;
  weaponArchetypes: number;
  bosses: number;
  uniquesNamed: number;
  achievementsV2: number;
};

export function v2Figures(): V2Figures {
  const catalogue = generateCatalogue();
  return {
    skills: SKILLS.length,
    items: catalogue.length,
    itemsByClass: catalogueBreakdown(),
    speciesArchetypes: SPECIES.length,
    monsters: allVariants().length,
    parts: PARTS.length,
    biomes: BIOMES.length,
    areas: allAreas().length,
    biomeMaterials: BIOME_MATERIALS.length,
    styles: STYLES.length,
    materialTiers: MAX_TIER,
    gunEntryTier: GUN_ENTRY_TIER,
    equipmentSlots: SLOTS.length,
    qualities: QUALITIES.length,
    refinementMax: MAX_REFINE,
    weaponArchetypes: ARCHETYPES.length,
    bosses: BOSSES.length,
    uniquesNamed: UNIQUES.length,
    achievementsV2: ACHIEVEMENTS_V2.length,
  };
}
