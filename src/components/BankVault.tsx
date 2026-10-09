"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { BankRow } from "@/lib/game-view-service";
import { sellStackAction } from "@/lib/actions";
import { MAX_BUY_AT_ONCE } from "@/lib/constants";
import { KindMark } from "./GameUi";
import { Icon } from "./Icon";
import { markFor } from "./item-mark";
import { MAX_TIER } from "@/lib/game/tiers";
import { depthInk, groupNumber } from "@/lib/format";
import { classHue } from "@/lib/palette";

/** The classes in the order the game's own loop meets them, with a name each. */
const KINDS: [string, string][] = [
  ["raw", "Raw materials"],
  ["refined", "Refined"],
  ["part", "Monster parts"],
  ["biomeMaterial", "Biome materials"],
  ["tool", "Tools"],
  ["ammo", "Ammunition"],
  ["consumable", "Rations and potions"],
  ["stone", "Upgrade stones"],
  ["seed", "Seeds"],
];
const KIND_LABEL = new Map(KINDS);

const mark = (r: BankRow) =>
  markFor({ id: r.itemId, cls: r.cls, skill: r.skill, style: r.style });

/**
 * The bank, drawn as what it is: slots with things in them.
 *
 * It was a table — one stack a row, each with a quantity box, a max button
 * and a Sell button, under a line of text that carried the only facts a bank
 * has: how full it is and what more room costs. A bank is counted in slots and
 * the rule everywhere else in the game is that a slot is drawn as a slot, so
 * a stack is a tile with its count on it, grouped by kind, and selling lives
 * in the popup a tile opens. The row of controls on every stack was a hundred
 * chances to sell the wrong thing.
 */
