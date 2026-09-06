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
import {
  knownThaiYears,
  lastKnownThaiYear,
  thaiHolidaysFor,
} from "@/lib/holidays/thailand";

type Vacation = { id: string; startDay: string; endDay: string; quarter: string };

export function StreakControls({
  restWeekdays,
  vacations,
  xp,
  canBuy,
  today,
  birthday,
  holidays,
}: {
  restWeekdays: number[];
  vacations: Vacation[];
  xp: number;
  canBuy: boolean;
  today: string;
  birthday: string | null;
  holidays: string[];
}) {
  const [rest, setRest] = useState(restWeekdays);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [birth, setBirth] = useState(birthday ?? "");
  const [days, setDays] = useState(holidays);
  const [newHoliday, setNewHoliday] = useState(today);
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
        <h2 className="text-[15px] text-text">Buy a freeze</h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
          <span className="tnum">{FREEZE_PURCHASE_XP}</span> XP for one banked day. Levels
          ratchet, so spending XP can never cost you a rank — only delay the next one.
        </p>
        <button
          type="button"
          disabled={!canBuy || pending}
          onClick={() => run(() => buyFreeze(deviceId()))}
          className="mt-4 rounded-sm border border-rule px-5 py-3 text-[15px] text-dim transition-colors hover:text-text disabled:opacity-40"
        >
          Buy a freeze for {groupNumber(FREEZE_PURCHASE_XP)} XP
        </button>
        {!canBuy && (
          <p className="mt-3 text-[13px] text-faint">
            You have <span className="tnum">{groupNumber(xp)}</span> XP, or the bank is full.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-[15px] text-text">Rest days</h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
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
                className="rounded-sm border px-3 py-2 text-[13px] transition-colors disabled:opacity-50"
                style={{
                  borderColor: on ? "var(--tier)" : "var(--color-rule)",
                  color: on ? "var(--tier)" : undefined,
                }}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] text-text">Vacation</h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
          Up to <span className="tnum">{MAX_VACATION_DAYS}</span> days, declared in advance,
          once per calendar quarter. The streak stops entirely and no freezes are spent.
        </p>

        {vacations.length > 0 && (
          <ul className="mt-4 text-[13px]">
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
          <label className="text-[13px] text-faint">
            From
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-[14px] text-text outline-none"
            />
          </label>
          <label className="text-[13px] text-faint">
            To
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-[14px] text-text outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => declareVacation(start, end, deviceId()))}
            className="rounded-sm border border-rule px-5 py-2 text-[14px] text-dim transition-colors hover:text-text disabled:opacity-40"
          >
            Declare vacation
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] text-text">Dates the calendar cares about</h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
          Two achievements need dates only you know. A public holiday is wherever you are,
          so it is a list you keep rather than a calendar guessed on your behalf.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-[13px] text-faint">
            Your birthday
            <input
              type="date"
              value={birth}
              onChange={(e) => {
                setBirth(e.target.value);
                run(() =>
                  setCalendarSettings(
                    { birthday: e.target.value || null, holidays: days },
                    deviceId(),
                  ),
                );
              }}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-[14px] text-text outline-none"
            />
          </label>
          <p className="pb-2 text-[12px] text-faint">Only the day and month are read.</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {knownThaiYears().map((year) => {
            const dates = thaiHolidaysFor(year).map((h) => h.date);
            const missing = dates.filter((d) => !days.includes(d));
            return (
              <button
                key={year}
                type="button"
                disabled={pending || missing.length === 0}
                onClick={() => {
                  const next = [...new Set([...days, ...dates])].sort();
                  setDays(next);
                  run(() =>
                    setCalendarSettings(
                      { birthday: birth || null, holidays: next },
                      deviceId(),
                    ),
                  );
                }}
                className="rounded-sm border border-rule px-4 py-2 text-[13px] text-dim transition-colors hover:text-text disabled:opacity-40"
              >
                {missing.length === 0 ? (
                  <>
                    <span className="tnum">{year}</span> Thai holidays added
                  </>
                ) : (
                  <>
                    Add Thailand&rsquo;s <span className="tnum">{year}</span> holidays
                    <span className="text-faint"> ({missing.length})</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-faint">
          Taken from the Bank of Thailand&rsquo;s annual list. Makha Bucha, Visakha Bucha and
          Asahna Bucha follow the lunar calendar and cannot be worked out in advance, so the
          table stops at <span className="tnum">{lastKnownThaiYear()}</span> — add the next
          year&rsquo;s dates yourself once Thailand publishes them.
        </p>

        {days.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {days.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const next = days.filter((x) => x !== d);
                    setDays(next);
                    run(() =>
                      setCalendarSettings(
                        { birthday: birth || null, holidays: next },
                        deviceId(),
                      ),
                    );
                  }}
                  title={`Remove ${d}`}
                  className="tnum rounded-sm border border-rule px-3 py-2 text-[13px] text-dim transition-colors hover:text-warn disabled:opacity-40"
                >
                  {d} <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-[13px] text-faint">
            Add a public holiday
            <input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="tnum mt-1 block rounded-sm border border-rule bg-lift px-3 py-2 text-[14px] text-text outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending || days.includes(newHoliday)}
            onClick={() => {
              const next = [...new Set([...days, newHoliday])].sort();
              setDays(next);
              run(() =>
                setCalendarSettings({ birthday: birth || null, holidays: next }, deviceId()),
              );
            }}
            className="rounded-sm border border-rule px-5 py-2 text-[14px] text-dim transition-colors hover:text-text disabled:opacity-40"
          >
            {days.includes(newHoliday) ? "Already listed" : "Add holiday"}
          </button>
        </div>
      </section>

      {error && (
        <p
          className="border-l-2 pl-4 text-[13px] leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
