"use client";

import { useMemo, useState } from "react";
import { BuyButton } from "./GameActions";
import { Icon } from "./Icon";
import { DepthValue } from "./GameUi";
import { markFor } from "./item-mark";
import { MAX_TIER } from "@/lib/game/tiers";
import { groupNumber } from "@/lib/format";
import { classHue } from "@/lib/palette";

export type ShopRow = {
  id: string;
  name: string;
  cls: string;
  /** The gathering skill a tool belongs to; absent for everything else. */
  skill?: string;
  tier: number;
  price: number;
  /** How many you already hold. */
  held: number;
  /** Crude, Plain, Fine — only tools carry one. */
  grade?: string;
};

const CLASS_LABEL: Record<string, string> = {
  tool: "tools",
  ammo: "ammunition",
  consumable: "rations and tonics",
  stone: "upgrade stones",
  seed: "seeds",
};

/** As many search results as are worth drawing. */
const SEARCH_SHOWN = 60;

/**
 * The shelf: one kind of thing at a time, deepest tier first.
 *
 * It opened on everything — 192 cells for a character five tiers in, 842 at
 * depth — with a chip row that could narrow it and defaulted to not doing so.
 * Nobody shops for "all": you come for a pickaxe or for rations. So a kind is
 * always chosen, its tiers are folded with the deepest open, and the one
 * question that crosses kinds, "where is the thing called X", is the search box.
 *
 * Still a grid rather than a table, because a shelf is things and not rows of
 * figures; still hairlines, not cards.
 */
export function ShopFilter({ rows, coins }: { rows: ShopRow[]; coins: number }) {
  const classes = useMemo(() => [...new Set(rows.map((r) => r.cls))], [rows]);
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState(() => classes[0] ?? "");
  const [afford, setAfford] = useState(false);

  const q = query.trim().toLowerCase();
  const found = useMemo(
    () =>
      q === ""
        ? []
        : rows
            .filter((r) => r.name.toLowerCase().includes(q))
            .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)),
    [rows, q],
  );

  const tiers = useMemo(() => {
    const by = new Map<number, ShopRow[]>();
    for (const r of rows) {
      if (r.cls !== cls) continue;
      if (afford && r.price > coins) continue;
      by.set(r.tier, [...(by.get(r.tier) ?? []), r]);
    }
    return [...by]
      .sort((a, b) => b[0] - a[0])
      .map(([tier, list]) => [tier, list.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [rows, cls, afford, coins]);

  return (
    <div className="mt-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the whole shelf"
        className="h-10 w-full rounded-[4px] border border-rule bg-transparent px-3 text-field text-text placeholder:text-faint focus:border-current"
        style={{ caretColor: "var(--tier)" }}
      />

      {q !== "" ? (
        <>
          <p className="mt-4 text-note text-faint">
            <span className="tnum text-dim">{found.length}</span>{" "}
            {found.length === 1 ? "thing matches" : "things match"}
            {found.length > SEARCH_SHOWN && <>, showing the first {SEARCH_SHOWN}</>}
          </p>
          {found.length === 0 ? (
            <p className="mt-4 text-body text-faint">
              Nothing by that name. The shop sells no weapons or armour.
            </p>
          ) : (
            <Shelf rows={found.slice(0, SEARCH_SHOWN)} coins={coins} />
          )}
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {classes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCls(c)}
                aria-pressed={c === cls}
                className="chip"
              >
                {CLASS_LABEL[c] ?? c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAfford((v) => !v)}
              aria-pressed={afford}
              className="chip ml-auto"
            >
              only what I can afford
            </button>
          </div>

          {tiers.length === 0 ? (
            <p className="mt-6 text-body text-faint">
              Nothing here for <span className="tnum">{groupNumber(coins)}</span> coins.
            </p>
          ) : (
            <div className="mt-4 border-t border-rule">
              {tiers.map(([tier, list], i) => (
                // Keyed by kind as well as tier, so changing kind re-opens the
                // deepest tier instead of inheriting whatever was open before.
                <details key={`${cls}:${tier}`} open={i === 0} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3 text-body [&::-webkit-details-marker]:hidden">
                    <span className="flex items-baseline gap-3">
                      <span aria-hidden className="w-3 text-faint group-open:hidden">
                        +
                      </span>
                      <span aria-hidden className="hidden w-3 text-faint group-open:inline">
                        −
                      </span>
                      <DepthValue step={tier} steps={MAX_TIER} label={`Tier ${tier}`} />
                    </span>
                    <span className="text-note text-faint">
                      <span className="tnum">{list.length}</span> on the shelf
                    </span>
                  </summary>
                  <div className="pb-2">
                    <Shelf rows={list} coins={coins} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Shelf({ rows, coins }: { rows: ShopRow[]; coins: number }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 border-t border-rule py-3 text-body">
          {/*
            Hue for kind, accent for standing — the rule `palette.ts` was
            written for. The mark says what sort of thing this is and the tier
            beside it says how deep.
          */}
          <Icon
            name={markFor(r)}
            className="mt-0.5 size-5 shrink-0"
            style={{ color: classHue(r.cls) }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-text" title={r.name}>
              {r.name}
            </span>
            <span className="mt-0.5 flex items-baseline gap-2 text-note text-faint">
              <DepthValue step={r.tier} steps={MAX_TIER} label={`t${r.tier}`} />
              <span
                className="tnum"
                style={r.price > coins ? { color: "var(--color-warn)" } : undefined}
              >
                {groupNumber(r.price)} coins
              </span>
              {r.held > 0 && <span className="tnum">{r.held.toLocaleString()} held</span>}
            </span>
            <span className="mt-2 block">
              {/* What your coins actually reach, so "max" is a real number
                  rather than the server's ceiling. */}
              <BuyButton itemId={r.id} max={Math.floor(coins / Math.max(1, r.price))} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
