"use client";

import { useState, useTransition } from "react";
import {
  mergeProjectsAction,
  renameProjectAction,
  setProjectArchived,
} from "@/lib/actions";
import { hours as formatHours, groupNumber } from "@/lib/format";
import { PROJECT_TIERS } from "@/lib/projects";
import { seriesColor } from "@/components/Charts";

export type ProjectItem = {
  id: string;
  name: string;
  sessions: number;
  abandons: number;
  focusedMs: number;
  firstSessionAt: number | null;
  lastSessionAt: number | null;
  archived: boolean;
  mergedIntoName: string | null;
  rank: {
    index: number;
    title: string | null;
    hue: number | null;
    nextTitle: string | null;
    nextHours: number | null;
    progress: number;
  };
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ProjectManager({ projects }: { projects: ProjectItem[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<unknown>, after?: () => void) =>
    startTransition(async () => {
      try {
        await work();
        setError(null);
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work.");
      }
    });

  const live = projects.filter((p) => !p.archived);

  if (projects.length === 0) {
    return (
      <p className="mt-8 max-w-prose text-lead leading-relaxed text-dim">
        No projects yet. Every session is tagged to one when you log it, and the first tag
        you write creates it.
      </p>
    );
  }

  return (
    <div className="mt-10">
      {notice && <p className="mb-6 text-body text-dim">{notice}</p>}
      {error && (
        <p
          className="mb-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          {error}
        </p>
      )}

      <ul>
        {projects.map((project) => {
          /*
           * A project's rank is a step on the earned accent, not a hue of its
           * own. It used to be `oklch(0.74 0.12 hue)` — a fixed chroma above
           * every tier accent below Artisan, so three ranked projects sat in
           * saturated colour next to a character accent that was nearly grey.
           * The ramp is the same one the dashboard's series uses, so a project
           * looks the same on both screens.
           */
          const accent =
            project.rank.hue === null
              ? "var(--color-faint)"
              : seriesColor(Math.max(0, project.rank.index - 1));

          return (
            <li key={project.id} className="border-b border-rule py-6 last:border-0">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="mt-2 h-4 w-[3px] shrink-0"
                  style={{ backgroundColor: accent }}
                />

                <div className="min-w-0 flex-1">
                  {editing === project.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={80}
                        className="rounded-sm border border-rule bg-lift px-3 py-2 text-field"
                      />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => renameProjectAction(project.id, draft), () => setEditing(null))
                        }
                        className="rounded-sm px-4 py-2 text-body text-ground disabled:opacity-50"
                        style={{ backgroundColor: "var(--tier)" }}
                      >
                        Save name
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="px-2 py-2 text-body text-faint hover:text-dim"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-lead text-text">
                      {project.name}
                      {project.rank.title && (
                        <span className="ml-3 text-body" style={{ color: accent }}>
                          {project.rank.title}
                        </span>
                      )}
                      {project.archived && (
                        <span className="ml-3 text-body text-faint">
                          {project.mergedIntoName
                            ? `merged into ${project.mergedIntoName}`
                            : "retired"}
                        </span>
                      )}
                    </p>
                  )}

                  <p className="mt-2 text-body text-faint">
                    <span className="tnum text-dim">{formatHours(project.focusedMs)}</span>
                    {"  over  "}
                    <span className="tnum text-dim">{groupNumber(project.sessions)}</span>{" "}
                    {project.sessions === 1 ? "session" : "sessions"}
                    {project.lastSessionAt && (
                      <>
                        {"  ·  last on "}
                        <span className="tnum">
                          {dateFormat.format(new Date(project.lastSessionAt))}
                        </span>
                      </>
                    )}
                  </p>

                  {project.rank.nextTitle && (
                    <div className="mt-3 max-w-md">
                      <div className="h-px w-full bg-rule">
                        <div
                          className="h-px"
                          style={{
                            width: `${project.rank.progress * 100}%`,
                            backgroundColor: accent,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-note text-faint">
                        <span className="tnum">
                          {formatHours(
                            Math.max(
                              0,
                              project.rank.nextHours! * 3_600_000 - project.focusedMs,
                            ),
                          )}
                        </span>{" "}
                        to {project.rank.nextTitle}
                      </p>
                    </div>
                  )}

                  {!project.archived && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 text-body">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(project.id);
                          setDraft(project.name);
                          setMerging(null);
                        }}
                        className="py-2 text-faint underline underline-offset-4 hover:text-dim"
                      >
                        Rename
                      </button>
                      {live.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMerging(merging === project.id ? null : project.id);
                            setEditing(null);
                          }}
                          className="py-2 text-faint underline underline-offset-4 hover:text-dim"
                        >
                          Merge into…
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setProjectArchived(project.id, true))}
                        className="py-2 text-faint underline underline-offset-4 hover:text-dim disabled:opacity-40"
                      >
                        Retire
                      </button>
                    </div>
                  )}

                  {project.archived && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setProjectArchived(project.id, false))}
                      className="mt-4 text-body text-faint underline underline-offset-4 hover:text-dim disabled:opacity-40"
                    >
                      Bring back
                    </button>
                  )}

                  {merging === project.id && (
                    <div className="mt-4 rounded-sm border border-rule p-4">
                      <p className="text-body leading-relaxed text-dim">
                        Move all{" "}
                        <span className="tnum">{groupNumber(project.sessions)}</span> sessions
                        and{" "}
                        <span className="tnum">{formatHours(project.focusedMs)}</span> into
                        another project. {project.name} is retired, not deleted.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {live
                          .filter((p) => p.id !== project.id)
                          .map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  async () => {
                                    const r = await mergeProjectsAction(project.id, target.id);
                                    setNotice(
                                      `Moved ${r.moved} session${r.moved === 1 ? "" : "s"} from ${r.sourceName} into ${r.targetName}.`,
                                    );
                                  },
                                  () => setMerging(null),
                                )
                              }
                              className="rounded-sm border border-rule px-3 py-2 text-body text-dim transition-colors hover:text-text disabled:opacity-40"
                            >
                              {target.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-14 border-t border-rule pt-8">
        <h2 className="text-lead text-text">The project ladder</h2>
        <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-body text-faint">
          {PROJECT_TIERS.map((tier, i) => (
            <li key={tier.title} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-[3px]"
                style={{ backgroundColor: seriesColor(i) }}
              />
              {tier.title}
              <span className="tnum text-dim">{tier.hours} h</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
