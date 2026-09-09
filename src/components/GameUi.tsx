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
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-faint">{lead}</p>}
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

export function Rows({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={`border-b border-rule pb-2 pr-4 font-medium text-faint last:pr-0 ${
                  i === 0 ? "text-left" : "text-right"
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
                    i === 0 ? "text-dim" : "tnum text-right text-faint"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A progress rail in the tier colour. Used for skills, plots and contracts. */
export function Rail({ progress }: { progress: number }) {
  return (
    <div className="mt-1 h-[2px] w-full bg-rule">
      <div
        className="h-full"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, backgroundColor: "var(--tier)" }}
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
