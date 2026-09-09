"use client";

import { useState, useTransition } from "react";
import { wearTitle } from "@/lib/actions";
import { deviceId } from "@/lib/client/device";

/** Roughly a third of achievements carry a title you can wear instead (§5). */
export function TitlePicker({
  titles,
  worn,
  levelTitle,
}: {
  titles: { id: string; title: string }[];
  worn: string | null;
  levelTitle: string;
}) {
  const [current, setCurrent] = useState(worn);
  const [pending, startTransition] = useTransition();

  const pick = (id: string | null) => {
    setCurrent(id);
    startTransition(() => void wearTitle(id, deviceId()));
  };

  if (titles.length === 0) {
    return (
      <p className="mt-3 text-body leading-relaxed text-faint">
        No wearable titles yet. Around a third of the achievements carry one.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => pick(null)}
        disabled={pending}
        className="rounded-sm border px-3 py-2 text-body transition-colors disabled:opacity-50"
        style={{
          borderColor: current === null ? "var(--action)" : "var(--color-rule)",
          color: current === null ? "var(--action)" : undefined,
        }}
      >
        {levelTitle}
      </button>
      {titles.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => pick(t.id)}
          disabled={pending}
          className="rounded-sm border px-3 py-2 text-body transition-colors disabled:opacity-50"
          style={{
            borderColor: current === t.id ? "var(--action)" : "var(--color-rule)",
            color: current === t.id ? "var(--action)" : undefined,
          }}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}
