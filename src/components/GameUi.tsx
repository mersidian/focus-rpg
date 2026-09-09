import type { ReactNode } from "react";

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
        <h2 className="text-[15px] text-text">{title}</h2>
        {aside && <p className="shrink-0 text-[12px] text-faint">{aside}</p>}
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
      <table className="w-full border-collapse text-[13px]">
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
        <p className="mt-2 text-[12px] text-faint">
          showing {rows.length} of {total}
        </p>
      )}
    </div>
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
  return <p className="mt-6 text-[13px] leading-relaxed text-faint">{children}</p>;
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
