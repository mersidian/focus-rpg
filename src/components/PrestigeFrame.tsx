/**
 * The prestige-tinted frame (§4.2). A hairline inset around the whole app that
 * only exists once a star has been earned, warming and brightening slightly per
 * star. It never touches layout and never covers anything — it is a border on
 * the world, not a decoration inside it.
 */
export function PrestigeFrame({ stars }: { stars: number }) {
  if (stars <= 0) return null;

  const intensity = Math.min(stars, 10) / 10;
  /*
   * Capped at 0.125 chroma. Prestige needs level 50, where the earned accent is
   * already past 0.15, so the frame can never out-colour the character wearing
   * it — which the old 0.09-to-0.15 ramp could at one star.
   */
  const line = `oklch(${0.72 + intensity * 0.1} ${(0.075 + intensity * 0.05).toFixed(3)} 84)`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${line} ${28 + intensity * 46}%, transparent)`,
      }}
    />
  );
}
