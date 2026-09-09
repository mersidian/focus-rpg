/**
 * The dashboard's marks (SPEC-V1.md §9).
 *
 * Plain inline SVG rather than a charting library: the shapes here are simple,
 * and it keeps the page free of a runtime that would have to be themed twice.
 *
 * Single-series charts are drawn in the tier the character has earned, which is
 * the app's one accent (§8) and needs no legend, because the heading names it.
 *
 * The per-project series used to be six fixed hex values, chosen for contrast
 * and colour-vision deficiency. They were defensible on their own and wrong
 * beside the rest of the app: at chroma ~0.12 they out-saturated the earned
 * accent for the first twelve tiers, so a Drifter's dashboard was a grey
 * heading over a chart in six loud colours — the illustration shouting over the
 * hierarchy §8 says carries the page.
 *
 * Six distinguishable hues cannot all be quieter than a Drifter's 0.058, so the
 * encoding changed rather than the saturation. This is a lightness ramp on the
 * hue the character has earned: it reads as one system, a ramp is inherently
 * safe for colour-vision deficiency, and it says the right thing — a project
 * with more hours in it is *more* of what you have earned. The ramp needs its
 * legend, which the dashboard already draws, and the 2px gaps between segments
 * do the separation the old adjacent-pair check was for.
 */

/** How much of the earned accent each rank keeps, mixed toward the surface. */
export const SERIES_MIX = [100, 82, 64, 48, 34, 22] as const;

/** Anything past the sixth project folds in here rather than inventing a step. */
export const OTHER_COLOR = "var(--color-rule)";

export function seriesColor(index: number): string {
  const mix = SERIES_MIX[index];
  if (mix === undefined) return OTHER_COLOR;
  return `color-mix(in oklch, var(--tier) ${mix}%, var(--color-lift))`;
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
  /*
   * The box still stretches to the container, because a bar chart that keeps
   * its aspect ratio letterboxes itself away from the edges and stops being a
   * chart of the width it was given.
   *
   * What the stretch used to break was the drawing inside it: `rx` turned into
   * an ellipse whose shape depended on the viewport, and a 1-unit stroke went
   * sub-pixel horizontally while staying 1px vertically. Both are fixed where
   * they happen — no corner radius on a bar this thin, and a non-scaling stroke
   * on the axis. Bar *density* is a different problem and belongs to the
   * caller: 120 bars in 327px is texture whatever the geometry does, so the
   * dashboard shows a phone the last four weeks instead.
   */
  const width = 1000;
  const slot = width / Math.max(1, bars.length);
  /*
   * Capped, so a sparse series reads as bars rather than as a wall. With one
   * week of history the weekly chart was a single slab across the full box —
   * which is exactly the chart a new user sees first.
   */
  const barWidth = Math.min(48, Math.max(1, slot - gap));

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
            // An empty slot keeps a 1px stub, so a quiet hour reads as an hour
            // with nothing in it rather than as absent from the chart.
            fill={bar.value > 0 ? color : "var(--color-rule)"}
          >
            <title>{bar.title}</title>
          </rect>
        );
      })}
      <line
        x1={0}
        y1={height}
        x2={width}
        y2={height}
        stroke={AXIS}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
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
        <line
          key={v}
          x1={0}
          y1={y(v)}
          x2={width}
          y2={y(v)}
          stroke={AXIS}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={path} fill="none" stroke="var(--tier)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {/* A circle in a box with preserveAspectRatio="none" renders as an
          oval whose shape depends on the viewport. A 2px-wide upright tick is
          the same mark at every width. */}
      {points.map((p, i) => (
        <rect
          key={p.label}
          x={x(i) - 1}
          y={y(p.value) - 5}
          width={2}
          height={10}
          fill="var(--tier)"
          vectorEffect="non-scaling-stroke"
        >
          <title>{p.title}</title>
        </rect>
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
