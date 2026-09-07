"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { groupNumber } from "@/lib/format";

/**
 * Achievements arrive in a batch after a session is logged — a report can trip
 * several at once, including a Meta one caused by the others. They stack rather
 * than interrupting one at a time.
 */
export function UnlockToast() {
  const { snapshot } = useGame();
  const [shown, setShown] = useState(snapshot.unlocked);

  useEffect(() => {
    if (snapshot.unlocked.length > 0) setShown(snapshot.unlocked);
  }, [snapshot.unlocked]);

  if (shown.length === 0) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-6">
      <div className="mx-auto w-full max-w-md animate-rise rounded-sm border border-rule bg-lift p-5">
        <p className="text-[13px] text-faint">
          {shown.length === 1 ? "Achievement earned" : `${shown.length} achievements earned`}
        </p>
        <ul className="mt-3 space-y-3">
          {shown.map((x) => (
            <li key={x.id}>
              <p className="text-[15px]" style={{ color: "var(--tier)" }}>
                {x.name}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-faint">{x.description}</p>
              <p className="mt-1 text-[12px] text-faint">
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
          className="mt-4 text-[13px] text-faint underline underline-offset-4 hover:text-dim"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
