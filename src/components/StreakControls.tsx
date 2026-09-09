"use client";

import { useState, useTransition } from "react";
import {
  buyFreeze,
  cancelVacation,
  declareVacation,
  setCalendarSettings,
  setRestDays,
} from "@/lib/actions";
import { deviceId } from "@/lib/client/device";
import { WEEKDAY_NAMES } from "@/lib/game-day";
import { FREEZE_PURCHASE_XP, MAX_REST_DAYS, MAX_VACATION_DAYS } from "@/lib/streak-engine";
import { groupNumber } from "@/lib/format";

type Vacation = { id: string; startDay: string; endDay: string; quarter: string };

export function StreakControls({
  restWeekdays,
  vacations,
  xp,
  canBuy,
  today,
  birthday,
}: {
  restWeekdays: number[];
  vacations: Vacation[];
  xp: number;
  canBuy: boolean;
  today: string;
  birthday: string | null;
}) {
  const [rest, setRest] = useState(restWeekdays);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [birth, setBirth] = useState(birthday ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await work();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work.");
      }
    });

  const toggleDay = (d: number) => {
    const next = rest.includes(d) ? rest.filter((x) => x !== d) : [...rest, d];
    if (next.length > MAX_REST_DAYS) return;
    setRest(next);
    run(() => setRestDays(next, deviceId()));
  };

  return (
    <div className="mt-16 space-y-14">
      <section>
        <h2 className="text-lead text-text">Buy a freeze</h2>
        <p className="mt-2 max-w-prose text-body leading-relaxed text-faint">
          <span className="tnum">{FREEZE_PURCHASE_XP}</span> XP for one banked day. Levels
          ratchet, so spending XP can never cost you a rank — only delay the next one.
        </p>
        <button
          type="button"
          disabled={!canBuy || pending}
          onClick={() => run(() => buyFreeze(deviceId()))}
          className="mt-4 rounded-sm border border-rule px-5 py-3 text-lead text-dim transition-colors hover:text-text disabled:opacity-40"
        >
          Buy a freeze for {groupNumber(FREEZE_PURCHASE_XP)} XP
        </button>
        {!canBuy && (
          <p className="mt-3 text-body text-faint">
            You have <span className="tnum">{groupNumber(xp)}</span> XP, or the bank is full.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lead text-text">Rest days</h2>
        <p className="mt-2 max-w-prose text-body leading-relaxed text-faint">
          Up to <span className="tnum">{MAX_REST_DAYS}</span> days a week that never break a
          streak and never spend a freeze.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {WEEKDAY_NAMES.map((name, d) => {
            const on = rest.includes(d);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleDay(d)}
                disabled={pending}
                aria-pressed={on}
                className="rounded-sm border px-3 py-2 text-body transition-colors disabled:opacity-50"
                style={{
                  borderColor: on ? "var(--action)" : "var(--color-rule)",
                  color: on ? "var(--action)" : undefined,
                }}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lead text-text">Vacation</h2>
        <p className="mt-2 max-w-prose text-body leading-relaxed text-faint">
          Up to <span className="tnum">{MAX_VACATION_DAYS}</span> days, declared in advance,
          once per calendar quarter. The streak stops entirely and no freezes are spent.
        </p>

        {vacations.length > 0 && (
          <ul className="mt-4 text-body">
            {vacations.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-4 border-b border-rule py-3 last:border-0"
              >
                <span className="tnum text-dim">
                  {v.startDay} to {v.endDay}
                </span>
                <span className="text-faint">{v.quarter}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => cancelVacation(v.id, deviceId()))}
                  className="ml-auto text-faint underline underline-offset-4 hover:text-warn disabled:opacity-40"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-body text-faint">
            From
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-field text-text"
            />
          </label>
          <label className="text-body text-faint">
            To
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-field text-text"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => declareVacation(start, end, deviceId()))}
            className="rounded-sm border border-rule px-5 py-2 text-field text-dim transition-colors hover:text-text disabled:opacity-40"
          >
            Declare vacation
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lead text-text">Your birthday</h2>
        <p className="mt-2 max-w-prose text-body leading-relaxed text-faint">
          One achievement waits for it. Thailand&rsquo;s public holidays are built in, so
          there is nothing else to keep here.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-body text-faint">
            Date
            <input
              type="date"
              value={birth}
              onChange={(e) => {
                setBirth(e.target.value);
                run(() =>
                  setCalendarSettings({ birthday: e.target.value || null }, deviceId()),
                );
              }}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-field text-text"
            />
          </label>
          <p className="pb-2 text-note text-faint">Only the day and month are read.</p>
        </div>

      </section>

      {error && (
        <p
          className="border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
