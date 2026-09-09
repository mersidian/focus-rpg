/**
 * Monster variants: a species archetype seen in a biome (SPEC-V2.md §7, §15.3).
 *
 * The spec asserts that an Ashen Wolf and a Rime Wolf "are not the same fight",
 * but the archetype fixes the wheel type and the biome was only ever giving tier,
 * flavour and a name — so as written, 1,800 monsters were ninety fights in twenty
 * coats of paint. `wheelStep` is what makes the sentence true.
 *
 * It rotates the variant's position on the style wheel by one step either way, so
 * the same species is weak to different things in different biomes. It is
 * derived, static, never rolled per spawn, and visible before the timer starts —
 * the decision belongs to preparation, and a roll would put it after.
 */
import { STYLES, type Style } from "./archetypes";
import { BIOMES, areaTier, AREAS_PER_BIOME, type Biome } from "./biomes";
import { SPECIES, speciesAt, type Species } from "./species";

export type WheelStep = -1 | 0 | 1;

export type Variant = {
  /** "{prefix} {species}" — Rime Wolf, Ashen Wolf. */
  name: string;
  species: Species;
  biome: Biome;
  tier: number;
  /** What the fight is actually weak to, after the biome's step. */
  style: Style;
  wheelStep: WheelStep;
};

/**
 * Derived from the species and the biome, never stored and never rolled. Even
 * spread across the three values, and stable: the same pair always gives the
 * same step, which is what lets a recompute reproduce a session.
 */
export function wheelStep(speciesIndex: number, biomeIndex: number): WheelStep {
  return ((speciesIndex + biomeIndex * 2) % 3) - 1 as WheelStep;
}

function shift(style: Style, step: WheelStep): Style {
  const at = STYLES.indexOf(style);
  return STYLES[(at + step + STYLES.length) % STYLES.length];
}

export function variantsIn(biome: Biome): Variant[] {
  const here = speciesAt(biome.tierLo, biome.tierHi);
  return here.map((s) => {
    const si = SPECIES.indexOf(s);
    const step = wheelStep(si, biome.index);
    return {
      name: `${biome.prefix} ${s.name}`,
      species: s,
      biome,
      tier: Math.min(Math.max(biome.tierLo, s.tierLo), biome.tierHi),
      style: shift(s.style, step),
      wheelStep: step,
    };
  });
}

/** Every monster in the game. ~1,800 of them, from ninety designs. */
export function allVariants(): Variant[] {
  return BIOMES.flatMap(variantsIn);
}

export type Area = {
  biome: Biome;
  /** 1-10 within the biome. */
  index: number;
  name: string;
  tier: number;
  roster: Variant[];
};

/**
 * Areas walk their biome's tier band, and each carries the slice of the biome's
 * roster that suits its own tier. Area 1 is the biome's floor, area 10 its
 * ceiling.
 */
export function areasIn(biome: Biome): Area[] {
  const roster = variantsIn(biome);
  return Array.from({ length: AREAS_PER_BIOME }, (_, i) => {
    const index = i + 1;
    const t = areaTier(biome, index);
    const here = roster.filter((v) => v.species.tierLo <= t && v.species.tierHi >= t);
    return {
      biome,
      index,
      name: `${biome.name} ${index}`,
      tier: t,
      roster: here.length > 0 ? here : roster,
    };
  });
}

export function allAreas(): Area[] {
  return BIOMES.flatMap(areasIn);
}
