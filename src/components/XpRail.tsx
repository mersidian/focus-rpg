"use client";

import { describeLevel, rankProgress } from "@/lib/levels";
import { groupNumber } from "@/lib/format";
import { CountUp } from "./CountUp";

/**
 * Progress toward the next rank. A single hairline that fills — the same shape
 * as the session rail above the timer, so the two read as one system.
 */
export function XpRail({ xp, level }: { xp: number; level: number }) {
  const info = describeLevel(level);
  const progress = rankProgress(xp, level);
  const capped = info.nextXp === null;

  return (
    <div className="w-full">
      <div className="h-[2px] w-full bg-rule">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${progress * 100}%`, backgroundColor: "var(--tier)" }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-body text-faint">
        <span className="tnum text-dim">
          <CountUp value={xp} /> XP
        </span>
        {capped ? (
          <span>the ladder ends here</span>
        ) : (
          <span>
            <span className="tnum text-dim">{groupNumber(Math.max(0, info.nextXp! - xp))}</span> to{" "}
            {describeLevel(level + 1).fullTitle}
          </span>
        )}
      </div>
    </div>
  );
}
