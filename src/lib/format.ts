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

/**
 * How long ago, in the roughest terms that are still useful.
 *
 * Takes `now` rather than reading a clock, like every other rule in the app —
 * which is also what lets the report card render the same string on the server
 * and the client instead of flickering on hydration.
 *
 * Deliberately coarse. The picker wants to answer "is this the one I was just
 * on" and "have I touched this in a while"; a to-the-minute figure would be
 * more precise and no more useful.
 */
export function sinceLabel(then: number | null, now: number): string {
  if (then === null) return "not yet";
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function completionRatio(completed: number, abandoned: number): number | null {
  const total = completed + abandoned;
  return total === 0 ? null : completed / total;
}

/**
 * The tier hue as an OKLCH accent. Early tiers are almost colourless and the
 * top of the ladder burns; the interface accent is the thing being earned (§8).
 *
 * The chroma floor moved from 0.02 to 0.045 because the old curve took §8's
 * "a Drifter's app is nearly colourless" past nearly. At intensity 0.10 it
 * returned chroma 0.036, against --color-dim's 0.021 — indistinguishable. So
 * the sentence beside it, "hierarchy is carried by tier colour", had no colour
 * to carry anything with for the first several hours of use.
 */
export const ACCENT_FLOOR = 0.045;
export const ACCENT_RANGE = 0.13;

export function tierAccent(hue: number, intensity: number, lightness = 0.74): string {
  const chroma = accentChroma(intensity).toFixed(3);
  return `oklch(${lightness} ${chroma} ${hue})`;
}

export function accentChroma(intensity: number): number {
  return ACCENT_FLOOR + ACCENT_RANGE * intensity;
}

/**
 * The same hue, at the minimum chroma a control needs to read as a control.
 *
 * Decoration and function want different things from the same colour. A rail,
 * a rank title and a chart mark are describing what you have earned, so at the
 * bottom of the ladder they should be pale — that is the point. But the Start
 * button, the focus ring, the selection highlight and a chosen chip are doing a
 * job, and at chroma 0.036 the primary action on the home screen read as a
 * disabled grey slab. The accessibility floor was worst exactly when the user
 * was newest.
 *
 * So the floor applies only where colour carries meaning the user has to act
 * on. Three properties keep it honest: it bites only for the first five tiers
 * and converges with the decorative curve at Artisan, so the accent still
 * visibly grows across the whole ladder; it never exceeds tierAccent, so it
 * cannot become a second, louder palette; and the hue is still entirely earned
 * — only the minimum ink is guaranteed.
 */
export const ACTION_FLOOR = 0.11;

export function tierAction(hue: number, intensity: number, lightness = 0.74): string {
  const chroma = Math.max(ACTION_FLOOR, accentChroma(intensity)).toFixed(3);
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/**
 * Depth, drawn in the colour that was already earned.
 *
 * The game's spine is 24 tiers and a five-step rarity table, and both appeared
 * on screen only as a digit — so ten screens of otherwise identical rows gave
 * a reader nothing to sort by at a glance. The obvious fix is a palette, and
 * §8 forbids one: nothing but the tier accent may be saturated.
 *
 * `seriesColor` in Charts.tsx had already answered this for the dashboard's
 * projects — mix the earned accent toward the surface and you get as many
 * distinguishable steps as you need, all of them the same hue, none of them
 * able to out-colour the accent because they *are* the accent, diluted. Its
 * note says the rest: safe for colour-vision deficiency, and it says the right
 * thing, because more of what you earned means more of the colour you earned.
 *
 * Two of them, because ink and fill want different floors. A fill sits on a
 * surface and may fade into it at tier 1 — that is the point. Text may not, so
 * it dilutes toward --color-dim and stays body copy at its palest.
 */
const DEPTH_FLOOR_FILL = 16;
const DEPTH_FLOOR_INK = 34;

function depthPercent(step: number, steps: number, floor: number): number {
  if (steps <= 1) return 100;
  const t = Math.min(Math.max(step - 1, 0), steps - 1) / (steps - 1);
  return Math.round(floor + (100 - floor) * t);
}

/** For a bar, a dot or a swatch: may fade into the surface at the shallow end. */
export function depthFill(step: number, steps: number): string {
  return `color-mix(in oklch, var(--tier) ${depthPercent(step, steps, DEPTH_FLOOR_FILL)}%, var(--color-lift))`;
}

/** For a numeral or a label: never paler than the body colour it sits among. */
export function depthInk(step: number, steps: number): string {
  return `color-mix(in oklch, var(--tier) ${depthPercent(step, steps, DEPTH_FLOOR_INK)}%, var(--color-dim))`;
}
