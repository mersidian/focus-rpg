import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { listLog } from "@/lib/session-service";
import { loadState } from "@/lib/game-state";
import { describeLevel } from "@/lib/levels";
import { groupNumber, tierAccent } from "@/lib/format";
import { ABANDON_REASON_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export default async function LogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [entries, state] = await Promise.all([
    listLog(session.user.id, 200),
    loadState(session.user.id),
  ]);
  const info = describeLevel(state.level);
  const accent = tierAccent(info.hue, info.intensity);

  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = dayFormat.format(new Date(entry.startedAt));
    const bucket = days.get(key);
    if (bucket) bucket.push(entry);
    else days.set(key, [entry]);
  }

  return (
    <div style={{ "--tier": accent } as CSSProperties}>
      <Nav current="/log" />
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="display text-4xl sm:text-5xl">Session log</h1>

        {entries.length === 0 ? (
          <p className="mt-8 max-w-prose text-[15px] leading-relaxed text-dim">
            Nothing here yet. Finish a session and it lands at the top, with the project you
            tagged it to and whether you called it honest.
          </p>
        ) : (
          <div className="mt-10">
            {[...days.entries()].map(([day, rows]) => (
              <section key={day} className="mb-10">
                <h2 className="border-b border-rule pb-2 text-[13px] text-faint">{day}</h2>
                <ul>
                  {rows.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex gap-4 border-b border-rule py-4 text-[13px] last:border-0"
                    >
                      <span
                        aria-hidden
                        className="mt-[6px] h-2 w-[2px] shrink-0"
                        style={{
                          backgroundColor:
                            entry.status === "completed" ? accent : "var(--color-warn)",
                        }}
                      />
                      <span className="tnum w-12 shrink-0 text-faint">
                        {timeFormat.format(new Date(entry.startedAt))}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-text">
                          {entry.status === "completed" ? (
                            <>
                              <span className="tnum">{entry.plannedMinutes}</span> minutes
                              {entry.projectName && (
                                <span className="text-dim"> on {entry.projectName}</span>
                              )}
                              {entry.honest === false && (
                                <span className="text-faint"> — slacked</span>
                              )}
                            </>
                          ) : (
                            <span className="text-dim">
                              {ABANDON_REASON_LABEL[
                                entry.abandonReason ?? "gave_up"
                              ] ?? "Abandoned"}
                              <span className="text-faint">
                                {" "}
                                — <span className="tnum">{entry.plannedMinutes}</span> minute
                                session
                              </span>
                            </span>
                          )}
                        </p>
                        {entry.note && (
                          <p className="mt-1 leading-relaxed text-faint">{entry.note}</p>
                        )}
                        {entry.pauseCount > 0 && entry.status === "completed" && (
                          <p className="mt-1 text-faint">
                            <span className="tnum">{entry.pauseCount}</span>{" "}
                            {entry.pauseCount === 1 ? "pause" : "pauses"}
                          </p>
                        )}
                      </div>

                      <span
                        className="tnum shrink-0 self-start"
                        style={{
                          color:
                            entry.xpAwarded >= 0 ? "var(--color-dim)" : "var(--color-warn)",
                        }}
                      >
                        {entry.xpAwarded >= 0 ? "+" : "−"}
                        {groupNumber(Math.abs(entry.xpAwarded))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
