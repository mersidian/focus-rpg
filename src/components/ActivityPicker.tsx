"use client";

import { useEffect, useRef, useState } from "react";
import { listActivityOffers, listTonics } from "@/lib/actions";
import type { Activity } from "@/lib/game/activity";
import { activityKey } from "@/lib/game/activity";
import type { ActivityOffer } from "@/lib/activity-service";

/**
 * Choosing what the character does, before the timer starts.
 *
 * The ordering is the design: the requirement gate has to be evaluated before
 * you commit fifty minutes, so a missing ration is visible BEFORE the session
 * and not after — and so a session can never be claimed as combat once its roll
 * is known.
 *
 * The cost of that is a decision in front of the start button, which is the one
 * place this app must stay frictionless. So: "Just focus" is always the first
 * option and always valid. V1's timer worked without a game and has to keep
 * working; nothing here may stand between the user and pressing start.
 */
type Tonic = { itemId: string; name: string; qty: number; does: string };

export function ActivityPicker({
  value,
  onChange,
  tonic,
  onTonic,
}: {
  value: Activity | null;
  onChange: (activity: Activity | null) => void;
  tonic: string | null;
  onTonic: (itemId: string | null) => void;
}) {
  const [offers, setOffers] = useState<ActivityOffer[] | null>(null);
  const [tonics, setTonics] = useState<Tonic[] | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || offers !== null || failed) return;
    let live = true;
    listActivityOffers()
      .then((rows) => {
        if (live) setOffers(rows);
      })
      .catch(() => {
        // The game is decoration on the timer. If the list cannot load, the
        // session must still be startable.
        if (live) setFailed(true);
      });
    listTonics()
      .then((rows) => {
        if (live) setTonics(rows);
      })
      .catch(() => {
        if (live) setTonics([]);
      });
    return () => {
      live = false;
    };
  }, [open, offers, failed]);

  const chosen = offers?.find((o) => value && activityKey(o.activity) === activityKey(value));
  const chosenTonic = tonic ? tonics?.find((t) => t.itemId === tonic) : undefined;

  // One line between the length slabs and the Start button. Everything else is
  // in the popup, so choosing an activity never pushes Start down the page.
  return (
    <section className="mt-6 border-t border-rule pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-body text-faint">
          Your character{" "}
          {chosen ? (
            <>
              {chosen.verb} <span className="text-text">{chosen.label}</span>
            </>
          ) : (
            <span className="text-dim">does nothing this session</span>
          )}
          {chosenTonic && (
            <>
              , with <span className="text-dim">{chosenTonic.name}</span>
            </>
          )}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="btn-quiet">
          {chosen ? "Change" : "Choose"}
        </button>
      </div>
      {chosen && <p className="mt-1 text-note text-faint">{chosen.detail}</p>}

      {open && (
        <PickerDialog
          offers={offers}
          failed={failed}
          tonics={tonics ?? []}
          value={value}
          tonic={tonic}
          onTonic={onTonic}
          onPick={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

type Tab = "gather" | "fight";

/** Areas that are the same fight, as one row: same biome, tier and odds. */
type Row = { offer: ActivityOffer; label: string; keys: string[] };

function grouped(offers: ActivityOffer[]): Row[] {
  const out: (Row & { sig: string; from: number; to: number })[] = [];
  for (const offer of offers) {
    const a = offer.activity;
    if (a.kind !== "combat") {
      out.push({ offer, label: offer.label, keys: [activityKey(a)], sig: "", from: 0, to: 0 });
      continue;
    }
    const sig = `${offer.group}|${offer.tier}|${offer.detail}|${offer.missing.join()}`;
    const last = out[out.length - 1];
    if (last && last.sig === sig) {
      last.to = a.area;
      last.keys.push(activityKey(a));
      last.label = `${offer.group}, areas ${last.from}–${last.to}`;
    } else {
      out.push({
        offer,
        label: `${offer.group}, area ${a.area}`,
        keys: [activityKey(a)],
        sig,
        from: a.area,
        to: a.area,
      });
    }
  }
  return out;
}

/**
 * The choice, in a popup.
 *
 * It was an inline list between the session lengths and the Start button:
 * every tier of every gathering skill, then all ten areas of each open biome
 * one row apiece — Sunlit Meadow 1 to 5 are the same fight, five times — and
 * Start somewhere underneath. Two kinds of thing to do, so two tabs; a skill
 * shows the deepest thing it can gather with the shallower tiers folded; areas
 * that are the same fight are one row. Picking closes it.
 */
function PickerDialog({
  offers,
  failed,
  tonics,
  value,
  tonic,
  onTonic,
  onPick,
  onClose,
}: {
  offers: ActivityOffer[] | null;
  failed: boolean;
  tonics: Tonic[];
  value: Activity | null;
  tonic: string | null;
  onTonic: (itemId: string | null) => void;
  onPick: (activity: Activity | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>(value && value.kind !== "gathering" ? "fight" : "gather");

  // Guarded, not undone on cleanup: see the same note on the crafting popup.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const current = value ? activityKey(value) : null;
  const pick = (activity: Activity | null) => {
    onPick(activity);
    ref.current?.close();
  };

  const mine = (offers ?? []).filter((o) =>
    tab === "gather" ? o.activity.kind === "gathering" : o.activity.kind !== "gathering",
  );
  const groups = new Map<string, Row[]>();
  for (const row of grouped(mine.filter((o) => o.open))) {
    groups.set(row.offer.group, [...(groups.get(row.offer.group) ?? []), row]);
  }
  // The nearest few that are shut, with what each wants: a shopping list.
  const closed = grouped(mine.filter((o) => !o.open).sort((a, b) => a.tier - b.tier)).slice(0, 4);

  const row = (r: Row, name = r.label) => {
    const selected = current !== null && r.keys.includes(current);
    return (
      <button
        key={r.keys[0]}
        type="button"
        onClick={() => pick(r.offer.activity)}
        aria-pressed={selected}
        className="flex w-full items-baseline justify-between gap-4 rounded-md px-2 py-2.5 text-left text-body transition-colors hover:bg-ground/50"
      >
        <span className={selected ? "" : "text-text"} style={selected ? { color: "var(--tier)" } : undefined}>
          {name}
        </span>
        <span className="shrink-0 text-note text-faint">{r.offer.detail}</span>
      </button>
    );
  };

  return (
    <dialog
      ref={ref}
      className="popup"
      aria-labelledby="picker-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="picker-title" className="text-stat font-medium text-text">
          What your character does
        </h2>
        <button type="button" onClick={() => ref.current?.close()} className="btn-quiet">
          Close
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={tab === "gather"} onClick={() => setTab("gather")}>
          Gather
        </button>
        <button type="button" className="chip" aria-pressed={tab === "fight"} onClick={() => setTab("fight")}>
          Fight
        </button>
        <button type="button" className="chip ml-auto" aria-pressed={value === null} onClick={() => pick(null)}>
          Just focus
        </button>
      </div>

      {failed && (
        <p className="mt-4 text-body text-faint">
          Could not load activities. The session will still start.
        </p>
      )}
      {!failed && offers === null && (
        <p className="mt-4 text-body text-faint">Checking what is open…</p>
      )}

      {offers !== null && (
        <div className="mt-3">
          {groups.size === 0 && (
            <p className="mt-2 text-body text-faint">
              {tab === "gather"
                ? "Nothing to gather yet. Each skill needs its tool."
                : "No area is open yet."}
            </p>
          )}
          {[...groups].map(([group, rows]) =>
            tab === "gather" ? (
              // One row a skill: the deepest thing it can gather. The shallower
              // tiers are a fold away, because they are rarely the answer.
              <div key={group} className="border-b border-rule py-1">
                <p className="px-2 pt-2 text-note text-faint">{group}</p>
                {row(rows[0])}
                {rows.length > 1 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none px-2 pb-2 text-note text-faint hover:text-dim [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">{rows.length - 1} shallower</span>
                      <span className="hidden group-open:inline">Hide shallower</span>
                    </summary>
                    {rows.slice(1).map((r) => row(r))}
                  </details>
                )}
              </div>
            ) : (
              <div key={group} className="border-b border-rule py-1">
                <p className="px-2 pt-2 text-note text-faint">{group}</p>
                {rows.map((r) => {
                  const short = r.label.replace(`${group}, `, "");
                  return row(r, short.charAt(0).toUpperCase() + short.slice(1));
                })}
              </div>
            ),
          )}

          {closed.length > 0 && (
            <div className="pt-3">
              <p className="px-2 text-note text-faint">Next to open</p>
              {closed.map((r) => (
                <p
                  key={r.keys[0]}
                  className="flex items-baseline justify-between gap-4 px-2 py-1.5 text-body text-faint"
                >
                  <span>{r.label}</span>
                  <span className="shrink-0 text-note">needs {r.offer.missing[0]}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {tonics.length > 0 && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-note text-faint">
            Drink a tonic with it? It is spent when the session starts.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={tonic === null} onClick={() => onTonic(null)}>
              None
            </button>
            {tonics.map((t) => (
              <button
                key={t.itemId}
                type="button"
                className="chip"
                title={t.does}
                aria-pressed={tonic === t.itemId}
                onClick={() => onTonic(t.itemId)}
              >
                {t.name} <span className="tnum">×{t.qty}</span>
              </button>
            ))}
          </div>
          {tonic && (
            <p className="mt-2 text-note text-dim">
              {tonics.find((t) => t.itemId === tonic)?.does}
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}
