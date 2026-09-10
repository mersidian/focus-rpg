import type { ReactNode } from "react";
import { depthFill, depthInk, groupNumber } from "@/lib/format";

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
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-lead text-text">{title}</h2>
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
  const wide = head.length > 4;
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
