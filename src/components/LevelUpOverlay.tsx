"use client";

import { useEffect } from "react";
import { useGame } from "./GameProvider";
import { describeLevel } from "@/lib/levels";
import { tierAccent } from "@/lib/format";

/**
 * Every rank-up is a full-screen moment; a tier change gets a bigger one,
 * because that is when the user's name actually changes (§4.1).
 */
export function LevelUpOverlay() {
  const { levelChange, dismissLevelChange } = useGame();

  useEffect(() => {
    if (!levelChange) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissLevelChange();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [levelChange, dismissLevelChange]);

  if (!levelChange) return null;

  const info = describeLevel(levelChange.to);
  const previous = describeLevel(levelChange.from);
  const accent = tierAccent(info.hue, info.intensity);
  const big = levelChange.tierChanged;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`New rank: ${info.fullTitle}`}
      onClick={dismissLevelChange}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-ground)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-pulse-tier"
        style={{ backgroundColor: accent }}
      />

      {/* A tier change gets a bloom out of the centre; a rank change does not. */}
      {big && (
        <div
          aria-hidden
          className="animate-bloom pointer-events-none absolute left-1/2 top-1/2 h-[42vmin] w-[42vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, transparent 68%)`,
          }}
        />
      )}

      <p className="relative text-body text-faint">
        {big ? "You have a new name." : "New rank."}
      </p>

      <h1
        className={`earned relative mt-4 overflow-hidden leading-[0.9] ${
          /* The only sizes in the app above the role scale, deliberately: this
             is the one full-screen moment, and it should be bigger than the
             largest thing on any ordinary page. */
          big ? "text-6xl sm:text-8xl" : "text-5xl sm:text-7xl"
        }`}
        style={{ color: accent }}
      >
        {/* The new name assembles letter by letter; the rank follows it in. */}
        {[...info.title].map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            className="letter"
            style={{ animationDelay: `${(big ? 55 : 26) * i}ms` }}
          >
            {letter}
          </span>
        ))}{" "}
        <span
          className="letter opacity-70"
          style={{
            fontVariationSettings: '"WONK" 1',
            animationDelay: `${(big ? 55 : 26) * info.title.length + 120}ms`,
          }}
        >
          {info.rank}
        </span>
        <span
          aria-hidden
          className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${accent} 26%, transparent), transparent)`,
          }}
        />
      </h1>

      <div
        aria-hidden
        className="animate-hairline relative mt-6 h-px w-40"
        style={{ backgroundColor: accent }}
      />

      <p className="relative mt-5 text-body text-faint">
        {previous.fullTitle} <span aria-hidden>→</span> {info.fullTitle}, level{" "}
        <span className="tnum text-dim">{info.level}</span>
      </p>

      <p className="relative mt-12 text-note text-faint">Click anywhere to carry on</p>
    </div>
  );
}
