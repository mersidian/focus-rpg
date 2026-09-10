import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Heatmap, HeatmapKey } from "@/components/Heatmap";
import { StreakControls } from "@/components/StreakControls";
import { loadState } from "@/lib/game-state";
import {
  advanceStreak,
  listVacations,
  loadHeatmap,
} from "@/lib/streak-service";
import {
  FREEZE_CAP,
  FREEZE_PURCHASE_XP,
  FREEZE_METER_TARGET,
  meterProgress,
} from "@/lib/streak-engine";

export const dynamic = "force-dynamic";

export default async function StreakPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const advance = await advanceStreak(userId);
  const [state, heat, vacations] = await Promise.all([
    loadState(userId),
    loadHeatmap(userId, advance.today, advance.settings.timezone),
    listVacations(userId),
  ]);

  const s = advance.state;
  const meter = meterProgress({
    streak: s.streak,
    longestStreak: s.longestStreak,
    freezes: s.freezes,
    pendingFreezes: s.pendingFreezes,
    meter: s.meter,
    streakFreezesGranted: s.streakFreezesGranted,
    lastCountedDay: s.lastCountedDay,
    lastEvaluatedDay: s.lastEvaluatedDay,
  });
  const workedToday = s.lastCountedDay === advance.today;

  return (
    <>
      <Nav current="/streak" />
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="earned text-hero leading-[0.95] sm:text-[4.5rem]" style={{ color: "var(--tier)" }}>
          <span className="tnum" style={{ fontFamily: "var(--font-mono)" }}>
            {s.streak}
          </span>{" "}
          day{s.streak === 1 ? "" : "s"}
        </h1>
        <p className="mt-3 text-body leading-relaxed text-faint">
          {workedToday
            ? "Today is banked."
            : s.streak > 0
              ? "Today is still open. Any completed session keeps it."
              : "No streak yet. One completed session starts it."}
          {" The day turns over at 4am, "}
          {advance.settings.timezone.replace("_", " ")}.
        </p>

        {advance.frozeDays.length > 0 && (
          <p
            className="mt-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
            style={{ borderColor: "var(--color-ice)" }}
          >
            {advance.frozeDays.length === 1
              ? "Freeze used — streak intact, "
              : `${advance.frozeDays.length} freezes used — streak intact, `}
            <span className="tnum">{s.freezes}</span> left.
          </p>
        )}
        {advance.brokeOn && (
          <p
            className="mt-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
            style={{ borderColor: "var(--color-warn)" }}
          >
            The streak broke on <span className="tnum">{advance.brokeOn}</span>.
          </p>
        )}

        <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 border-t border-rule pt-6 text-body">
          <div>
            <dd className="tnum text-stat">{s.longestStreak}</dd>
            <dt className="mt-1 text-faint">longest run</dt>
          </div>
          <div>
            <dd className="tnum text-stat">
              {s.freezes}
              <span className="text-faint"> / {FREEZE_CAP}</span>
            </dd>
            <dt className="mt-1 text-faint">freezes banked</dt>
          </div>
          {s.pendingFreezes > 0 && (
            <div>
              <dd className="tnum text-stat">{s.pendingFreezes}</dd>
              <dt className="mt-1 text-faint">queued at cap</dt>
            </div>
          )}
          <div>
            <dd className="tnum text-stat">{Math.round(meter * 100)}%</dd>
            <dt className="mt-1 text-faint">toward the next freeze</dt>
          </div>
        </dl>

        <section className="mt-10">
          <div className="h-[2px] w-full bg-rule">
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{ width: `${meter * 100}%`, backgroundColor: "var(--color-ice)" }}
            />
          </div>
          <p className="mt-2 text-body text-faint">
            The Freeze Meter takes a fifth of every XP you earn.{" "}
            <span className="tnum text-dim">{Math.round(s.meter / 100)}</span> of{" "}
            <span className="tnum text-dim">{FREEZE_METER_TARGET / 100}</span> points.
          </p>
        </section>

        <section className="mt-16">
          <h2 className="text-lead text-text">The year</h2>
          <div className="mt-5">
            <Heatmap days={heat} today={advance.today} />
          </div>
          <HeatmapKey />
        </section>

        <StreakControls
          restWeekdays={advance.settings.restWeekdays}
          vacations={vacations.map((v) => ({
            id: v.id,
            startDay: v.startDay,
            endDay: v.endDay,
            quarter: v.quarter,
          }))}
          xp={state.xp}
          canBuy={state.xp >= FREEZE_PURCHASE_XP && s.freezes < FREEZE_CAP}
          today={advance.today}
          birthday={advance.settings.birthday}
        />
      </main>
    </>
  );
}
