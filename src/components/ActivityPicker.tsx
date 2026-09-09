"use client";

import { useEffect, useState } from "react";
import { listActivityOffers } from "@/lib/actions";
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
export function ActivityPicker({
  value,
  onChange,
}: {
  value: Activity | null;
  onChange: (activity: Activity | null) => void;
}) {
  const [offers, setOffers] = useState<ActivityOffer[] | null>(null);
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
    return () => {
      live = false;
    };
  }, [open, offers, failed]);

  const chosen = offers?.find((o) => value && activityKey(o.activity) === activityKey(value));

  return (
    <section className="mt-10 border-t border-rule pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[13px] text-faint">
          Your character{" "}
          {chosen ? (
            <span className="text-dim">{chosen.label}</span>
          ) : (
            <span className="text-dim">does nothing this session</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] text-faint transition-colors hover:text-dim"
        >
          {open ? "Close" : "Change"}
        </button>
      </div>

      {chosen && !open && (
        <p className="mt-1 text-[12px] text-faint">{chosen.detail}</p>
      )}

      {open && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-baseline justify-between gap-4 border-b border-rule py-2 text-left text-[13px]"
          >
            <span className={value === null ? "" : "text-dim"} style={value === null ? { color: "var(--tier)" } : undefined}>
              Just focus
            </span>
            <span className="shrink-0 text-[12px] text-faint">no activity</span>
          </button>

          {failed && (
            <p className="mt-3 text-[12px] text-faint">
              Could not load activities. The session will still start.
            </p>
          )}
          {!failed && offers === null && (
            <p className="mt-3 text-[12px] text-faint">Checking what is open…</p>
          )}

          {offers !== null && <OfferList offers={offers} value={value} onPick={(a) => { onChange(a); setOpen(false); }} />}
        </div>
      )}
    </section>
  );
}

function OfferList({
  offers,
  value,
  onPick,
}: {
  offers: ActivityOffer[];
  value: Activity | null;
  onPick: (activity: Activity) => void;
}) {
  const openOnes = offers.filter((o) => o.open);
  // The closed ones are a shopping list, not a wall, so a handful of the nearest
  // are shown with what they want. Two hundred greyed-out areas would be noise.
  const nextClosed = offers
    .filter((o) => !o.open)
    .sort((a, b) => a.tier - b.tier)
    .slice(0, 6);

  const groups = new Map<string, ActivityOffer[]>();
  for (const offer of openOnes) {
    const list = groups.get(offer.group) ?? [];
    list.push(offer);
    groups.set(offer.group, list);
  }

  return (
    <>
      {openOnes.length === 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-faint">
          Nothing is open yet. Gathering needs a tool, and every area needs a full set one tier
          below it — an empty slot counts as tier zero.
        </p>
      )}

      {[...groups.entries()].map(([group, rows]) => (
        <div key={group} className="mt-5">
          <p className="text-[12px] text-faint">{group}</p>
          {rows.slice(0, 12).map((offer) => {
            const selected = value !== null && activityKey(offer.activity) === activityKey(value);
            return (
              <button
                key={activityKey(offer.activity)}
                type="button"
                onClick={() => onPick(offer.activity)}
                className="flex w-full items-baseline justify-between gap-4 border-b border-rule py-2 text-left text-[13px]"
              >
                <span
                  className={selected ? "" : "text-dim"}
                  style={selected ? { color: "var(--tier)" } : undefined}
                >
                  {offer.label}
                </span>
                <span className="shrink-0 text-[12px] text-faint">{offer.detail}</span>
              </button>
            );
          })}
        </div>
      ))}

      {nextClosed.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] text-faint">Not yet</p>
          {nextClosed.map((offer) => (
            <p
              key={activityKey(offer.activity)}
              className="flex items-baseline justify-between gap-4 border-b border-rule py-2 text-[13px] text-faint last:border-0"
            >
              <span>{offer.label}</span>
              <span className="shrink-0 text-[12px]">needs {offer.missing[0]}</span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
