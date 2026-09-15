import Link from "next/link";
import type { ReactNode } from "react";
import { depthFill, depthInk, groupNumber } from "@/lib/format";
import { MAX_TIER } from "@/lib/game/tiers";
import { wash } from "@/lib/palette";
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
    <main className="animate-rise mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      {/*
        Plex Sans, not Fraunces. §8 gives the display face one job — "Fraunces
        sets the earned title and nothing else, so the name reads as a name" —
        and this h1 alone put it on all ten game screens. A face that appears on
        every heading cannot mark the one thing that was earned.
      */}
      <h1 className="text-title font-medium tracking-tight sm:text-hero">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-body leading-relaxed text-dim">{lead}</p>}
      {children}
    </main>
  );
}

export function Block({
  title,
  aside,
  icon,
  href,
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
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        {/*
          One link, not two. The mark and the words go to the same page, so
          wrapping them separately would put two targets with the same
          destination side by side — twice the tab stops and twice the
          announcement for one thing to do.
        */}
        <h2 className="min-w-0 text-lead text-text">
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
}: {
  head: string[];
  rows: ReactNode[][];
  total?: number;
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
                className={`border-b border-rule pb-2 pr-4 font-medium text-faint last:pr-0 ${
                  i === 0 ? "sticky left-0 bg-ground text-left" : "text-right"
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
                  className={`border-b border-rule py-2 pr-4 align-top last:pr-0 ${
                    i === 0
                      ? "sticky left-0 bg-ground text-dim"
                      : "tnum text-right text-faint"
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
      <div className="mt-1.5 h-[3px] w-full bg-rule">
        <div
          className="h-full transition-[width] duration-700 ease-out"
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
}: {
  name: IconName;
  hue: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md ${className}`}
      style={{ backgroundColor: wash(hue, 18), color: hue }}
    >
      <Icon name={name} className="size-[18px]" />
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
    <div className="mt-1 h-[2px] w-full bg-rule">
      <div
        // Matching XpRail, which was the only one of the app's four rails that
        // moved. The others arrived already filled and looked like rules.
        className="h-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          backgroundColor: "var(--tier)",
        }}
      />
    </div>
  );
}

/**
 * The ten slots, as the thing the requirement gate actually reads.
 *
 * The overview used to say `Slots filled 7 / 10` and then, two lines below,
 * explain that "an empty slot counts as tier zero for the requirement gate, so
 * a missing cape can close an area". Both sentences are true and neither is
 * usable: a count cannot say WHICH slot, and which slot is the entire content
 * of the warning.
 *
 * So the loadout is drawn the way `TierBars` draws the catalogue — a bar per
 * slot, its height its tier against the deepest there is, in the depth colour
 * the rest of the app already reads as "how far down". The gate takes the
 * minimum across all ten, which means the gate reads the SHORTEST BAR, and a
 * shortest bar is a thing you find without counting. An empty slot is an empty
 * track, so it is shortest by construction and needs no separate treatment.
 *
 * No paper doll, no icon boxes: this is the same grammar as every other depth
 * in the app, on a baseline, in hairlines.
 */
export function SlotRack({
  slots,
  steps = MAX_TIER,
}: {
  /** In the game's own slot order. A tier of 0 means empty. */
  slots: { slot: string; tier: number }[];
  steps?: number;
}) {
  const floor = Math.min(...slots.map((s) => s.tier));
  const deepest = Math.max(...slots.map((s) => s.tier));
  return (
    /*
     * Scaled against the deepest tier there is, not against the deepest you
     * own. A rack that renormalised itself would make a full set of tier-1
     * scrap look exactly like a full set of tier-24 — and the number under each
     * bar is already the absolute reading, so the height is free to be the
     * comparison between the ten, which is the only comparison the gate makes.
     *
     * A drawn ceiling at tier 24 was tried here and cut: it is a rule, a label
     * and a band of empty space to say what the numerals underneath already say
     * exactly.
     */
    <div className="mt-5 grid grid-cols-5 gap-x-2 gap-y-5 sm:grid-cols-10">
      {slots.map((s) => {
        /*
         * A floor of 18%, not a proportional height.
         *
         * `TierBars` lets a shallow column fade into its track, which is right
         * when every column is present and depth is the only question. Here the
         * first question is whether a slot holds anything at all, and a tier-1
         * piece at a true 1/24 is four pixels of a colour `depthFill` has
         * already mixed 84% into the track — indistinguishable from empty,
         * which is the one distinction this rack exists to draw.
         */
        const share = s.tier <= 0 ? 0 : 0.18 + 0.82 * ((s.tier - 1) / Math.max(1, steps - 1));
        /*
         * Every slot sitting at the floor is marked, not just the first one
         * found — with three empty slots there is no single weakest link.
         *
         * And nothing is marked when they are all level: a uniform tier-7 set
         * is not ten problems, it is a finished set, and painting the whole
         * rack the warning colour would say the opposite.
         */
        const holds = s.tier === floor && floor < deepest;
        return (
          <div key={s.slot} className="min-w-0">
            <div
              /*
               * A bar standing on a hairline, and no track around it.
               *
               * A filled track reads a shallow tier as "nearly empty" rather
               * than "shallow", and boxing all ten turns a rack into ten cards
               * — which this app does not have anywhere, by rule. A baseline
               * with nothing on it is unambiguously an empty slot, and it is
               * the same hairline every other row in the app sits on.
               */
              className="flex h-10 w-full items-end border-b border-rule"
              title={s.tier > 0 ? `${s.slot} · tier ${s.tier}` : `${s.slot} · empty`}
            >
              <div
                className="w-full transition-[height] duration-700 ease-out"
                style={{
                  height: `${share * 100}%`,
                  backgroundColor: depthFill(s.tier, steps),
                }}
              />
            </div>
            <p className="mt-1.5 truncate text-note">
              {s.tier > 0 ? (
                <span
                  className="tnum"
                  style={{ color: holds ? "var(--color-warn)" : depthInk(s.tier, steps) }}
                >
                  t{s.tier}
                </span>
              ) : (
                <span className="tnum text-faint">—</span>
              )}
            </p>
            <p className="truncate text-note text-faint" title={s.slot}>
              {s.slot}
            </p>
          </div>
        );
      })}
    </div>
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-body leading-relaxed text-faint">{children}</p>;
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
