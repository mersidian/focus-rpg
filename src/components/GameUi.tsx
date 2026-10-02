import Link from "next/link";
import type { ReactNode } from "react";
import { depthFill, depthInk, groupNumber } from "@/lib/format";
import { MAX_TIER } from "@/lib/game/tiers";
import { skillKindHue, wash } from "@/lib/palette";
import type { Step } from "@/lib/game/guide";
import { Icon, type IconName } from "./Icon";

/**
 * The handful of shapes every game screen needs, so ten pages do not each
 * invent their own table.
 */

export function Screen({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    /*
      animate-rise on the shell, so every screen has an entrance without a line
      of JavaScript. The keyframe already existed and was used in one place.
    */
    <main className="animate-rise mx-auto w-full max-w-6xl px-6 pb-24 pt-12 sm:px-10">
      {/*
        Plex Sans, not Fraunces. §8 gives the display face one job — "Fraunces
        sets the earned title and nothing else, so the name reads as a name" —
        and this h1 alone put it on all ten game screens. A face that appears on
        every heading cannot mark the one thing that was earned.
      */}
      <h1 className="text-title font-medium tracking-tight sm:text-hero">{title}</h1>
      {lead && <p className="mt-3 max-w-[62ch] text-lead text-dim">{lead}</p>}
      {children}
    </main>
  );
}

