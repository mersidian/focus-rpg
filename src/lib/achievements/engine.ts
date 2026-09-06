/**
 * Deciding what has been earned (SPEC.md §5).
 *
 * The Meta family counts other achievements, so one unlock can cause another —
 * earning a fiftieth unlocks "Fifty Earned", which may itself complete the Meta
 * family. The evaluation therefore runs to a fixed point rather than once.
 */

import { ACHIEVEMENTS, FAMILIES, type Achievement, type Family } from "./definitions";
import type { Stats } from "./stats";

const FAMILY_SIZE = new Map<Family, number>(
  FAMILIES.map((f) => [f, ACHIEVEMENTS.filter((a) => a.family === f).length]),
);

function metaCounters(unlocked: Set<string>) {
  const perFamily = new Map<Family, number>();
  let hiddenCount = 0;
  for (const id of unlocked) {
    const x = ACHIEVEMENTS.find((a) => a.id === id);
    if (!x) continue;
    perFamily.set(x.family, (perFamily.get(x.family) ?? 0) + 1);
    if (x.hidden) hiddenCount += 1;
  }
  let completeFamilies = 0;
  for (const [family, size] of FAMILY_SIZE) {
    if ((perFamily.get(family) ?? 0) >= size) completeFamilies += 1;
  }
  return { unlockedCount: unlocked.size, unlockedHidden: hiddenCount, completedFamilies: completeFamilies };
}

export function evaluate(stats: Stats, alreadyUnlocked: Iterable<string>): Achievement[] {
  const unlocked = new Set(alreadyUnlocked);
  const newly: Achievement[] = [];

  for (let pass = 0; pass < ACHIEVEMENTS.length; pass++) {
    const view: Stats = { ...stats, ...metaCounters(unlocked) };
    let changed = false;

    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.id)) continue;
      /**
       * Some achievements depend on a decision that does not exist yet —
       * "decline prestige and reach level 75" cannot be earned by someone who
       * was never offered the choice. They stay locked until Phase 4 builds it,
       * rather than firing on the half of the condition that is already true.
       */
      if (achievement.deferred) continue;
      let earned = false;
      try {
        earned = achievement.check(view);
      } catch {
        // A predicate must never be able to stop the rest from being judged.
        earned = false;
      }
      if (earned) {
        unlocked.add(achievement.id);
        newly.push(achievement);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return newly;
}

export function progressOf(unlocked: Set<string>) {
  return {
    ...metaCounters(unlocked),
    total: ACHIEVEMENTS.length,
    perFamily: Object.fromEntries(
      FAMILIES.map((f) => [
        f,
        {
          unlocked: ACHIEVEMENTS.filter((a) => a.family === f && unlocked.has(a.id)).length,
          total: FAMILY_SIZE.get(f) ?? 0,
        },
      ]),
    ),
  };
}
