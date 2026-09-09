import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { listLog } from "@/lib/session-service";
import { listProjectDetails } from "@/lib/project-service";
import { SessionCorrection } from "@/components/SessionCorrection";
import { groupNumber } from "@/lib/format";
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

  const [entries, projects] = await Promise.all([
    listLog(session.user.id, 200),
    listProjectDetails(session.user.id),
  ]);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = dayFormat.format(new Date(entry.startedAt));
    const bucket = days.get(key);
    if (bucket) bucket.push(entry);
    else days.set(key, [entry]);
  }

  return (
    <>
      <Nav current="/log" />
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="text-title font-medium tracking-tight sm:text-hero">Session log</h1>

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
                      className="border-b border-rule py-4 text-body last:border-0"
                    >
                      <div className="flex gap-4">
                      <span
                        aria-hidden
                        className="mt-[6px] h-2 w-[2px] shrink-0"
                        style={{
                          backgroundColor:
                            entry.status === "completed" ? "var(--tier)" : "var(--color-warn)",
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
                        {/* Why this session paid what it did. The chain is
                            derived rather than stored, so this is worked out
                            from the sessions before it — and without it the XP
                            figure was a number with no account of itself. */}
                        {entry.status === "completed" && entry.chainLinks > 0 && (
                          <p className="mt-1 text-faint">
                            <span className="tnum" style={{ color: "var(--tier)" }}>
                              ×{entry.chainMultiplier.toFixed(2)}
                            </span>{" "}
                            chained — {entry.chainLinks} before it, on{" "}
                            <span className="tnum">{entry.plannedMinutes}</span> minutes
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
                      </div>

                      {/*
                        The editor is a sibling of the row, not a child of its
                        narrowest column. It used to render inside `min-w-0
                        flex-1`, which is about 189px at 375px and 157px inside
                        its own padding — and it has to hold every project as a
                        chip, a textarea, and two chips reading "I focused — 250
                        XP". Roughly 500px of controls in 157px, indented 66px
                        from the edge. Out here it has the full width.
                      */}
                      {entry.status === "completed" && (
                        <div className="mt-2 border-l-2 border-rule pl-4">
                          <SessionCorrection
                            sessionId={entry.id}
                            projects={projectOptions}
                            currentProjectName={entry.projectName}
                            currentNote={entry.note}
                            currentHonest={entry.honest}
                            baseXp={entry.baseXp > 0 ? entry.baseXp : entry.xpAwarded}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
