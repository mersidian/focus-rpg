"use client";

import { useMemo, useState } from "react";
import type { BankRow } from "@/lib/game-view-service";
import { SellStackButton } from "./GameActions";
import { Depth } from "./GameUi";
import { Icon } from "./Icon";
import { markFor } from "./item-mark";
import { MAX_TIER } from "@/lib/game/tiers";
import { depthInk } from "@/lib/format";
import { classHue } from "@/lib/palette";

/**
 * The bank is search-first, and that is a design requirement rather than a
 * nicety: with ~8,500 item types and a slot limit, a grid you scroll is the
 * inventory-management minigame this app cannot afford.
 */
export function BankFilter({ rows }: { rows: BankRow[] }) {
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("all");

  const classes = useMemo(
    () => ["all", ...[...new Set(rows.map((r) => r.cls))].sort()],
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => (cls === "all" || r.cls === cls) && (q === "" || r.name.toLowerCase().includes(q)),
    );
  }, [rows, query, cls]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the bank"
          className="min-w-0 flex-1 border-b border-rule bg-transparent py-2 text-body text-text placeholder:text-faint focus:border-current"
          style={{ caretColor: "var(--tier)" }}
        />
        <div className="flex flex-wrap gap-x-3 text-note">
          {classes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCls(c)}
              className={`py-1 ${c === cls ? "" : "text-faint transition-colors hover:text-dim"}`}
              style={c === cls ? { color: "var(--tier)" } : undefined}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-note text-faint">
        <span className="tnum">{shown.length}</span> of <span className="tnum">{rows.length}</span>{" "}
        stacks
      </p>

      {shown.length === 0 ? (
        <p className="mt-6 text-body text-faint">Nothing matches.</p>
      ) : (
        <ul className="mt-2">
          {shown.map((row) => (
            <li
              key={row.itemId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2 text-body last:border-0"
            >
              <span className="flex min-w-0 items-baseline gap-2 text-dim">
                {/* The same mark the shelf and the crafting list use, in the
                    same hue, so a Bronze Pickaxe is one glyph everywhere it is
                    named. */}
                <Icon
                  name={markFor({ id: row.itemId, cls: row.cls, skill: row.skill, style: row.style })}
                  className="size-4 shrink-0 self-center"
                  style={{ color: classHue(row.cls) }}
                />
                {row.tier > 0 && <Depth step={row.tier} steps={MAX_TIER} title={`Tier ${row.tier}`} />}
                <span className="min-w-0">
                  {row.name}
                  <span style={{ color: classHue(row.cls) }}> {row.cls}</span>
                  {row.tier > 0 && (
                    <span className="tnum" style={{ color: depthInk(row.tier, MAX_TIER) }}>
                      {" "}
                      t{row.tier}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                <span className="tnum text-faint">{row.qty.toLocaleString()}</span>
                <SellStackButton itemId={row.itemId} held={row.qty} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
