"use client";

import { useState, useTransition } from "react";
import { pressOn, prestige } from "@/lib/actions";
import { deviceId } from "@/lib/client/device";
import { MAX_STARS, bonusPercent } from "@/lib/prestige";
import { groupNumber } from "@/lib/format";

/**
 * The one genuine either/or in the design, and it arrives about a thousand
 * hours in (§10). It is presented as a decision with two real answers, not as a
 * button with a confirmation.
 */
export function PrestigeChoice({
  stars,
  xp,
  levelTitle,
}: {
  stars: number;
  xp: number;
  levelTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const after = Math.min(stars + 1, MAX_STARS);

  const run = (work: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await work();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work.");
      }
    });

  return (
    <section className="mt-16 border-t border-rule pt-10">
      <h2 className="text-stat font-medium tracking-tight" style={{ color: "var(--tier)" }}>
        The choice
      </h2>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-dim">
        You are {levelTitle}. You can begin again as Drifter I and carry a star, or press on
        through Ascendant to Mythic — the names nobody who prestiges ever sees.
      </p>

      <div className="mt-8 grid gap-px overflow-hidden rounded-sm bg-rule sm:grid-cols-2">
        <div className="bg-ground p-6">
          <h3 className="text-[15px] text-text">Begin again</h3>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-faint">
            <li>
              Back to Drifter I. You give up{" "}
              <span className="tnum text-dim">{groupNumber(xp)}</span> XP.
            </li>
            <li>
              Every achievement, every lifetime hour and the whole log stay exactly as they
              are.
            </li>
            <li>
              <span style={{ color: "var(--tier)" }}>★{after}</span> beside your title, and{" "}
              <span className="tnum text-dim">+{bonusPercent(after)}%</span> XP on every
              session from now on.
            </li>
          </ul>

          {confirming ? (
            <div className="mt-6">
              <p className="text-[13px] leading-relaxed text-dim">
                This cannot be undone. Reset to Drifter I?
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => prestige(deviceId()))}
                  className="rounded-sm px-5 py-3 text-[15px] font-medium text-ground disabled:opacity-50"
                  style={{ backgroundColor: "var(--tier)" }}
                >
                  Reset and take the star
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-sm px-5 py-3 text-[15px] text-faint hover:text-dim disabled:opacity-50"
                >
                  Not yet
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="mt-6 rounded-sm border px-5 py-3 text-[15px] transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--tier)", color: "var(--tier)" }}
            >
              Prestige
            </button>
          )}
        </div>

        <div className="bg-ground p-6">
          <h3 className="text-[15px] text-text">Press on</h3>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-faint">
            <li>Keep your level and your XP. Nothing resets.</li>
            <li>
              Levels 51 to 100: Ascendant, Luminary, Paragon, Archon, Warden, Oracle,
              Sovereign, Demiurge, Eternal, Mythic.
            </li>
            <li>No star, no bonus. Mythic V is ten thousand hours away.</li>
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => pressOn(deviceId()))}
            className="mt-6 rounded-sm border border-rule px-5 py-3 text-[15px] text-dim transition-colors hover:text-text disabled:opacity-50"
          >
            Press on
          </button>
        </div>
      </div>

      {error && (
        <p
          className="mt-6 border-l-2 pl-4 text-[13px] text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
