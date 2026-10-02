"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { craftAction } from "@/lib/actions";
import { MAX_CRAFT_AT_ONCE } from "@/lib/constants";
import { Icon } from "./Icon";
import { DepthValue, KindMark } from "./GameUi";
import { markFor } from "./item-mark";
import { MAX_TIER } from "@/lib/game/tiers";
import { groupNumber } from "@/lib/format";
import { classHue } from "@/lib/palette";

export type CraftIngredient = { name: string; need: number; have: number };

export type CraftRow = {
  id: string;
  /** The item this makes, for the mark and its hue. */
  outputId: string;
  outputClass: string;
  /** A tool's or a refined good's own skill, which is what picks its mark. */
  outputSkill?: string;
  /** A weapon's combat style, likewise. */
  outputStyle?: string;
  skill: string;
  skillLabel: string;
  name: string;
  qty: number;
  /** How many of the output you already hold. */
  held: number;
  tier: number;
  fuel: number;
  level: number;
  inputs: CraftIngredient[];
  ok: boolean;
  /** Why not, when it is not. */
  missing: string | null;
};

/**
 * Crafting is a skill, then what it can make, then one recipe at a time.
 *
 * It was one list. Search-first fixed the version before it — eleven capped
 * tables — and left 379 rows on the page, each two lines tall with its own
 * quantity box, max button and Make button: a little over a thousand controls,
 * sorted so that the forty you could use sat above three hundred you could not.
 * Nothing was hidden and nothing could be found.
 *
 * So the list says less and the recipe says more. A row is a name and one
 * fact — how many you can make, or the one thing it is short — and everything
 * else a recipe knows lives in the popup that opens when you pick it. What you
 * can make leads; the rest of a skill is folded up by tier, and opening a tier
 * is how you go and look at what you cannot make yet.
 */
/**
 * How many times this recipe could run right now.
 *
 * The limiting input, or the fuel, whichever runs out first — which is exactly
 * the number a "max" shortcut should offer and one the row already has every
 * part of.
 */
function runsPossible(r: CraftRow, fuel: number): number {
  const byInput = r.inputs.map((i) => Math.floor(i.have / Math.max(1, i.need)));
  const byFuel = Math.floor(fuel / Math.max(1, r.fuel));
  return Math.max(0, Math.min(byFuel, ...byInput));
}

/** Four rows of three. Enough to choose from, short enough to see the tiers under it. */
const READY_SHOWN = 12;

/** As many search results as are worth drawing. A longer list wants a longer query. */
const SEARCH_SHOWN = 60;

