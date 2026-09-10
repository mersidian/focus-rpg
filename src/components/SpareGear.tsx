"use client";

import { useMemo, useState } from "react";
import type { InstanceRow } from "@/lib/game-view-service";
import { Rows } from "./GameUi";
import { EquipButton, RefineButton, SellInstanceButton } from "./GameActions";
import { MAX_REFINE } from "@/lib/game/power";

/** As many as are worth rendering at once. The filter reaches the rest. */
const SHOWN = 60;

/**
 * Spare gear, searchable.
 *
 * The screen used to slice this list to sixty and say nothing, while the
 * heading beside it printed the full count — the seventh time that exact
 * contradiction has appeared, and the reason `Rows` grew a `total` prop.
 * Passing `total` fixes the lie, but on its own it only makes the screen
 * honest about gear it still gives you no way to reach: with three hundred
 * spares, two hundred and forty of them could not be worn, refined or sold.
 *
 * So this is the bank's answer applied to instances — search plus a slot
 * filter, then a cap, then the truth about the cap. Individual pieces are the
 * one thing in the game with no upper bound: bank slots limit item *types*,
 * and equipment is a row per piece, so this list is the only one that can
 * grow forever.
 */
export function SpareGear({ spare }: { spare: InstanceRow[] }) {
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("all");

  const slots = useMemo(
    () => ["all", ...[...new Set(spare.map((i) => i.slot))].sort()],
    [spare],
  );

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spare.filter(
      (i) => (slot === "all" || i.slot === slot) && (q === "" || i.name.toLowerCase().includes(q)),
    );
  }, [spare, query, slot]);

  const filtering = slot !== "all" || query.trim() !== "";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search spare gear"
          className="min-w-0 flex-1 border-b border-rule bg-transparent py-2 text-body text-text placeholder:text-faint focus:border-current"
          style={{ caretColor: "var(--tier)" }}
        />
        <div className="flex flex-wrap gap-x-3 text-note">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`py-1 ${s === slot ? "" : "text-faint transition-colors hover:text-dim"}`}
              style={s === slot ? { color: "var(--tier)" } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/*
        Only while a filter is on. Unfiltered, this line would repeat the
        heading's count and the table's own footer would repeat it again.
      */}
      {filtering && (
        <p className="mt-3 text-note text-faint">
          <span className="tnum">{matched.length}</span> of{" "}
          <span className="tnum">{spare.length}</span> pieces match
        </p>
      )}

      {matched.length === 0 ? (
        // The count line above already says how many were searched.
        <p className="mt-6 text-body text-faint">Nothing matches.</p>
      ) : (
        <Rows
          head={["Item", "Slot", "Tier", "Roll", ""]}
          rows={matched.slice(0, SHOWN).map((i) => [
            <span key="n" className="text-dim">
              {i.name}
              {i.refine > 0 && <span style={{ color: "var(--tier)" }}> +{i.refine}</span>}
            </span>,
            i.slot,
            String(i.tier),
            `${Math.round(i.percentile * 100)}%`,
            <span key="a" className="inline-flex flex-wrap gap-x-3">
              <EquipButton instanceId={i.id} />
              {i.refine < MAX_REFINE && <RefineButton instanceId={i.id} step={i.refine + 1} />}
              <SellInstanceButton instanceId={i.id} />
            </span>,
          ])}
          total={matched.length}
        />
      )}
    </div>
  );
}
