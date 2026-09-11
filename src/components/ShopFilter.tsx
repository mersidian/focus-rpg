"use client";

import { useMemo, useState } from "react";
import { BuyButton } from "./GameActions";
import { Icon, type IconName } from "./Icon";
import { MAX_TIER } from "@/lib/game/tiers";
import { depthInk, groupNumber } from "@/lib/format";

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

/**
 * Which of the fifty-six marks a shelf row wears.
 *
 * Tools take the mark of the skill they belong to, which already exists — a
 * pickaxe is the mining mark, an axe the woodcutting one — so eight of the
 * kinds cost nothing to add and read the same here as they do on the skills
 * page. The rest are drawn by line rather than by item: thirty tonics do not
 * want thirty glyphs, because no drawing distinguishes Deep Vein from Rich
 * Seam and pretending otherwise is decoration posing as information.
 */
function markFor(row: ShopRow): IconName {
  if (row.cls === "tool" && row.skill) return row.skill as IconName;
  const line = row.id.split(":")[1] ?? "";
  if (row.cls === "ammo") {
    const map: Record<string, IconName> = {
      Arrow: "arrow",
      Bolt: "bolt",
      Dart: "dart",
      Rune: "rune",
      Cartridge: "cartridge",
      Shell: "shell",
    };
    return map[line] ?? "arrow";
  }
  if (row.cls === "consumable") {
    if (row.id.startsWith("ration:")) return "ration";
    return /Ward|Warded|Kindled|Still Water/.test(line) ? "ward" : "tonic";
  }
  if (row.cls === "stone") {
    return line === "Whetstone" ? "whetstone" : line === "Temper Salt" ? "temper" : "flux";
  }
  if (row.cls === "seed") {
    const map: Record<string, IconName> = {
      Herb: "herbseed",
      Fibre: "fibreseed",
      Sapling: "sapling",
      Stock: "stock",
    };
    return map[line] ?? "herbseed";
  }
  return "shop";
}

const CLASS_LABEL: Record<string, string> = {
  all: "all",
  tool: "tools",
  ammo: "ammunition",
  consumable: "rations and tonics",
  stone: "upgrade stones",
  seed: "seeds",
};

/**
 * The shelf, as a grid you can search rather than a table that stops.
 *
 * Every class was capped and the footer said "showing 48 of 64" with no way to
 * reach the rest — the same dead end the crafting page had, and at depth the
 * shelf is 842 rows, so a bigger cap was never the answer. Search and chips are,
 * exactly as on the bank and on crafting, and nothing is hidden any more.
 *
 * A grid rather than a table because a shelf is things, not rows of figures:
 * three columns of name, mark and price scan far faster than one column of
 * five, and it is what makes an icon worth having at all. Still hairlines, no
 * cards and no shadows — the cells are separated, not boxed.
 */
export function ShopFilter({ rows, coins }: { rows: ShopRow[]; coins: number }) {
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("all");
  const [afford, setAfford] = useState(false);

  const classes = useMemo(
    () => ["all", ...[...new Set(rows.map((r) => r.cls))]],
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => cls === "all" || r.cls === cls)
      .filter((r) => !afford || r.price <= coins)
      .filter((r) => q === "" || r.name.toLowerCase().includes(q))
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
  }, [rows, query, cls, afford, coins]);

  const affordable = rows.filter((r) => r.price <= coins).length;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the shelf"
          className="min-w-0 flex-1 border-b border-rule bg-transparent py-2 text-field text-text placeholder:text-faint focus:border-current"
          style={{ caretColor: "var(--tier)" }}
        />
        <button
          type="button"
          onClick={() => setAfford((v) => !v)}
          aria-pressed={afford}
          className={`py-1 text-note ${afford ? "" : "text-faint transition-colors hover:text-dim"}`}
          style={afford ? { color: "var(--tier)" } : undefined}
        >
          can afford ({affordable})
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 text-note">
        {classes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCls(c)}
            className={`py-1 ${c === cls ? "" : "text-faint transition-colors hover:text-dim"}`}
            style={c === cls ? { color: "var(--tier)" } : undefined}
          >
            {CLASS_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      <p className="mt-3 text-note text-faint">
        <span className="tnum">{shown.length}</span> of <span className="tnum">{rows.length}</span>{" "}
        on the shelf · <span className="tnum text-dim">{groupNumber(coins)}</span> coins
      </p>

      {shown.length === 0 ? (
        <p className="mt-6 text-body text-faint">Nothing matches.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 border-b border-rule py-3 pr-4 text-body"
            >
              {/* The mark takes the depth colour, so a shelf reads as a ladder
                  at a glance and the icon is carrying the tier rather than
                  repeating the name. */}
              <Icon
                name={markFor(r)}
                className="mt-0.5 size-5 shrink-0"
                style={{ color: depthInk(r.tier, MAX_TIER) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-dim" title={r.name}>
                  {r.name}
                </span>
                <span className="mt-0.5 flex items-baseline gap-2 text-note text-faint">
                  <span className="tnum" style={{ color: depthInk(r.tier, MAX_TIER) }}>
                    t{r.tier}
                  </span>
                  <span
                    className="tnum"
                    style={r.price > coins ? { color: "var(--color-warn)" } : undefined}
                  >
                    {groupNumber(r.price)}
                  </span>
                  {r.held > 0 && (
                    <span className="tnum">
                      {r.held.toLocaleString()} held
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0">
                <BuyButton itemId={r.id} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