export function Block({
  title,
  aside,
  icon,
  href,
  flush = false,
  children,
}: {
  title: string;
  aside?: ReactNode;
  /**
   * The mark of the page this block summarises — and only that.
   *
   * A glyph beside every heading is decoration on every section, which says
   * nothing and costs a look each time. A block that condenses a whole screen
   * is different: the mark is the same one the sub-nav uses for that screen, so
   * it reads as "there is more of this through here" rather than as an
   * ornament, and `href` makes that literally true. Blocks with no page behind
   * them — the milestones, the history — get no mark, which is what keeps the
   * ones that have it meaning something.
   */
  icon?: IconName;
  href?: string;
  /** Drops the top margin, for a block that leads a column rather than follows one. */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={flush ? "" : "mt-12"}>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        {/*
          One link, not two. The mark and the words go to the same page, so
          wrapping them separately would put two targets with the same
          destination side by side — twice the tab stops and twice the
          announcement for one thing to do.
        */}
        <h2 className="min-w-0 text-lead font-medium text-text">
          {href ? (
            <Link href={href} className="group flex min-w-0 items-center gap-2.5">
              {icon && (
                <Icon
                  name={icon}
                  aria-hidden
                  className="size-[18px] shrink-0 text-faint transition-colors group-hover:text-dim"
                />
              )}
              <span className="truncate group-hover:underline group-hover:underline-offset-4">
                {title}
              </span>
            </Link>
          ) : (
            <span className="flex min-w-0 items-center gap-2.5">
              {icon && <Icon name={icon} aria-hidden className="size-[18px] shrink-0 text-faint" />}
              <span className="truncate">{title}</span>
            </span>
          )}
        </h2>
        {aside && <p className="shrink-0 text-note text-faint">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A table, and the truth about how much of it you are seeing.
 *
 * `total` exists because six screens sliced their rows and then printed the
 * unsliced count in the header beside them, so the heading contradicted the
 * body. A caller that truncates passes what it had; the footer says so. A
 * caller showing everything passes nothing and no footer appears.
 */
export function Rows({
  head,
  rows,
  total,
  words = [],
}: {
  head: string[];
  rows: ReactNode[][];
  total?: number;
  /**
   * Columns that hold words rather than figures.
   *
   * Every column but the first was set in the numeral face and pushed right,
   * which is correct for a column of numbers and made "reliable, rather than
   * whatever biome you visited" a right-aligned line of monospace. A column of
   * words reads from the left, in the face words are set in.
   */
  words?: number[];
}) {
  const hidden = total !== undefined && total > rows.length;
  // No rows means nothing to scroll to, whatever the column count.
  const wide = head.length > 4 && rows.length > 0;
  return (
    <div className="mt-4 overflow-x-auto">
      {/*
        A table that scrolls sideways with nothing to say so is a table with
        columns nobody finds. The hint is only worth showing where the columns
        actually run out of room, and only on the widths where they do.
      */}
      {wide && (
        <p className="mb-1 text-note text-faint sm:hidden" aria-hidden>
          scroll sideways for the rest →
        </p>
      )}
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={`border-b border-rule pb-2 pr-4 text-note font-normal text-faint last:pr-0 ${
                  i === 0
                    ? "sticky left-0 bg-ground text-left"
                    : words.includes(i)
                      ? "text-left"
                      : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`border-b border-rule py-2.5 pr-4 align-top last:pr-0 ${
                    i === 0
                      ? "sticky left-0 bg-ground text-text"
                      : words.includes(i)
                        ? "text-left text-dim"
                        : "tnum text-right text-dim"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden && (
        <p className="mt-2 text-note text-faint">
          showing {rows.length} of {total}
        </p>
      )}
    </div>
  );
}

/**
 * A ratio, said once.
 *
 * Four of the five figures in the overview's "Held" block are ratios — fuel
 * against its cap, slots used against slots owned, items found against the
 * catalogue, bosses down against bosses — and all four were rendered as
 * "1 234 / 5 678" in a two-column table, which is the one shape that makes a
 * proportion hard to read. A number tells you where you are; a bar tells you
 * how far along that is, and the pair together is the only reason to draw
 * either.
 */
export function Gauge({
  label,
  value,
  cap,
  note,
  tone = "tier",
}: {
  label: string;
  value: number;
  cap: number;
  note?: string;
  /** `full` marks a gauge that is meant to be emptied, like fuel. */
  tone?: "tier" | "full";
}) {
  const share = cap <= 0 ? 0 : Math.min(1, Math.max(0, value / cap));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-body text-dim">{label}</p>
        <p className="shrink-0 text-note text-faint">
          <span className="tnum text-dim">{groupNumber(value)}</span>
          <span className="tnum"> / {groupNumber(cap)}</span>
        </p>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-rule">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${share * 100}%`,
            backgroundColor: tone === "full" ? "var(--color-ice)" : "var(--tier)",
          }}
        />
      </div>
      {note && <p className="mt-1 text-note text-faint">{note}</p>}
    </div>
  );
}

/** Gauges sit in a grid, because a ratio is read against its neighbours. */
export function Gauges({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>;
}

/**
 * How deep a thing is, as a mark rather than a digit.
 *
 * Tier runs 1–24 and rarity 1–5, and both were text in a column of other text.
 * The mark is the earned accent diluted by depth (see `depthFill`), so a
 * tier-1 scrap barely lifts off the surface and a tier-24 piece is the full
 * colour — which is the same sentence the ladder itself makes.
 */
export function Depth({ step, steps, title }: { step: number; steps: number; title?: string }) {
  return (
    <span
      title={title}
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[1px] align-middle"
      style={{ backgroundColor: depthFill(step, steps) }}
    />
  );
}

/** A depth mark and its number, which is the pair every table row wanted. */
export function DepthValue({
  step,
  steps,
  label,
}: {
  step: number;
  steps: number;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Depth step={step} steps={steps} />
      <span className="tnum" style={{ color: depthInk(step, steps) }}>
        {label ?? step}
      </span>
    </span>
  );
}

/**
 * A mark in the colour of what a thing *is*, rather than how much of it there
 * is. See src/lib/palette.ts for why those are two different questions.
 *
 * The well is what makes it read as an object rather than a hairline: sixteen
 * pixels of 1.6px stroke on a dark ground is a smudge, and twenty-two of them
 * in a column is a smudge you scroll past.
 */
export function KindMark({
  name,
  hue,
  className = "",
  large = false,
}: {
  name: IconName;
  hue: string;
  className?: string;
  /** For the one mark on a screen that leads it. */
  large?: boolean;
}) {
  return (
    <span
      className={`inline-flex ${large ? "size-10" : "size-8"} shrink-0 items-center justify-center rounded-md ${className}`}
      style={{ backgroundColor: wash(hue, 18), color: hue }}
    >
      <Icon name={name} className={large ? "size-[22px]" : "size-[18px]"} />
    </span>
  );
}

/** A dot in a category's colour, where there is no room for a well. */
export function KindDot({ hue, title }: { hue: string; title?: string }) {
  return (
    <span
      title={title}
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full align-middle"
      style={{ backgroundColor: hue }}
    />
  );
}

/**
 * The catalogue as a shape, which is the one thing a twenty-four row table of
 * "found" and "total" could not be.
 *
 * Every column is a tier and every column carries its own depth colour, so it
 * says two things at once: how much of each tier you have seen, and how deep
 * the tiers you have seen at all go. A wall that stops halfway across is a
 * reader's own progress, drawn.
 */
export function TierBars({
  bars,
  height = 120,
  label,
}: {
  bars: { tier: number; got: number; total: number }[];
  height?: number;
  label: (b: { tier: number; got: number; total: number }) => string;
}) {
  const steps = bars.length;
  return (
    <div className="mt-4">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {bars.map((b) => {
          const share = b.total === 0 ? 0 : b.got / b.total;
          return (
            <div
              key={b.tier}
              title={label(b)}
              className="relative h-full flex-1 rounded-[1px]"
              style={{ backgroundColor: "var(--color-lift)" }}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-[1px]"
                style={{
                  height: `${share > 0 ? Math.max(2, share * 100) : 0}%`,
                  backgroundColor: depthFill(b.tier, steps),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-note text-faint">
        {bars.map((b) => (
          <span key={b.tier} className="tnum flex-1 text-center">
            {b.tier === 1 || b.tier % 6 === 0 ? b.tier : "\u00a0"}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A span of depth, for the things that cover a range rather than sit at one.
 *
 * A biome is "tiers 5 to 9" and an area inside it is one tier, so the two want
 * the same ink and different shapes — two marks with the range between them
 * reads as a band, and a reader can see one biome starting where the last
 * left off without comparing four digits.
 */
export function DepthRange({ lo, hi, steps }: { lo: number; hi: number; steps: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Tiers ${lo} to ${hi}`}>
      <Depth step={lo} steps={steps} />
      <span className="tnum" style={{ color: depthInk(hi, steps) }}>
        {lo}–{hi}
      </span>
      <Depth step={hi} steps={steps} />
    </span>
  );
}

/** A progress rail in the tier colour. Used for skills, plots and contracts. */
export function Rail({ progress }: { progress: number }) {
  return (
    <div className="mt-1.5 h-[3px] w-full rounded-full bg-rule">
      <div
        // Matching XpRail, which was the only one of the app's four rails that
        // moved. The others arrived already filled and looked like rules.
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          backgroundColor: "var(--tier)",
        }}
      />
    </div>
  );
}

/**
 * The ten slots, drawn as slots.
 *
 * This was a bar chart: ten bars on a hairline, each as tall as its tier, with
 * an empty slot as a baseline with nothing on it. It answered the gate's
 * question — which is shallowest — and lost the first one a player has, which
 * is what am I wearing and what is missing. Half this character's loadout was
 * empty and the drawing of it was five short bars and five absences.
 *
 * A slot holds one thing or visibly holds nothing, so it is a box with a mark
 * in it or a dashed outline. The tier is still on every one, and the shallowest
 * is still marked, because the gate still reads it.
 */
export type SlotView = {
  slot: string;
  /** 0 when empty. */
  tier: number;
  name?: string;
  style?: string;
  refine?: number;
  /** An offhand given up to a two-handed weapon: empty, and not a problem. */
  held?: boolean;
};

function slotMark(s: SlotView): IconName {
  if (s.slot === "weapon" && s.style) return (s.style === "gun" ? "gunplay" : s.style) as IconName;
  return "equipment";
}

/** Whether the gate is reading this slot as the weakest of an uneven set. */
function weakest(s: SlotView, all: SlotView[]): boolean {
  const worn = all.filter((x) => !x.held);
  const floor = Math.min(...worn.map((x) => x.tier));
  const deepest = Math.max(...worn.map((x) => x.tier));
  return !s.held && s.tier === floor && floor < deepest;
}

/** The compact rack: ten small slots, for a panel that summarises the loadout. */
export function SlotGrid({ slots, steps = MAX_TIER }: { slots: SlotView[]; steps?: number }) {
  return (
    <ul className="mt-4 grid grid-cols-5 gap-2">
      {slots.map((s) => {
        const filled = s.tier > 0;
        return (
          <li key={s.slot} className="min-w-0">
            <div
              className={`flex aspect-square flex-col items-center justify-center gap-1 ${
                filled ? "slot" : "slot-empty"
              }`}
              title={filled ? `${s.name ?? s.slot}, tier ${s.tier}` : `${s.slot}: empty`}
            >
              <Icon
                name={slotMark(s)}
                className="size-5"
                style={{ color: filled ? depthInk(s.tier, steps) : "var(--color-rule)" }}
              />
              <span
                className="tnum text-note leading-none"
                style={{
                  color: !filled
                    ? "var(--color-faint)"
                    : weakest(s, slots)
                      ? "var(--color-warn)"
                      : depthInk(s.tier, steps),
                }}
              >
                {filled ? `t${s.tier}` : s.held ? "held" : "empty"}
              </span>
            </div>
            <p className="mt-1.5 truncate text-center text-note text-faint">{s.slot}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The same ten at full size, each with whatever can be done to it.
 *
 * The equipment screen was a five-column table whose last column held two
 * underlined phrases. A piece of gear is an object with a few facts and a few
 * verbs, which is a slot with its buttons under it.
 */
export function SlotBoard({
  slots,
  detail,
  actions,
  empty,
  steps = MAX_TIER,
}: {
  slots: SlotView[];
  /** A line of facts under the name: the roll, the wear. */
  detail?: (s: SlotView) => ReactNode;
  actions?: (s: SlotView) => ReactNode;
  /** What an empty slot offers: the way to fill it. */
  empty?: (s: SlotView) => ReactNode;
  steps?: number;
}) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {slots.map((s) => {
        const filled = s.tier > 0;
        return (
          <li
            key={s.slot}
            className={`flex min-h-[9.5rem] flex-col p-3.5 ${filled ? "slot" : "slot-empty"}`}
          >
            <div className="flex items-center justify-between gap-2 text-note text-faint">
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  name={slotMark(s)}
                  className="size-4"
                  style={{ color: filled ? depthInk(s.tier, steps) : "var(--color-rule)" }}
                />
                {s.slot}
              </span>
              {filled && (
                <span
                  className="tnum"
                  style={{
                    color: weakest(s, slots) ? "var(--color-warn)" : depthInk(s.tier, steps),
                  }}
                >
                  tier {s.tier}
                </span>
              )}
            </div>
            {filled ? (
              <>
                <p className="mt-2 text-body leading-snug text-text">
                  {s.name}
                  {(s.refine ?? 0) > 0 && (
                    <span className="tnum" style={{ color: "var(--tier)" }}>
                      {" "}
                      +{s.refine}
                    </span>
                  )}
                </p>
                {detail && <p className="mt-1 text-note text-faint">{detail(s)}</p>}
                {actions && <div className="mt-auto flex flex-wrap gap-2 pt-3">{actions(s)}</div>}
              </>
            ) : (
              <>
                <p className="mt-2 text-body text-faint">
                  {s.held ? "Held by your two-handed weapon" : "Empty"}
                </p>
                {!s.held && empty && <div className="mt-auto pt-3">{empty(s)}</div>}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Ten of something, as ten marks.
 *
 * "3 / 10" is a fraction to read; ten squares with three lit is a thing to see,
 * and a column of them down a list shows where the open ground stops without
 * reading a single number.
 */
export function Pips({ lit, of = 10, label }: { lit: number; of?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={label ?? `${lit} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className="inline-block size-[7px] rounded-[1px]"
          style={{ backgroundColor: i < lit ? "var(--tier)" : "var(--color-rule)" }}
        />
      ))}
    </span>
  );
}

/**
 * The style wheel, which was two rows of a table reading "Strong against" and
 * "Weak to".
 *
 * Four styles in a cycle so that no style is merely safe — that is the whole
 * mechanic, and it is a shape. Drawn in canonical order rather than rotated to
 * start at yours: the relationship is one sentence away, and a wheel that
 * reorders itself between visits is a wheel nobody learns.
 *
 * Yours takes the earned accent and the rest stay dim, because "which is mine"
 * is the only categorical question here and one mark answers it. Giving each of
 * the four its own hue would be a second palette for a four-item list.
 */
export function StyleWheel({
  order,
  yours,
}: {
  order: string[];
  /** Null when no weapon is equipped, and then nothing is lit. */
  yours: string | null;
}) {
  return (
    <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-lead">
      {order.map((style, i) => (
        <span key={style} className="inline-flex items-baseline gap-2">
          {i > 0 && (
            <span className="text-faint" aria-hidden>
              ▸
            </span>
          )}
          <span
            className={style === yours ? "font-medium" : "text-faint"}
            style={style === yours ? { color: "var(--tier)" } : undefined}
          >
            {style}
          </span>
        </span>
      ))}
      {/* The cycle closing back on itself, which is what makes it a wheel
          rather than a ladder with a best end. */}
      <span className="text-faint" aria-hidden>
        ▸ {order[0]}
      </span>
    </p>
  );
}

/**
 * The route: what to do next, most pressing first.
 *
 * The first step is set at headline size because it is a different kind of
 * thing from the rest — the answer to "what now" rather than an entry in a
 * list — and it carries the screen's one filled button, named for where it
 * goes. The others are the horizon: a row each, the whole row a link.
 *
 * No label above it and no arrow after it. "Make a weapon" at twenty-eight
 * pixels does not need to be introduced as the next thing.
 */
export function StepList({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null;
  const [first, ...rest] = steps;
  return (
    <div>
      <Link href={first.href} className="group flex items-start gap-4">
        <KindMark
          name={first.mark as IconName}
          hue={skillKindHue(first.kind)}
          className="mt-1"
          large
        />
        <div className="min-w-0 flex-1">
          <p className="text-head font-medium leading-tight tracking-tight text-text">
            {first.title}
          </p>
          <p className="mt-2 max-w-[58ch] text-body text-dim">{first.detail}</p>
          {first.progress && <StepRail progress={first.progress} />}
          <span
            className="mt-5 inline-flex rounded-sm px-4 py-2 text-body font-medium text-ground transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: "var(--action)" }}
          >
            Open {first.go.toLowerCase()}
          </span>
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="mt-8 border-t border-rule">
          {rest.map((step) => (
            <li key={step.key} className="border-b border-rule">
              <Link
                href={step.href}
                className="group -mx-3 flex items-start gap-3 rounded-md px-3 py-4 transition-colors hover:bg-lift/60"
              >
                <KindMark name={step.mark as IconName} hue={skillKindHue(step.kind)} />
                <div className="min-w-0 flex-1">
                  <p className="text-lead text-text">{step.title}</p>
                  <p className="mt-0.5 max-w-[58ch] text-body text-faint">{step.detail}</p>
                  {step.progress && <StepRail progress={step.progress} />}
                </div>
                <span className="mt-1 hidden shrink-0 text-note text-faint transition-colors group-hover:text-text sm:block">
                  {step.go}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepRail({ progress }: { progress: { have: number; need: number } }) {
  const share = progress.need <= 0 ? 0 : Math.min(1, Math.max(0, progress.have / progress.need));
  return (
    <div className="mt-3 flex max-w-md items-center gap-3">
      <div className="h-1 flex-1 rounded-full bg-rule">
        <div
          className="animate-hairline h-full rounded-full"
          style={{ width: `${share * 100}%`, backgroundColor: "var(--tier)" }}
        />
      </div>
      <span className="tnum shrink-0 text-note text-faint">
        {groupNumber(progress.have)} of {groupNumber(progress.need)}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-5 max-w-[62ch] text-body text-faint">{children}</p>;
}

/** A gate's verdict, rendered as a shopping list rather than a refusal. */
export function Gate({ open, missing }: { open: boolean; missing: string[] }) {
  if (open) return <span style={{ color: "var(--tier)" }}>open</span>;
  return (
    <span className="text-faint">
      needs {missing.join(", ")}
    </span>
  );
}
