/**
 * The project ladder (SPEC.md §6).
 *
 * Deliberately shorter and differently named than the character's hundred
 * levels, so a project title is never mistaken for a rank: nobody confuses a
 * Grove with an Adept. A project under an hour has no title yet — it is not a
 * failure, it is just early, so the interface says the hours rather than
 * inventing a name for "nothing much".
 */

export type ProjectTier = {
  title: string;
  hours: number;
  /** Hue for the sprig of colour beside the name. */
  hue: number;
};

export const PROJECT_TIERS: ProjectTier[] = [
  { title: "Seedling", hours: 1, hue: 138 },
  { title: "Sapling", hours: 10, hue: 148 },
  { title: "Grove", hours: 50, hue: 158 },
  { title: "Landmark", hours: 200, hue: 88 },
  { title: "Monument", hours: 500, hue: 68 },
];

export type ProjectRank = {
  /** 0 before the first hour, then 1-5. */
  index: number;
  title: string | null;
  hue: number | null;
  /** Hours at which the current title was earned. */
  floorHours: number;
  /** Hours needed for the next title, or null at Monument. */
  nextHours: number | null;
  nextTitle: string | null;
  /** Progress toward the next title, 0-1. Returns 1 at Monument. */
  progress: number;
};

export function rankProject(focusedMs: number): ProjectRank {
  const hours = focusedMs / 3_600_000;

  let index = 0;
  for (let i = 0; i < PROJECT_TIERS.length; i++) {
    if (hours >= PROJECT_TIERS[i].hours) index = i + 1;
    else break;
  }

  const current = index === 0 ? null : PROJECT_TIERS[index - 1];
  const next = index < PROJECT_TIERS.length ? PROJECT_TIERS[index] : null;
  const floorHours = current?.hours ?? 0;

  const span = next ? next.hours - floorHours : 0;
  const progress = next === null ? 1 : span <= 0 ? 1 : Math.min(1, Math.max(0, (hours - floorHours) / span));

  return {
    index,
    title: current?.title ?? null,
    hue: current?.hue ?? null,
    floorHours,
    nextHours: next?.hours ?? null,
    nextTitle: next?.title ?? null,
    progress,
  };
}

/** Hours of focus still owed before the next project title. */
export function hoursToNextTier(focusedMs: number): number | null {
  const rank = rankProject(focusedMs);
  if (rank.nextHours === null) return null;
  return Math.max(0, rank.nextHours - focusedMs / 3_600_000);
}
