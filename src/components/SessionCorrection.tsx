"use client";

import { useState, useTransition } from "react";
import { correctSession } from "@/lib/actions";
import { deviceId } from "@/lib/client/device";
import { SLACKED_XP_MULTIPLIER } from "@/lib/constants";
import { groupNumber, hours, sinceLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/game-types";
import { UnlockToast } from "./UnlockToast";

type Project = {
  id: string;
  name: string;
  focusedMs: number;
  /** The last completed session on it, or null if there is none. */
  lastAt: number | null;
};

/**
 * Putting right a session that was tagged wrongly. Only what you said about it
 * can change — never its timing, which the server decided (§2).
 */
export function SessionCorrection({
  sessionId,
  projects,
  currentProjectName,
  currentNote,
  currentHonest,
  baseXp,
  now,
}: {
  sessionId: string;
  projects: Project[];
  currentProjectName: string | null;
  currentNote: string | null;
  currentHonest: boolean | null;
  baseXp: number;
  /**
   * The server's clock, handed down rather than read here, so the "3 days ago"
   * on a chip is the same string before and after hydration.
   */
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    projects.find((p) => p.name === currentProjectName)?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [note, setNote] = useState(currentNote ?? "");
  const [honest, setHonest] = useState(currentHonest !== false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Snapshot["unlocked"]>([]);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="py-1 text-note text-faint underline underline-offset-4 hover:text-dim"
        >
          Edit
        </button>
        {unlocked.length > 0 && <UnlockToast unlocked={unlocked} />}
      </>
    );
  }

  const chosen = creating ? newName.trim().length > 0 : Boolean(projectId);
  const slacked = Math.round(baseXp * SLACKED_XP_MULTIPLIER);

  const save = () =>
    startTransition(async () => {
      try {
        /*
         * The return value used to be dropped. correctSession deliberately
         * computes newly-unlocked achievements — calling a session honest after
         * the fact can earn one — so a correction could unlock something and
         * the app would say nothing at all about it.
         */
        const snap = await correctSession({
          sessionId,
          projectId: creating ? null : projectId,
          newProjectName: creating ? newName.trim() : null,
          note,
          honest,
          deviceId: deviceId(),
        });
        setError(null);
        setOpen(false);
        if (snap.unlocked.length > 0) setUnlocked(snap.unlocked);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not save.");
      }
    });

  return (
    <div className="mt-3 rounded-sm border border-rule p-4">
      <p className="text-body text-text">What was this session actually for?</p>

      <div className="mt-3 flex flex-wrap gap-2">
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
              className="rounded-sm border px-3 py-2 text-left text-body transition-colors"
              style={{
                borderColor: selected ? "var(--action)" : "var(--color-rule)",
                color: selected ? "var(--action)" : undefined,
              }}
            >
              {/* The same chip the report card shows, for the same reason: a
                  name alone does not say which of five projects this was. */}
              <span className="block">{p.name}</span>
              <span className="mt-0.5 block text-note text-faint">
                <span className="tnum">{hours(p.focusedMs)}</span>
                {" · "}
                {sinceLabel(p.lastAt, now)}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-sm border border-dashed border-rule px-3 py-2 text-body text-faint hover:text-dim"
          style={creating ? { borderColor: "var(--tier)", color: "var(--tier)" } : undefined}
        >
          New project
        </button>
      </div>

      {creating && (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={80}
          placeholder="Project name"
          className="mt-3 w-full rounded-sm border border-rule bg-lift px-3 py-2 text-field placeholder:text-faint"
        />
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Note (optional)"
        className="mt-3 w-full resize-none rounded-sm border border-rule bg-lift px-3 py-2 text-field leading-relaxed placeholder:text-faint"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setHonest(true)}
          className="rounded-sm border px-3 py-2 text-body transition-colors"
          style={{
            borderColor: honest ? "var(--tier)" : "var(--color-rule)",
            color: honest ? "var(--tier)" : undefined,
          }}
        >
          I focused — {groupNumber(baseXp)} XP
        </button>
        <button
          type="button"
          onClick={() => setHonest(false)}
          className="rounded-sm border px-3 py-2 text-body transition-colors"
          style={{
            borderColor: !honest ? "var(--tier)" : "var(--color-rule)",
            color: !honest ? "var(--tier)" : undefined,
          }}
        >
          I slacked — {groupNumber(slacked)} XP
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !chosen}
          className="rounded-sm px-4 py-2 text-body font-medium text-ground disabled:opacity-40"
          style={{ backgroundColor: "var(--tier)" }}
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-2 text-body text-faint hover:text-dim"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="mt-3 text-body" style={{ color: "var(--color-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
