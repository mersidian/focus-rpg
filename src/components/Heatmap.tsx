import { addDays, dayRange, weekdayOf } from "@/lib/game-day";
import { hours } from "@/lib/format";

export type HeatDay = {
  day: string;
  state: "active" | "frozen" | "rest" | "vacation" | "gap";
  completed: number;
  focusedMs: number;
};

/**
 * A year of game days (§9). Four states have to be told apart at a glance, and
 * the frozen one especially: a freeze that spent itself overnight must look
 * like neither a worked day nor a missed one (§7).
 *
 * Worked days are drawn in the tier the character has earned; frost is always
 * the same pale blue-white so it never collides with the current accent.
 */
export function Heatmap({ days, today }: { days: HeatDay[]; today: string }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const last = days.at(-1)?.day ?? today;
  // Pad back to a Sunday so every column is a full week.
  const first = addDays(days[0]?.day ?? today, -weekdayOf(days[0]?.day ?? today));

  const weeks: string[][] = [];
  const all = dayRange(first, last);
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-[3px]" style={{ minWidth: "min-content" }}>
        {weeks.map((week, column) => (
          <div key={week[0]} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <Cell
                key={day}
                day={day}
                entry={byDay.get(day)}
                isToday={day === today}
                /* A column at a time, left to right, so the year assembles
                   rather than appearing. Capped so the last week is not a
                   second late. */
                delayMs={Math.min(column * 7, 380)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({
  day,
  entry,
  isToday,
  delayMs,
}: {
  day: string;
  entry: HeatDay | undefined;
  isToday: boolean;
  delayMs: number;
}) {
  const state = entry?.state ?? "gap";
  const sessions = entry?.completed ?? 0;

  // Worked days deepen with the number of sessions rather than switching hue.
  const intensity = sessions === 0 ? 0 : Math.min(1, 0.42 + sessions * 0.16);

  const style: React.CSSProperties = {
    width: 11,
    height: 11,
    borderRadius: 2,
    animationDelay: `${delayMs}ms`,
  };
  let label: string;

  if (state === "active") {
    style.backgroundColor = "var(--tier)";
    style.opacity = intensity;
    label = `${sessions} session${sessions === 1 ? "" : "s"}, ${hours(entry?.focusedMs ?? 0)}`;
  } else if (state === "frozen") {
    style.backgroundColor = "oklch(0.86 0.04 232)";
    style.boxShadow = "inset 0 0 0 2px oklch(0.32 0.03 232)";
    label = "Freeze used — streak intact";
  } else if (state === "rest") {
    style.boxShadow = "inset 0 0 0 1px var(--color-rule)";
    style.backgroundColor = "transparent";
    label = "Rest day";
  } else if (state === "vacation") {
    style.backgroundColor = "var(--color-rule)";
    style.opacity = 0.55;
    label = "Vacation";
  } else {
    style.backgroundColor = "var(--color-lift)";
    label = "Nothing";
  }

  if (isToday) style.boxShadow = `${style.boxShadow ? style.boxShadow + ", " : ""}0 0 0 1px var(--color-dim)`;

  return (
    <div
      className={state === "frozen" ? "frost-in" : "cell-in"}
      style={style}
      title={`${day} — ${label}`}
      aria-label={`${day}, ${label}`}
    />
  );
}

export function HeatmapKey() {
  const items = [
    { label: "worked", style: { backgroundColor: "var(--tier)" } },
    {
      label: "freeze used",
      style: {
        backgroundColor: "oklch(0.86 0.04 232)",
        boxShadow: "inset 0 0 0 2px oklch(0.32 0.03 232)",
      },
    },
    { label: "rest day", style: { boxShadow: "inset 0 0 0 1px var(--color-rule)" } },
    { label: "vacation", style: { backgroundColor: "var(--color-rule)", opacity: 0.55 } },
    { label: "missed", style: { backgroundColor: "var(--color-lift)" } },
  ];
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-faint">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span style={{ width: 11, height: 11, borderRadius: 2, ...item.style }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
