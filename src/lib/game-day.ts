/**
 * The game day (SPEC.md §7).
 *
 * The day rolls over at 4am local time, so a 1am session still counts toward
 * the day the user thinks they are in. Everything downstream — the streak, the
 * heatmap, rest days, vacation — is bucketed by this and never by UTC midnight.
 *
 * Days are handled as "YYYY-MM-DD" strings rather than Date objects: they are
 * calendar facts, not instants, and a string cannot silently pick up a time.
 */

export const DAY_ROLLOVER_HOUR = 4;
export const DEFAULT_TIMEZONE = "Asia/Bangkok";

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    // en-CA renders as YYYY-MM-DD, which sorts and compares as a plain string.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, f);
  }
  return f;
}

/** The game day an instant belongs to. */
export function gameDay(at: number | Date, timeZone: string): string {
  const ms = at instanceof Date ? at.getTime() : at;
  return formatter(timeZone).format(ms - DAY_ROLLOVER_HOUR * 3_600_000);
}

/** Parsed as UTC noon, so day arithmetic never trips over an offset. */
function noon(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  return toDay(noon(day) + delta * 86_400_000);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to) - noon(from)) / 86_400_000);
}

/** 0 = Sunday, matching `Date.prototype.getDay`. */
export function weekdayOf(day: string): number {
  return new Date(noon(day)).getUTCDay();
}

/** Every day from `from` to `to` inclusive. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Calendar quarter of a day, e.g. "2026-Q3". Used for the vacation limit (§7). */
export function quarterOf(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
