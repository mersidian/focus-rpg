"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buyStockAction } from "@/lib/actions";
import { MAX_BUY_AT_ONCE } from "@/lib/constants";
import { Icon } from "./Icon";
import { DepthValue, KindMark } from "./GameUi";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (rows.find((r) => r.id === openId) ?? null) : null;

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
            <Shelf rows={found.slice(0, SEARCH_SHOWN)} coins={coins} onOpen={setOpenId} />
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
                    <Shelf rows={list} coins={coins} onOpen={setOpenId} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {open && (
        <BuyDialog key={open.id} row={open} coins={coins} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

/**
 * The shelf: a name, a price, and whether you can pay it.
 *
 * Every cell carried a quantity box, a max button and Buy — the same row of
 * controls crafting and the bank had, and the same answer: the cell is the
 * button and the buying happens in the popup it opens.
 */
function Shelf({
  rows,
  coins,
  onOpen,
}: {
  rows: ShopRow[];
  coins: number;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {rows.map((r) => {
        const short = r.price > coins;
        return (
          <li key={r.id} className="border-t border-rule">
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-lift/60"
            >
              <Icon name={markFor(r)} className="size-5 shrink-0" style={{ color: classHue(r.cls) }} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-body ${short ? "text-dim" : "text-text"}`}>
                  {r.name}
                </span>
                <span className="block truncate text-note text-faint">
                  <DepthValue step={r.tier} steps={MAX_TIER} label={`t${r.tier}`} />
                  {r.held > 0 && (
                    <>
                      , you hold <span className="tnum">{r.held.toLocaleString()}</span>
                    </>
                  )}
                </span>
              </span>
              <span
                className="tnum shrink-0 text-body"
                style={{ color: short ? "var(--color-warn)" : "var(--color-text)" }}
              >
                {groupNumber(r.price)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type Bought = { ok: true; count: number; coins: number } | { ok: false; text: string };

/** One thing off the shelf: what it costs, what you can afford, and how many. */
function BuyDialog({
  row,
  coins,
  onClose,
}: {
  row: ShopRow;
  coins: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [times, setTimes] = useState(1);
  const [bought, setBought] = useState<Bought | null>(null);
  const [pending, start] = useTransition();

  // Guarded, not undone on cleanup: see the same note on the crafting popup.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const max = Math.min(MAX_BUY_AT_ONCE, Math.floor(coins / Math.max(1, row.price)));
  const can = max >= 1;
  const count = Math.max(1, Math.min(times, Math.max(1, max)));
  const cost = count * row.price;

  const buy = () => {
    start(async () => {
      try {
        const result = await buyStockAction(row.id, count);
        setBought(
          result.ok ? { ok: true, count, coins: cost } : { ok: false, text: result.reason },
        );
      } catch {
        setBought({ ok: false, text: "That did not go through. Check your coins before trying again." });
      }
    });
  };

  return (
    <dialog
      ref={ref}
      className="popup"
      aria-labelledby="buy-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (can && !pending) buy();
        }}
      >
        <header className="flex items-start gap-3">
          <KindMark large name={markFor(row)} hue={classHue(row.cls)} />
          <div className="min-w-0 flex-1">
            <h2 id="buy-title" className="text-stat font-medium leading-tight text-text">
              {row.name}
            </h2>
            <p className="mt-1 text-note text-faint">
              {CLASS_LABEL[row.cls] ?? row.cls}, tier <span className="tnum">{row.tier}</span>
            </p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="btn-quiet">
            Close
          </button>
        </header>

        {bought && (
          <p
            role="status"
            aria-live="polite"
            className="mt-5 rounded-md border px-4 py-3 text-body text-text"
            style={{
              borderColor: `color-mix(in oklch, ${bought.ok ? "var(--action)" : "var(--color-warn)"} 55%, var(--color-rule))`,
              backgroundColor: `color-mix(in oklch, ${bought.ok ? "var(--action)" : "var(--color-warn)"} 12%, transparent)`,
            }}
          >
            {bought.ok ? (
              <>
                Bought <span className="tnum">{groupNumber(bought.count)}</span> for{" "}
                <span className="tnum">{groupNumber(bought.coins)}</span> coins
              </>
            ) : (
              bought.text
            )}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-4 border-y border-rule py-4">
          <div>
            <dd className="tnum text-stat leading-none text-text">{groupNumber(row.price)}</dd>
            <dt className="mt-1.5 text-note text-faint">coins each</dt>
          </div>
          <div>
            <dd className="tnum text-stat leading-none text-text">{groupNumber(row.held)}</dd>
            <dt className="mt-1.5 text-note text-faint">you hold</dt>
          </div>
          <div>
            <dd
              className="tnum text-stat leading-none"
              style={{ color: can ? "var(--color-dim)" : "var(--color-warn)" }}
            >
              {groupNumber(coins)}
            </dd>
            <dt className="mt-1.5 text-note text-faint">your coins</dt>
          </div>
        </dl>

        {!can && (
          <p className="mt-4 text-body" style={{ color: "var(--color-warn)" }}>
            <span className="tnum">{groupNumber(row.price - coins)}</span> coins short.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              className="btn-quiet"
              aria-label="One fewer"
              disabled={!can || count <= 1}
              onClick={() => setTimes(count - 1)}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, max)}
              value={count}
              disabled={!can}
              onChange={(e) => setTimes(Math.trunc(Number(e.target.value) || 1))}
              aria-label="How many to buy"
              className="tnum h-8 w-16 rounded-[4px] border border-rule bg-transparent px-2 text-center text-field text-text focus:border-current disabled:opacity-40"
            />
            <button
              type="button"
              className="btn-quiet"
              aria-label="One more"
              disabled={!can || count >= max}
              onClick={() => setTimes(count + 1)}
            >
              +
            </button>
            {max > 1 && count !== max && (
              <button type="button" className="btn-quiet tnum" onClick={() => setTimes(max)}>
                max {max}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!can || pending}
            aria-busy={pending || undefined}
            className="rounded-sm px-5 py-2 text-body font-medium text-ground transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--action)" }}
          >
            {pending ? "Buying" : `Buy ${groupNumber(count)} for ${groupNumber(cost)} coins`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
