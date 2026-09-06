import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { BarChart, Legend, LineChart, StackedBars, seriesColor } from "@/components/Charts";
import { loadDashboard, listProjectDetails } from "@/lib/project-service";
import { loadState } from "@/lib/game-state";
import { loadPrestigeView } from "@/lib/prestige-service";
import { describeLevel, xpToNextRank } from "@/lib/levels";
import { measurePace, projectNextRank } from "@/lib/projection";
import { xpMultiplier } from "@/lib/prestige";
import { completionRatio, groupNumber, hours, tierAccent } from "@/lib/format";

export const dynamic = "force-dynamic";

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const minutes = (n: number) => (n >= 60 ? `${(n / 60).toFixed(1)} h` : `${Math.round(n)} min`);
const monthLabel = (m: string) => monthFormat.format(new Date(`${m}-01T12:00:00Z`));

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const [data, state, prestige, projects] = await Promise.all([
    loadDashboard(userId, 120),
    loadState(userId),
    loadPrestigeView(userId),
    listProjectDetails(userId),
  ]);

  const info = describeLevel(state.level);
  const accent = tierAccent(info.hue, info.intensity);

  const pace = measurePace(data.daily, 28);
  const projection = projectNextRank(
    xpToNextRank(state.xp, state.level),
    pace,
    data.today,
    xpMultiplier(prestige.stars),
  );

  const totalCompleted = data.completionTrend.reduce((n, m) => n + m.completed, 0);
  const totalAbandoned = data.completionTrend.reduce((n, m) => n + m.abandoned, 0);
  const overallRatio = completionRatio(totalCompleted, totalAbandoned);

  // Projects keep a fixed colour by identity, so a quiet month never repaints them.
  const ranked = projects.slice(0, 6);
  const colorFor = new Map(ranked.map((p, i) => [p.id, seriesColor(i)]));
  const nameFor = new Map(data.projectNames.map((p) => [p.id, p.name]));
  const seriesKeys = [...ranked.map((p) => p.id), "other"];

  const columns = data.projectSeries.map((month) => {
    const parts: Record<string, number> = {};
    for (const [id, mins] of Object.entries(month.byProject)) {
      const key = colorFor.has(id) ? id : "other";
      parts[key] = (parts[key] ?? 0) + mins;
    }
    return { label: monthLabel(month.month), parts };
  });
  const usesOther = columns.some((c) => (c.parts.other ?? 0) > 0);

  const empty = totalCompleted === 0;

  return (
    <div style={{ "--tier": accent } as CSSProperties}>
      <Nav current="/dashboard" />
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
        {empty ? (
          <>
            <h1 className="display text-4xl sm:text-5xl">Dashboard</h1>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-dim">
              Nothing to chart yet. Finish a few sessions and this fills with your daily and
              weekly hours, where your time goes, when you work best, and how close the next
              rank is.
            </p>
          </>
        ) : (
          <>
            {/* The headline is a sentence, not a chart: one number, in context. */}
            <h1 className="display text-4xl leading-tight sm:text-5xl">
              {projection.known ? (
                <>
                  <span className="tnum" style={{ color: accent, fontFamily: "var(--font-mono)" }}>
                    {projection.days}
                  </span>{" "}
                  {projection.days === 1 ? "day" : "days"} to{" "}
                  {describeLevel(state.level + 1).fullTitle}
                </>
              ) : projection.reason === "at_cap" ? (
                <>Mythic V. There is nothing above this.</>
              ) : (
                <>No pace to project from yet</>
              )}
            </h1>
            <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-faint">
              {projection.known ? (
                <>
                  At <span className="tnum text-dim">{minutes(pace.minutesPerDay)}</span> a day
                  over the last <span className="tnum">{pace.windowDays}</span> days — you
                  worked <span className="tnum text-dim">{pace.activeDays}</span> of them.
                  Around{" "}
                  <span className="tnum text-dim">
                    {longDate.format(new Date(`${projection.date}T12:00:00Z`))}
                  </span>
                  .
                </>
              ) : (
                <>The last four weeks have no finished sessions to measure a pace from.</>
              )}
            </p>

            <section className="mt-16">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] text-text">Every day, four months back</h2>
                <p className="text-[13px] text-faint">
                  <span className="tnum text-dim">
                    {minutes(data.daily.reduce((n, d) => n + d.minutes, 0))}
                  </span>{" "}
                  in all
                </p>
              </div>
              <div className="mt-5">
                <BarChart
                  bars={data.daily.map((d) => ({
                    label: d.day,
                    value: d.minutes,
                    title: `${dayFormat.format(new Date(`${d.day}T12:00:00Z`))} — ${
                      d.sessions
                    } session${d.sessions === 1 ? "" : "s"}, ${minutes(d.minutes)}${
                      d.abandons > 0 ? `, ${d.abandons} abandoned` : ""
                    }`,
                  }))}
                  format={minutes}
                />
              </div>
              <p className="mt-2 flex justify-between text-[12px] text-faint">
                <span className="tnum">
                  {dayFormat.format(new Date(`${data.daily[0].day}T12:00:00Z`))}
                </span>
                <span className="tnum">today</span>
              </p>
            </section>

            <section className="mt-14">
              <h2 className="text-[15px] text-text">By week</h2>
              <div className="mt-5">
                <BarChart
                  gap={3}
                  bars={data.weekly.map((w) => ({
                    label: w.week,
                    value: w.minutes,
                    title: `Week of ${dayFormat.format(
                      new Date(`${w.week}T12:00:00Z`),
                    )} — ${minutes(w.minutes)}`,
                  }))}
                  format={minutes}
                />
              </div>
            </section>

            <section className="mt-14">
              <h2 className="text-[15px] text-text">Where the hours went</h2>
              <div className="mt-5">
                <StackedBars
                  columns={columns}
                  keys={seriesKeys}
                  colorOf={(key) => (key === "other" ? "var(--color-rule)" : colorFor.get(key)!)}
                  labelOf={(key) => (key === "other" ? "Other projects" : nameFor.get(key) ?? "Untagged")}
                  format={minutes}
                />
              </div>
              <Legend
                items={[
                  ...ranked.map((p, i) => ({
                    label: p.name,
                    color: seriesColor(i),
                    value: hours(p.focusedMs),
                  })),
                  ...(usesOther
                    ? [{ label: "Other projects", color: "var(--color-rule)" }]
                    : []),
                ]}
              />
            </section>

            <section className="mt-14">
              <h2 className="text-[15px] text-text">When you work</h2>
              <div className="mt-5">
                <BarChart
                  gap={3}
                  height={80}
                  bars={data.byHour.map((n, hour) => ({
                    label: String(hour),
                    value: n,
                    title: `${String(hour).padStart(2, "0")}:00 — ${n} session${
                      n === 1 ? "" : "s"
                    }`,
                  }))}
                />
              </div>
              <p className="mt-2 flex justify-between text-[12px] text-faint">
                <span className="tnum">00:00</span>
                <span className="tnum">12:00</span>
                <span className="tnum">23:00</span>
              </p>
            </section>

            <section className="mt-14">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] text-text">Sessions you finished</h2>
                <p className="text-[13px] text-faint">
                  <span className="tnum text-dim">
                    {overallRatio === null ? "—" : `${Math.round(overallRatio * 100)}%`}
                  </span>{" "}
                  overall
                </p>
              </div>
              <div className="mt-5">
                <LineChart
                  points={data.completionTrend.map((m) => ({
                    label: m.month,
                    value: m.completed / Math.max(1, m.completed + m.abandoned),
                    title: `${monthLabel(m.month)} — ${m.completed} finished, ${
                      m.abandoned
                    } abandoned`,
                  }))}
                />
              </div>
              <p className="mt-2 text-[12px] text-faint">
                The upper rule is every session finished; the lower one is half of them.{" "}
                <span className="tnum">{groupNumber(totalAbandoned)}</span> abandoned in all.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
