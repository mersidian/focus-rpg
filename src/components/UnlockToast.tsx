"use client";

import { useEffect, useState } from "react";
import { useGameOptional } from "./GameProvider";
import type { Snapshot } from "@/lib/game-types";
import { groupNumber } from "@/lib/format";

/**
 * Achievements arrive in a batch after a session is logged — a report can trip
 * several at once, including a Meta one caused by the others. They stack rather
 * than interrupting one at a time.
 *
 * It takes its unlocks as a prop as well as from the provider, because the two
 * places that actually unlock things could not show it. /achievements judges
 * the whole board on arrival and threw the returned list away; correcting a
 * session in the log returns newly-unlocked achievements and its caller ignored
 * them. Neither route has a GameProvider, so the toast built for exactly those
 * moments could only ever appear on the timer.
 */
export function UnlockToast({ unlocked }: { unlocked?: Snapshot["unlocked"] }) {
  const game = useGameOptional();
  const incoming = unlocked ?? game?.snapshot.unlocked ?? [];
  const [shown, setShown] = useState(incoming);

  useEffect(() => {
    if (incoming.length > 0) setShown(incoming);
    // The identity of the array changes on every snapshot, so the length and
    // the first id are what actually mark a new batch.
  }, [incoming.length, incoming[0]?.id]);

  if (shown.length === 0) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-6">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto w-full max-w-md animate-rise rounded-sm border border-rule bg-lift p-5"
      >
        <p className="text-body text-faint">
          {shown.length === 1 ? "Achievement earned" : `${shown.length} achievements earned`}
        </p>
        <ul className="mt-3 space-y-3">
          {shown.map((x) => (
            <li key={x.id}>
              <p className="text-lead" style={{ color: "var(--tier)" }}>
                {x.name}
              </p>
              <p className="mt-1 text-body leading-relaxed text-faint">{x.description}</p>
              <p className="mt-1 text-note text-faint">
                <span className="tnum text-dim">+{groupNumber(x.xp)}</span> XP
                {x.freezes > 0 && (
                  <>
                    {" and "}
                    <span className="tnum text-dim">{x.freezes}</span>{" "}
                    freeze{x.freezes === 1 ? "" : "s"}
                  </>
                )}
                {x.title && <> — you can wear “{x.title}”</>}
              </p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShown([])}
          className="mt-4 text-body text-faint underline underline-offset-4 hover:text-dim"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
