"use client";

import { useState, useTransition } from "react";

type Outcome = { ok: true; note?: string } | { ok: false; reason?: string; missing?: string[] };

/**
 * One button for every game action.
 *
 * Every action returns the same shape — ok with a note, or not-ok with a reason
 * — so one component can speak for all of them, and a refusal always says what
 * is short rather than being a disabled button that does not explain itself.
 *
 * The result is shown next to the button and clears on the next press. Nothing
 * here is a toast: a refusal you might have missed is worse than one that sits
 * where you were looking.
 */
export function ActionButton({
  run,
  label,
  busyLabel = "…",
  disabled,
  quiet,
}: {
  run: () => Promise<Outcome>;
  label: string;
  busyLabel?: string;
  disabled?: boolean;
  /** Renders as plain text rather than a filled button, for lists. */
  quiet?: boolean;
}) {
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const press = () => {
    setOutcome(null);
    start(async () => {
      try {
        setOutcome(await run());
      } catch {
        setOutcome({ ok: false, reason: "That did not go through." });
      }
    });
  };

  const said = outcome
    ? outcome.ok
      ? outcome.note
      : (outcome.reason ?? (outcome.missing ? `needs ${outcome.missing.join(", ")}` : "no"))
    : null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={press}
        disabled={pending || disabled}
        className={
          quiet
            ? "text-[12px] text-faint underline underline-offset-2 transition-colors hover:text-dim disabled:opacity-40"
            : "rounded-sm px-3 py-1.5 text-[13px] font-medium text-ground transition-opacity disabled:opacity-50"
        }
        style={quiet ? undefined : { backgroundColor: "var(--action)" }}
      >
        {pending ? busyLabel : label}
      </button>
      {said && (
        <span
          className="text-[12px]"
          style={outcome?.ok ? { color: "var(--action)" } : { color: "var(--color-warn)" }}
        >
          {said}
        </span>
      )}
    </span>
  );
}
