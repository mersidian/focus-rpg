/** Formatting shared by server components and the browser. */

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Thin-space grouping keeps long XP figures readable in tabular numerals. */
export function groupNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
}

export function hours(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(ms / 60_000)} min`;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
}

export function completionRatio(completed: number, abandoned: number): number | null {
  const total = completed + abandoned;
  return total === 0 ? null : completed / total;
}

/**
 * The tier hue as an OKLCH accent. Early tiers are almost colourless and the
 * top of the ladder burns; the interface accent is the thing being earned (§8).
 */
export function tierAccent(hue: number, intensity: number, lightness = 0.74): string {
  const chroma = (0.02 + 0.155 * intensity).toFixed(3);
  return `oklch(${lightness} ${chroma} ${hue})`;
}
