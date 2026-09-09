/**
 * The dashboard's marks (SPEC-V1.md §9).
 *
 * Plain inline SVG rather than a charting library: the shapes here are simple,
 * and it keeps the page free of a runtime that would have to be themed twice.
 *
 * Single-series charts are drawn in the tier the character has earned, which is
 * the app's one accent (§8) and needs no legend, because the heading names it.
 * Only the per-project series carries identity, and that uses the fixed
 * categorical order below — validated for contrast, adjacent separation and
 * colour-vision deficiency against this app's surface.
 */

export const SERIES = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
] as const;

/** Anything past the sixth project folds in here rather than inventing a hue. */
export const OTHER_COLOR = "var(--color-rule)";

export function seriesColor(index: number): string {
  return index < SERIES.length ? SERIES[index] : OTHER_COLOR;
}

const AXIS = "var(--color-rule)";
const INK = "var(--color-faint)";

type Bar = { label: string; value: number; title: string };

/** Magnitude over time. One series, so the heading is the legend. */
export function BarChart({
  bars,
  height = 96,
  gap = 2,
  color = "var(--tier)",
  format,
}: {
  bars: Bar[];
  height?: number;
  gap?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const width = 1000;
  const slot = width / Math.max(1, bars.length);
  const barWidth = Math.max(1, slot - gap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 16}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label={`${bars.length} values, peak ${format ? format(max) : max}`}
    >
      {bars.map((bar, i) => {
        const h = (bar.value / max) * height;
        return (
          <rect
            key={bar.label}
            x={i * slot}
            y={height - Math.max(h, 1)}
            width={barWidth}
            height={Math.max(bar.value > 0 ? 1.5 : 1, h)}
            rx={Math.min(2, barWidth / 2)}
            // An empty slot keeps a 1px stub, so a quiet hour reads as an hour
            // with nothing in it rather than as absent from the chart.
            fill={bar.value > 0 ? color : "var(--color-rule)"}
          >
            <title>{bar.title}</title>
          </rect>
        );
      })}
      <line x1={0} y1={height} x2={width} y2={height} stroke={AXIS} strokeWidth={1} />
    </svg>
  );
}

/** Composition over time: one stacked column per month. */
export function StackedBars({
  columns,
  keys,
  colorOf,
  labelOf,
  format,
}: {
  columns: { label: string; parts: Record<string, number> }[];
  keys: string[];
  colorOf: (key: string) => string;
  labelOf: (key: string) => string;
  format: (n: number) => string;
}) {
  const totals = columns.map((c) => keys.reduce((n, k) => n + (c.parts[k] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const height = 150;
  const width = 1000;
  const slot = width / Math.max(1, columns.length);
  const barWidth = Math.min(64, Math.max(6, slot - 10));

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 4}`}
      preserveAspectRatio="none"
      className="h-40 w-full"
      role="img"
      aria-label="Hours per project, by month"
    >
      {columns.map((column, i) => {
        let y = height;
        return (
          <g key={column.label}>
            {keys.map((key) => {
              const value = column.parts[key] ?? 0;
              if (value <= 0) return null;
              const h = (value / max) * height;
              y -= h;
              return (
                // A 2px gap keeps neighbouring segments from reading as one block.
                <rect
                  key={key}
                  x={i * slot + (slot - barWidth) / 2}
                  y={y + 1}
                  width={barWidth}
                  height={Math.max(1, h - 2)}
                  fill={colorOf(key)}
                >
                  <title>{`${column.label} — ${labelOf(key)}: ${format(value)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      <line x1={0} y1={height} x2={width} y2={height} stroke={AXIS} strokeWidth={1} />
    </svg>
  );
}

/** A ratio over time. */
export function LineChart({
  points,
  height = 110,
}: {
  points: { label: string; value: number; title: string }[];
  height?: number;
}) {
  const width = 1000;
  if (points.length === 0) return null;

  const x = (i: number) =>
    points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
  const y = (v: number) => height - v * height;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 8}`}
      className="h-28 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Completion ratio by month"
    >
      {[0.5, 1].map((v) => (
        <line key={v} x1={0} y1={y(v)} x2={width} y2={y(v)} stroke={AXIS} strokeWidth={1} />
      ))}
      <path d={path} fill="none" stroke="var(--tier)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={4} fill="var(--tier)">
          <title>{p.title}</title>
        </circle>
      ))}
    </svg>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; value?: string }[];
}) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px]" style={{ color: INK }}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color }}
          />
          <span className="text-dim">{item.label}</span>
          {item.value && <span className="tnum">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
