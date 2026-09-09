/**
 * The five qualities (SPEC-V2.md §8).
 *
 * Quality shifts the WINDOW a stat band sits in; it does not shift the roll
 * inside that band. Keeping the two apart is what lets an item card say "51
 * damage (42-58, 64%)" and have both halves mean something independently: the
 * window is what you were lucky enough to be handed, the percentile is how well
 * it rolled inside it.
 *
 * Weights are the drop distribution. Masterwork at 2% is rare enough that
 * finding one is an event, and common enough that it happens without being
 * hunted — roughly one in fifty drops across a session's worth of kills.
 */

export type Quality =
  | "crude"
  | "plain"
  | "fine"
  | "superior"
  | "masterwork";

export type QualityDef = {
  key: Quality;
  label: string;
  /** Multiplier on the band's centre. */
  window: number;
  /** Relative drop weight. */
  weight: number;
};

export const QUALITIES: QualityDef[] = [
  { key: "crude", label: "Crude", window: 0.85, weight: 30 },
  { key: "plain", label: "Plain", window: 1.0, weight: 40 },
  { key: "fine", label: "Fine", window: 1.12, weight: 20 },
  { key: "superior", label: "Superior", window: 1.25, weight: 8 },
  { key: "masterwork", label: "Masterwork", window: 1.4, weight: 2 },
];

export const QUALITY_BY_KEY = new Map(QUALITIES.map((q) => [q.key, q]));

export function quality(key: Quality): QualityDef {
  return QUALITY_BY_KEY.get(key) ?? QUALITIES[1];
}

/** Crafted items land at Plain; quality above that is found, not made. */
export const CRAFTED_QUALITY: Quality = "plain";