export function CraftFilter({
  rows,
  fuel,
  locked,
  initialQuery = "",
}: {
  rows: CraftRow[];
  fuel: number;
  /** Skills the character level has not opened yet, shallowest first. */
  locked: { label: string; at: number }[];
  /** What the search box opens holding, when a link named a recipe. */
  initialQuery?: string;
}) {
  const skills = useMemo(() => {
    const seen = new Map<string, { label: string; ready: number }>();
    for (const r of rows) {
      const entry = seen.get(r.skill) ?? { label: r.skillLabel, ready: 0 };
      if (r.ok) entry.ready += 1;
      seen.set(r.skill, entry);
    }
    return [...seen].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [rows]);

  const [query, setQuery] = useState(initialQuery);
  /*
   * Opens on the skill with the most to do. "All" used to be the default and
   * was the long list; there is no "all" now, because the only question that
   * spans skills is "where is the thing called X", and that is the search box.
   */
  const [skill, setSkill] = useState(
    () => [...skills].sort((a, b) => b[1].ready - a[1].ready)[0]?.[0] ?? "",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [allReady, setAllReady] = useState(false);

  const q = query.trim().toLowerCase();
  const found = useMemo(
    () =>
      q === ""
        ? []
        : rows
            .filter(
              (r) =>
                r.name.toLowerCase().includes(q) ||
                r.inputs.some((i) => i.name.toLowerCase().includes(q)),
            )
            .sort(byUse),
    [rows, q],
  );

  const here = useMemo(() => rows.filter((r) => r.skill === skill), [rows, skill]);
  const ready = useMemo(() => here.filter((r) => r.ok).sort(byUse), [here]);
  const tiers = useMemo(() => {
    const by = new Map<number, CraftRow[]>();
    for (const r of here) by.set(r.tier, [...(by.get(r.tier) ?? []), r]);
    return [...by].sort((a, b) => a[0] - b[0]);
  }, [here]);

  const open = openId ? (rows.find((r) => r.id === openId) ?? null) : null;
  const label = skills.find(([key]) => key === skill)?.[1].label ?? "";

  return (
    <div className="mt-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search every recipe, or what it takes"
        className="h-10 w-full rounded-[4px] border border-rule bg-transparent px-3 text-field text-text placeholder:text-faint focus:border-current"
        style={{ caretColor: "var(--tier)" }}
      />

      {q !== "" ? (
        <section className="mt-6">
          <p className="text-note text-faint">
            <span className="tnum text-dim">{found.length}</span>{" "}
            {found.length === 1 ? "recipe matches" : "recipes match"}
            {found.length > SEARCH_SHOWN && <>, showing the first {SEARCH_SHOWN}</>}
          </p>
          {found.length === 0 ? (
            <p className="mt-4 text-body text-faint">
              Nothing by that name. A skill that has not opened yet is not listed here.
            </p>
          ) : (
            <Tiles rows={found.slice(0, SEARCH_SHOWN)} fuel={fuel} onOpen={setOpenId} showSkill />
          )}
        </section>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSkill(key)}
                aria-pressed={key === skill}
                className="chip"
              >
                {s.label}
                {/* How many it can make right now, so the chip row is itself
                    the answer to "where should I look". */}
                {s.ready > 0 && <span className="tnum ml-1.5 text-dim">{s.ready}</span>}
              </button>
            ))}
          </div>

          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
              <h2 className="text-lead font-medium text-text">Ready to make</h2>
              <p className="text-note text-faint">
                {label}, <span className="tnum text-dim">{groupNumber(fuel)}</span> fuel
              </p>
            </div>
            {ready.length === 0 ? (
              <p className="mt-4 max-w-[62ch] text-body text-faint">
                Nothing in {label} right now. Open a tier below to see what each recipe is short.
              </p>
            ) : (
              <>
                <Tiles
                  rows={allReady ? ready : ready.slice(0, READY_SHOWN)}
                  fuel={fuel}
                  onOpen={setOpenId}
                />
                {/* Deepest first, so the dozen shown are the dozen worth
                    making; the rest are one press away and also sit in their
                    tiers below. */}
                {ready.length > READY_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setAllReady((v) => !v)}
                    className="btn-quiet mt-4"
                  >
                    {allReady ? "Show fewer" : `Show all ${ready.length}`}
                  </button>
                )}
              </>
            )}
          </section>

          <section className="mt-10">
            <h2 className="border-b border-rule pb-2 text-lead font-medium text-text">
              Everything in {label}
            </h2>
            {/*
              Folded, and native: a tier you are not looking at costs one line
              and no JavaScript. Each says how much of it you could make, which
              is the reason to open one.
            */}
            {tiers.map(([tier, list]) => {
              const can = list.filter((r) => r.ok).length;
              return (
                <details key={`${skill}:${tier}`} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3 text-body [&::-webkit-details-marker]:hidden">
                    <span className="flex items-baseline gap-3 text-text">
                      <span aria-hidden className="w-3 text-faint group-open:hidden">
                        +
                      </span>
                      <span aria-hidden className="hidden w-3 text-faint group-open:inline">
                        −
                      </span>
                      <DepthValue step={tier} steps={MAX_TIER} label={`Tier ${tier}`} />
                      <span className="text-note text-faint">
                        level <span className="tnum">{list[0]?.level ?? 1}</span>
                      </span>
                    </span>
                    <span className="text-note text-faint">
                      {can > 0 ? (
                        <>
                          <span className="tnum" style={{ color: "var(--tier)" }}>
                            {can}
                          </span>{" "}
                          of <span className="tnum">{list.length}</span> ready
                        </>
                      ) : (
                        <>
                          <span className="tnum">{list.length}</span> recipes
                        </>
                      )}
                    </span>
                  </summary>
                  <div className="pb-4">
                    <Tiles rows={[...list].sort(byUse)} fuel={fuel} onOpen={setOpenId} />
                  </div>
                </details>
              );
            })}
          </section>

          {/* What is not here and when it arrives. A page that quietly omits a
              third of the game is worse than one that says what it omitted. */}
          {locked.length > 0 && (
            <p className="mt-6 text-note text-faint">
              Not open yet:{" "}
              {locked.map((s, n) => (
                <span key={s.label}>
                  {n > 0 && ", "}
                  {s.label} at character level <span className="tnum text-dim">{s.at}</span>
                </span>
              ))}
              .
            </p>
          )}
        </>
      )}

      {/* Keyed, so opening a second recipe starts with a clean count and no
          leftover result from the first. */}
      {open && (
        <CraftDialog key={open.id} row={open} fuel={fuel} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

/** What you can make first, then deepest, then by name. */
function byUse(a: CraftRow, b: CraftRow): number {
  return Number(b.ok) - Number(a.ok) || b.tier - a.tier || a.name.localeCompare(b.name);
}

/**
 * A recipe, as much of it as a list needs: what it is and one fact about it.
 *
 * The whole cell is the button. Hairlines rather than boxes — there can be a
 * hundred of these, and a hundred outlined boxes is a wall.
 */
function Tiles({
  rows,
  fuel,
  onOpen,
  showSkill = false,
}: {
  rows: CraftRow[];
  fuel: number;
  onOpen: (id: string) => void;
  /** In search results, where the rows are not all one skill's. */
  showSkill?: boolean;
}) {
  return (
    <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const runs = runsPossible(r, fuel);
        return (
          <li key={r.id} className="border-b border-rule">
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-lift/60"
            >
              <Icon
                name={markFor({
                  id: r.outputId,
                  cls: r.outputClass,
                  skill: r.outputSkill,
                  style: r.outputStyle,
                })}
                className="size-5 shrink-0"
                style={{ color: classHue(r.outputClass) }}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-body ${r.ok ? "text-text" : "text-dim"}`}>
                  {r.name}
                  {r.qty > 1 && <span className="text-faint"> ×{r.qty}</span>}
                </span>
                <span className="block truncate text-note text-faint">
                  {r.ok ? (
                    <span style={{ color: "var(--tier)" }}>
                      can make <span className="tnum">{runs}</span>
                    </span>
                  ) : (
                    <>needs {r.missing}</>
                  )}
                  {showSkill && <>, {r.skillLabel.toLowerCase()}</>}
                </span>
              </span>
              <DepthValue step={r.tier} steps={MAX_TIER} label={`t${r.tier}`} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type Made =
  | { ok: true; count: number; xp: number; fuelSpent: number; levels: { level: string; xp: number }[] }
  | { ok: false; text: string };

/**
 * One recipe, opened.
 *
 * Making something used to answer with nothing at all: the craft action
 * returns what was made, how much XP it paid and any milestone it crossed, and
 * the button that called it looked for a `note` the action never sends. The
 * numbers in the row changed and that was the whole of the feedback.
 *
 * A native `<dialog>`, opened modally: focus is trapped, Escape closes it and
 * the page behind is inert, none of which has to be written. It stays open
 * after a craft, because the next thing you do after making three bars is
 * usually make three more.
 */
function CraftDialog({
  row,
  fuel,
  onClose,
}: {
  row: CraftRow;
  fuel: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [times, setTimes] = useState(1);
  const [made, setMade] = useState<Made | null>(null);
  const [pending, start] = useTransition();

  // Guarded rather than undone on cleanup: closing in a cleanup would fire the
  // dialog's own close event, and in development — where effects run twice —
  // that would shut the popup the moment it opened.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const max = row.ok ? Math.min(MAX_CRAFT_AT_ONCE, runsPossible(row, fuel)) : 0;
  // Clamped on the way out as well as in: after a craft the materials are
  // fewer, and the box must never show a count the server would refuse.
  const count = Math.max(1, Math.min(times, Math.max(1, max)));
  const can = max >= 1;

  const make = () => {
    start(async () => {
      try {
        const result = await craftAction(row.id, count);
        setMade(
          result.ok
            ? {
                ok: true,
                count: result.times * row.qty,
                xp: result.xp,
                fuelSpent: result.fuelSpent,
                levels: result.milestones.map((m) => ({
                  level: m.label.split(" ").pop() ?? "",
                  xp: m.xp,
                })),
              }
            : { ok: false, text: `Needs ${result.missing.join(", ")}.` },
        );
      } catch {
        setMade({ ok: false, text: "That did not go through. Check the bank before trying again." });
      }
    });
  };

  const lines = [
    ...row.inputs.map((i) => ({ name: i.name, need: i.need * count, have: i.have })),
    { name: "Fuel", need: row.fuel * count, have: fuel },
  ];

  return (
    <dialog
      ref={ref}
      className="popup"
      aria-labelledby="craft-title"
      onClose={onClose}
      // A press on the backdrop lands on the dialog element itself; a press on
      // anything inside it lands on that thing.
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (can && !pending) make();
        }}
      >
        <header className="flex items-start gap-3">
          <KindMark
            large
            name={markFor({
              id: row.outputId,
              cls: row.outputClass,
              skill: row.outputSkill,
              style: row.outputStyle,
            })}
            hue={classHue(row.outputClass)}
          />
          <div className="min-w-0 flex-1">
            <h2 id="craft-title" className="text-stat font-medium leading-tight text-text">
              {row.name}
            </h2>
            <p className="mt-1 text-note text-faint">
              {row.skillLabel} level <span className="tnum">{row.level}</span>, tier{" "}
              <span className="tnum">{row.tier}</span>
              {row.qty > 1 && (
                <>
                  , <span className="tnum">{row.qty}</span> at a time
                </>
              )}
              {row.held > 0 && (
                <>
                  . You hold <span className="tnum text-dim">{groupNumber(row.held)}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="btn-quiet">
            Close
          </button>
        </header>

        {made && (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-md border px-4 py-3"
            style={{
              borderColor: made.ok
                ? "color-mix(in oklch, var(--action) 55%, var(--color-rule))"
                : "color-mix(in oklch, var(--color-warn) 55%, var(--color-rule))",
              backgroundColor: made.ok
                ? "color-mix(in oklch, var(--action) 12%, transparent)"
                : "color-mix(in oklch, var(--color-warn) 10%, transparent)",
            }}
          >
            {made.ok ? (
              <>
                <p className="text-lead text-text">
                  Made <span className="tnum">{groupNumber(made.count)}</span> {row.name}
                </p>
                <p className="mt-0.5 text-note text-dim">
                  +<span className="tnum">{groupNumber(made.xp)}</span> {row.skillLabel} XP,{" "}
                  <span className="tnum">{made.fuelSpent}</span> fuel spent
                </p>
                {made.levels.map((m) => (
                  <p key={m.level} className="mt-1 text-note" style={{ color: "var(--tier)" }}>
                    {row.skillLabel} reached level {m.level}: +
                    <span className="tnum">{m.xp}</span> character XP
                  </p>
                ))}
              </>
            ) : (
              <p className="text-body text-text">{made.text}</p>
            )}
          </div>
        )}

        <table className="mt-5 w-full border-collapse text-body">
          <thead>
            <tr className="text-note text-faint">
              <th className="border-b border-rule pb-2 text-left font-normal">Takes</th>
              <th className="border-b border-rule pb-2 text-right font-normal">Needs</th>
              <th className="border-b border-rule pb-2 pl-4 text-right font-normal">You hold</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const short = line.have < line.need;
              return (
                <tr key={line.name}>
                  <td className="border-b border-rule py-2.5 text-text">{line.name}</td>
                  <td className="tnum border-b border-rule py-2.5 text-right text-dim">
                    {groupNumber(line.need)}
                  </td>
                  <td
                    className="tnum border-b border-rule py-2.5 pl-4 text-right"
                    style={{ color: short ? "var(--color-warn)" : "var(--color-dim)" }}
                  >
                    {groupNumber(line.have)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!can && (
          <p className="mt-4 text-body" style={{ color: "var(--color-warn)" }}>
            Not yet: needs {row.missing}.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
              aria-label="How many to make"
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
            {pending ? "Making" : `Make ${count}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
