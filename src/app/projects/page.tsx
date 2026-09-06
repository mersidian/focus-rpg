import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { ProjectManager } from "@/components/ProjectManager";
import { listProjectDetails } from "@/lib/project-service";
import { loadState } from "@/lib/game-state";
import { describeLevel } from "@/lib/levels";
import { groupNumber, hours, tierAccent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [projects, state] = await Promise.all([
    listProjectDetails(session.user.id, true),
    loadState(session.user.id),
  ]);
  const info = describeLevel(state.level);
  const accent = tierAccent(info.hue, info.intensity);

  const live = projects.filter((p) => !p.archived);
  const totalMs = live.reduce((n, p) => n + p.focusedMs, 0);
  const biggest = live[0];

  return (
    <div style={{ "--tier": accent } as CSSProperties}>
      <Nav current="/projects" />
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-14 sm:px-10">
        {biggest && biggest.focusedMs > 0 ? (
          <>
            <h1 className="display text-5xl leading-[0.95] sm:text-6xl" style={{ color: accent }}>
              <span className="tnum" style={{ fontFamily: "var(--font-mono)" }}>
                {hours(biggest.focusedMs)}
              </span>{" "}
              on {biggest.name}
            </h1>
            <p className="mt-3 text-[13px] text-faint">
              Your largest of <span className="tnum text-dim">{live.length}</span>{" "}
              {live.length === 1 ? "project" : "projects"}, out of{" "}
              <span className="tnum text-dim">{hours(totalMs)}</span> across all of them.
            </p>
          </>
        ) : (
          <>
            <h1 className="display text-4xl sm:text-5xl">Projects</h1>
            <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-faint">
              Every session attaches to exactly one. Their hours are the number this app is
              really for.
            </p>
          </>
        )}

        <ProjectManager
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            sessions: p.sessions,
            abandons: p.abandons,
            focusedMs: p.focusedMs,
            firstSessionAt: p.firstSessionAt,
            lastSessionAt: p.lastSessionAt,
            archived: p.archived,
            mergedIntoName: p.mergedIntoName,
            rank: {
              index: p.rank.index,
              title: p.rank.title,
              hue: p.rank.hue,
              nextTitle: p.rank.nextTitle,
              nextHours: p.rank.nextHours,
              progress: p.rank.progress,
            },
          }))}
        />
      </main>
    </div>
  );
}