export function BankVault({ rows }: { rows: BankRow[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const kinds = useMemo(() => {
    const held = new Set(rows.map((r) => r.cls));
    const known = KINDS.filter(([k]) => held.has(k)).map(([k]) => k);
    // Anything the catalogue grows later still gets a group rather than vanishing.
    return [...known, ...[...held].filter((k) => !KIND_LABEL.has(k))];
  }, [rows]);

  const q = query.trim().toLowerCase();
  const groups = kinds
    .filter((k) => kind === "all" || kind === k)
    .map((k) => ({
      kind: k,
      rows: rows
        .filter((r) => r.cls === k && (q === "" || r.name.toLowerCase().includes(q)))
        .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.rows.length > 0);

  const open = openId ? (rows.find((r) => r.itemId === openId) ?? null) : null;

  return (
    <div className="mt-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the bank"
        className="h-10 w-full rounded-[4px] border border-rule bg-transparent px-3 text-field text-text placeholder:text-faint focus:border-current"
        style={{ caretColor: "var(--tier)" }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
          Everything
        </button>
        {kinds.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL.get(k) ?? k}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-body text-faint">Nothing in the bank by that name.</p>
      ) : (
        groups.map((g) => (
          <section key={g.kind} className="mt-8">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
              <h2 className="flex items-center gap-2 text-lead font-medium text-text">
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: classHue(g.kind) }}
                />
                {KIND_LABEL.get(g.kind) ?? g.kind}
              </h2>
              <p className="text-note text-faint">
                <span className="tnum">{g.rows.length}</span>{" "}
                {g.rows.length === 1 ? "slot" : "slots"}
              </p>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {g.rows.map((r) => (
                <li key={r.itemId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(r.itemId)}
                    title={`${r.name}, ${r.qty.toLocaleString()} held`}
                    className="slot flex aspect-square w-full flex-col p-2 text-left transition-colors hover:border-dim"
                  >
                    <span className="flex items-center justify-between">
                      <Icon name={mark(r)} className="size-5" style={{ color: classHue(r.cls) }} />
                      {r.tier > 0 && (
                        <span className="tnum text-note" style={{ color: depthInk(r.tier, MAX_TIER) }}>
                          t{r.tier}
                        </span>
                      )}
                    </span>
                    <span className="tnum mt-auto text-stat leading-none text-text">
                      {groupNumber(r.qty)}
                    </span>
                    <span className="mt-1 block truncate text-note text-dim">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {open && <StackDialog key={open.itemId} row={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

type Sold = { ok: true; count: number; coins: number } | { ok: false; text: string };

/**
 * One stack, opened: what it is worth and how many to let go.
 *
 * The button names the whole deal — "Sell 5 for 120 coins" — because selling
 * is the one thing here that is not undone by pressing something else, and a
 * button that only says "Sell" asks you to trust a number in a different box.
 */
function StackDialog({ row, onClose }: { row: BankRow; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [times, setTimes] = useState(1);
  const [sold, setSold] = useState<Sold | null>(null);
  const [pending, start] = useTransition();

  // Guarded, not undone on cleanup: see the same note on the crafting popup.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const max = Math.min(MAX_BUY_AT_ONCE, row.qty);
  const count = Math.max(1, Math.min(times, max));

  const sell = () => {
    start(async () => {
      try {
        const result = await sellStackAction(row.itemId, count);
        setSold(
          result.ok
            ? { ok: true, count, coins: count * row.worth }
            : { ok: false, text: result.reason },
        );
        // The last of a stack leaves no tile to come back to.
        if (result.ok && count >= row.qty) ref.current?.close();
      } catch {
        setSold({ ok: false, text: "That did not go through. Check the bank before trying again." });
      }
    });
  };

  return (
    <dialog
      ref={ref}
      className="popup"
      aria-labelledby="stack-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) sell();
        }}
      >
        <header className="flex items-start gap-3">
          <KindMark large name={mark(row)} hue={classHue(row.cls)} />
          <div className="min-w-0 flex-1">
            <h2 id="stack-title" className="text-stat font-medium leading-tight text-text">
              {row.name}
            </h2>
            <p className="mt-1 text-note text-faint">
              {KIND_LABEL.get(row.cls) ?? row.cls}
              {row.tier > 0 && (
                <>
                  , tier <span className="tnum">{row.tier}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="btn-quiet">
            Close
          </button>
        </header>

        {sold && (
          <p
            role="status"
            aria-live="polite"
            className="mt-5 rounded-md border px-4 py-3 text-body text-text"
            style={{
              borderColor: `color-mix(in oklch, ${sold.ok ? "var(--action)" : "var(--color-warn)"} 55%, var(--color-rule))`,
              backgroundColor: `color-mix(in oklch, ${sold.ok ? "var(--action)" : "var(--color-warn)"} 12%, transparent)`,
            }}
          >
            {sold.ok ? (
              <>
                Sold <span className="tnum">{groupNumber(sold.count)}</span> for{" "}
                <span className="tnum">{groupNumber(sold.coins)}</span> coins
              </>
            ) : (
              sold.text
            )}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-4 border-y border-rule py-4">
          <div>
            <dd className="tnum text-stat leading-none text-text">{groupNumber(row.qty)}</dd>
            <dt className="mt-1.5 text-note text-faint">held</dt>
          </div>
          <div>
            <dd className="tnum text-stat leading-none text-text">{groupNumber(row.worth)}</dd>
            <dt className="mt-1.5 text-note text-faint">coins each</dt>
          </div>
          <div>
            <dd className="tnum text-stat leading-none text-dim">
              {groupNumber(row.worth * row.qty)}
            </dd>
            <dt className="mt-1.5 text-note text-faint">for the lot</dt>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              className="btn-quiet"
              aria-label="One fewer"
              disabled={count <= 1}
              onClick={() => setTimes(count - 1)}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              value={count}
              onChange={(e) => setTimes(Math.trunc(Number(e.target.value) || 1))}
              aria-label="How many to sell"
              className="tnum h-8 w-16 rounded-[4px] border border-rule bg-transparent px-2 text-center text-field text-text focus:border-current"
            />
            <button
              type="button"
              className="btn-quiet"
              aria-label="One more"
              disabled={count >= max}
              onClick={() => setTimes(count + 1)}
            >
              +
            </button>
            {max > 1 && count !== max && (
              <button type="button" className="btn-quiet" onClick={() => setTimes(max)}>
                all
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="rounded-sm px-5 py-2 text-body font-medium text-ground transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--action)" }}
          >
            {pending ? "Selling" : `Sell ${groupNumber(count)} for ${groupNumber(count * row.worth)} coins`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
