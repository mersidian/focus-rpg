/**
 * What a unique actually does (SPEC-V2.md §9).
 *
 * The ~250 uniques exist to break the curve that the other 8,568 items obey, so
 * each one needs a modifier no generated item has. The honest problem is that a
 * modifier written as prose does nothing: it reads well in a wiki and fires
 * never.
 *
 * So an effect is either **typed** — one of the kinds below, which the engine
 * reads and applies — or explicitly `descriptive`, which means the name and the
 * intent exist but the engine does not yet implement it. Nothing pretends. The
 * wiki can show both, and a test asserts that every typed effect is one the
 * engine handles.
 */

export type Effect =
  /** Multiplies gathering yield. */
  | { kind: "yield"; pct: number; skill?: string }
  /** Multiplies the chance of a rare drop. */
  | { kind: "dropRate"; pct: number }
  /** Kill time falls, so a session fights more. */
  | { kind: "throughput"; pct: number }
  /** Offence rises. */
  | { kind: "offence"; pct: number }
  /** Defence rises, so failures cost fewer rations. */
  | { kind: "defence"; pct: number }
  /** Ammunition is not consumed on a killing blow. */
  | { kind: "freeAmmoOnKill" }
  /** Rations are never consumed. */
  | { kind: "freeRations" }
  /** Failed kills cost no durability. */
  | { kind: "freeDurability" }
  /** The style wheel's penalty does not apply. */
  | { kind: "ignoreWheelPenalty" }
  /** Adds links to the session chain. */
  | { kind: "chainLink"; links: number }
  /** Rolls the stat band twice and keeps the better. */
  | { kind: "rollTwice" }
  /** Extra bank slots. */
  | { kind: "bankSlots"; slots: number }
  /** Refinement costs fewer stones. */
  | { kind: "refineDiscount"; pct: number }
  /** Counts as a gathering tool this many tiers above itself. */
  | { kind: "asTool"; skill: string; tiersAbove: number }
  /** Extra character XP. */
  | { kind: "characterXp"; pct: number }
  /** Extra skill XP. */
  | { kind: "skillXp"; pct: number; skill?: string }
  /** Named, intended, and not implemented. Says so rather than lying. */
  | { kind: "descriptive"; text: string };

export type EffectKind = Effect["kind"];

/** The kinds the engine reads. Anything else is decoration and must say so. */
export const IMPLEMENTED: EffectKind[] = [
  "yield",
  "dropRate",
  "throughput",
  "offence",
  "defence",
  "freeAmmoOnKill",
  "freeRations",
  "freeDurability",
  "ignoreWheelPenalty",
  "chainLink",
  "rollTwice",
  "bankSlots",
  "refineDiscount",
  "asTool",
  "characterXp",
  "skillXp",
];

export function isImplemented(effect: Effect): boolean {
  return effect.kind !== "descriptive";
}

export function describeEffect(effect: Effect): string {
  switch (effect.kind) {
    case "yield":
      return `+${effect.pct}% yield${effect.skill ? ` from ${effect.skill}` : ""}`;
    case "dropRate":
      return `+${effect.pct}% rare drop chance`;
    case "throughput":
      return `+${effect.pct}% kill speed`;
    case "offence":
      return `+${effect.pct}% offence`;
    case "defence":
      return `+${effect.pct}% defence`;
    case "freeAmmoOnKill":
      return "ammunition is never spent on a killing blow";
    case "freeRations":
      return "rations are never consumed";
    case "freeDurability":
      return "failures cost no durability";
    case "ignoreWheelPenalty":
      return "the wrong style carries no penalty";
    case "chainLink":
      return `+${effect.links} chain link${effect.links === 1 ? "" : "s"}`;
    case "rollTwice":
      return "rolls its band twice and keeps the better";
    case "bankSlots":
      return `+${effect.slots} bank slots`;
    case "refineDiscount":
      return `refinement costs ${effect.pct}% fewer stones`;
    case "asTool":
      return `counts as a ${effect.skill} tool ${effect.tiersAbove} tiers above itself`;
    case "characterXp":
      return `+${effect.pct}% character XP`;
    case "skillXp":
      return `+${effect.pct}% ${effect.skill ?? "skill"} XP`;
    case "descriptive":
      return effect.text;
  }
}

/* --------------------------- reading a loadout ---------------------------- */

export type Modifiers = {
  yieldPct: number;
  dropRatePct: number;
  throughputPct: number;
  offencePct: number;
  defencePct: number;
  freeAmmoOnKill: boolean;
  freeRations: boolean;
  freeDurability: boolean;
  ignoreWheelPenalty: boolean;
  chainLinks: number;
  rollTwice: boolean;
  bankSlots: number;
  refineDiscountPct: number;
  characterXpPct: number;
  skillXpPct: number;
  toolBonus: Record<string, number>;
};

export function emptyModifiers(): Modifiers {
  return {
    yieldPct: 0,
    dropRatePct: 0,
    throughputPct: 0,
    offencePct: 0,
    defencePct: 0,
    freeAmmoOnKill: false,
    freeRations: false,
    freeDurability: false,
    ignoreWheelPenalty: false,
    chainLinks: 0,
    rollTwice: false,
    bankSlots: 0,
    refineDiscountPct: 0,
    characterXpPct: 0,
    skillXpPct: 0,
    toolBonus: {},
  };
}

/**
 * Fold a set of effects into one bundle.
 *
 * Percentages add rather than compound. Two +10% pieces are +20%, not +21% —
 * multiplicative stacking is how a build ends up a thousand times stronger than
 * the curve, and there is no combat depth here that would pay for the risk.
 */
export function foldEffects(effects: Effect[], skill?: string): Modifiers {
  const out = emptyModifiers();
  for (const effect of effects) {
    switch (effect.kind) {
      case "yield":
        if (!effect.skill || effect.skill === skill) out.yieldPct += effect.pct;
        break;
      case "dropRate":
        out.dropRatePct += effect.pct;
        break;
      case "throughput":
        out.throughputPct += effect.pct;
        break;
      case "offence":
        out.offencePct += effect.pct;
        break;
      case "defence":
        out.defencePct += effect.pct;
        break;
      case "freeAmmoOnKill":
        out.freeAmmoOnKill = true;
        break;
      case "freeRations":
        out.freeRations = true;
        break;
      case "freeDurability":
        out.freeDurability = true;
        break;
      case "ignoreWheelPenalty":
        out.ignoreWheelPenalty = true;
        break;
      case "chainLink":
        out.chainLinks += effect.links;
        break;
      case "rollTwice":
        out.rollTwice = true;
        break;
      case "bankSlots":
        out.bankSlots += effect.slots;
        break;
      case "refineDiscount":
        out.refineDiscountPct += effect.pct;
        break;
      case "asTool":
        out.toolBonus[effect.skill] = Math.max(out.toolBonus[effect.skill] ?? 0, effect.tiersAbove);
        break;
      case "characterXp":
        out.characterXpPct += effect.pct;
        break;
      case "skillXp":
        if (!effect.skill || effect.skill === skill) out.skillXpPct += effect.pct;
        break;
      case "descriptive":
        break;
    }
  }
  return out;
}
