"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { SLACKED_XP_MULTIPLIER } from "@/lib/constants";
import { clock, groupNumber } from "@/lib/format";

const DRAFT_KEY = "focusrpg:draft";

type Draft = { projectId: string | null; newProjectName: string; note: string };

/**
 * Mandatory, roughly ten seconds, shown the moment a session completes (§6).
 * There is no skip: it is the only thing holding the numbers up (§10).
 */
export function ReportCard() {
  const { snapshot, report, pending, error } = useGame();
  const session = snapshot.awaitingReport!;
  const projects = snapshot.projects;

  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [newProjectName, setNewProjectName] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(projects.length === 0);
  const nameInput = useRef<HTMLInputElement>(null);

  /*
   * The draft survives a refresh mid-report, and it can only be read after
   * hydration. sessionStorage does not exist on the server, so a lazy
   * initialiser would render the defaults there and the restored draft here —
   * four inputs whose markup disagrees with what was sent. The effect is the
   * correct shape for this one: the state is editable, so a read-only store
   * cannot hold it, and the read has to happen after the first paint.
   */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`${DRAFT_KEY}:${session.id}`);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectId(d.projectId);
      setNewProjectName(d.newProjectName);
      setNote(d.note);
      if (d.newProjectName) setCreating(true);
    } catch {
      // No draft is fine.
    }
  }, [session.id]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `${DRAFT_KEY}:${session.id}`,
        JSON.stringify({ projectId, newProjectName, note } satisfies Draft),
      );
    } catch {
      // Nothing depends on the draft surviving.
    }
  }, [session.id, projectId, newProjectName, note]);

  useEffect(() => {
    if (creating) nameInput.current?.focus();
  }, [creating]);

  const chosen = creating ? newProjectName.trim().length > 0 : Boolean(projectId);
  const slackedXp = Math.round(session.xpAwarded * SLACKED_XP_MULTIPLIER);

  const send = (honest: boolean) => {
    if (!chosen || pending) return;
    try {
      sessionStorage.removeItem(`${DRAFT_KEY}:${session.id}`);
    } catch {
      // ignore
    }
    report({
      projectId: creating ? null : projectId,
      newProjectName: creating ? newProjectName.trim() : null,
      note,
      honest,
    });
  };

  return (
    <main className="mx-auto w-full max-w-2xl animate-rise px-6 pb-24 pt-16 sm:px-10">
      <p className="text-body text-faint">
        <span className="tnum">{session.plannedMinutes}</span> minutes done.
      </p>
      {/*
        Not the display face. .tnum on the numeral forces the mono family, so
        this line rendered "+250" in mono and "XP banked" in Fraunces — two
        faces in one heading, by accident. It is also a figure rather than a
        name, and §8 gives Fraunces one job. The moment is carried by size,
        the accent and animate-pop, which is what it was carried by anyway.
      */}
      <h1
        className="mt-2 text-title font-medium tracking-tight sm:text-hero"
        style={{ color: "var(--tier)" }}
      >
        <span className="tnum animate-pop inline-block">+{session.xpAwarded}</span> XP banked
      </h1>
      <p className="mt-3 max-w-prose text-body leading-relaxed text-faint">
        It stays banked once you log it. Nothing else in the app works until you do.
      </p>

      <section className="mt-10 border-t border-rule pt-8">
        <h2 className="text-lead text-text">What were you working on?</h2>

        {projects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map((p) => {
              const selected = !creating && projectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setProjectId(p.id);
                  }}
                  className="rounded-sm border px-3 py-2 text-body transition-colors"
                  style={{
                    borderColor: selected ? "var(--action)" : "var(--color-rule)",
                    color: selected ? "var(--action)" : undefined,
                  }}
                >
                  {p.name}
                  <span className="tnum ml-2 text-faint">{p.sessions}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-sm border border-dashed border-rule px-3 py-2 text-body text-faint transition-colors hover:text-dim"
              style={creating ? { borderColor: "var(--action)", color: "var(--action)" } : undefined}
            >
              New project
            </button>
          </div>
        )}

        {creating && (
          <input
            ref={nameInput}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Thesis, side project, guitar…"
            maxLength={80}
            className="mt-4 w-full rounded-sm border border-rule bg-lift px-4 py-3 text-field placeholder:text-faint"
          />
        )}
      </section>

      <section className="mt-8">
        <label htmlFor="note" className="text-lead text-text">
          Anything worth remembering?
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Optional."
          className="mt-3 w-full resize-none rounded-sm border border-rule bg-lift px-4 py-3 text-field leading-relaxed placeholder:text-faint"
        />
      </section>

      {snapshot.chain.windowMs !== null && snapshot.chain.links > 0 && (
        <p
          className="mt-8 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--tier)" }}
        >
          Log this and another session inside{" "}
          <span className="tnum">{clock(snapshot.chain.windowMs)}</span> pays{" "}
          <span className="tnum" style={{ color: "var(--tier)" }}>
            ×{snapshot.chain.multiplier.toFixed(1)}
          </span>
          {snapshot.chain.atCap
            ? " — the chain is as long as it goes."
            : ". Give up and it is back to the plain rate."}
        </p>
      )}

      <section className="mt-8 border-t border-rule pt-8">
        <h2 className="text-lead text-text">Did you actually focus?</h2>
        <p className="mt-2 text-body text-faint">
          Admitting you slacked costs this session{" "}
          <span className="tnum">{session.xpAwarded - slackedXp}</span> XP and nothing else. The
          honesty is the whole point.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={!chosen || pending}
            className="flex-1 rounded-sm px-6 py-4 text-lead font-medium text-ground transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--action)" }}
          >
            I focused — log {groupNumber(session.xpAwarded)} XP
          </button>
          <button
            type="button"
            onClick={() => send(false)}
            disabled={!chosen || pending}
            className="flex-1 rounded-sm border border-rule px-6 py-4 text-lead text-dim transition-colors hover:text-text disabled:opacity-40"
          >
            I slacked — log {groupNumber(slackedXp)} XP
          </button>
        </div>
        {!chosen && (
          <p className="mt-4 text-body text-faint">Pick a project first.</p>
        )}
        {error && (
          <p className="mt-4 text-body" style={{ color: "var(--color-warn)" }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
