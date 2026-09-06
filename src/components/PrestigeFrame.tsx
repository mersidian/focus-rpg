/**
 * The prestige-tinted frame (§4.2). A hairline inset around the whole app that
 * only exists once a star has been earned, warming and brightening slightly per
 * star. It never touches layout and never covers anything — it is a border on
 * the world, not a decoration inside it.
 */
export function PrestigeFrame({ stars }: { stars: number }) {
  if (stars <= 0) return null;

  const intensity = Math.min(stars, 10) / 10;
  const line = `oklch(${0.72 + intensity * 0.1} ${0.09 + intensity * 0.06} 84)`;

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
