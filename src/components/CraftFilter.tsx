"use client";

import { useMemo, useState } from "react";
import { CraftButton } from "./GameActions";
import { Icon } from "./Icon";
import { DepthValue } from "./GameUi";
import { markFor } from "./item-mark";
import { MAX_TIER } from "@/lib/game/tiers";
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
 * Crafting is search-first, for the reason the bank is.
 *
 * Eleven tables sorted by tier and capped at twenty-four rows meant a smith saw
 * tier 1 and nothing else: twenty-two of smithing's recipes sit at tier 1, so
 * the cap was spent before the second rung. The count underneath said "24 of
 * 88" — honest, and no help at all in finding a bronze pickaxe.
 *
 * The bank's header already argued this case for items: "a grid you scroll is
 * the inventory-management minigame this app cannot afford". Two thousand
 * recipes is the same problem, and this is the same answer — a search, a chip
 * per skill, and one toggle for the question actually being asked, which is
 * what can I make right now.
 *
 * Craftable first and then deepest, because a crafting list is a list of what
 * to do next: the things you have the materials for lead, and the deepest of
 * those leads them.
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

export function CraftFilter({
  rows,
  fuel,
  locked,
}: {
  rows: CraftRow[];
  fuel: number;
  /** Skills the character level has not opened yet, shallowest first. */
  locked: { label: string; at: number }[];
}) {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("all");
  const [ready, setReady] = useState(false);

  const skills = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.skill, r.skillLabel);
    return [["all", "all"] as const, ...[...seen].sort((a, b) => a[1].localeCompare(b[1]))];
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => skill === "all" || r.skill === skill)
      .filter((r) => !ready || r.ok)
      .filter(
        (r) =>
          q === "" ||
          r.name.toLowerCase().includes(q) ||
          r.inputs.some((i) => i.name.toLowerCase().includes(q)),
      )
      /*
       * What you can make, first — then deepest. Sorting by tier alone opened
       * the page on a wall of the deepest things within reach, every one of
       * them short of materials, which answers "what could I eventually make"
       * when the question is "what can I make now".
       */
      .sort(
        (a, b) =>
          Number(b.ok) - Number(a.ok) || b.tier - a.tier || a.name.localeCompare(b.name),
      );
  }, [rows, query, skill, ready]);

  const canMake = rows.filter((r) => r.ok).length;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what you can make, or what it takes"
          className="min-w-0 flex-1 border-b border-rule bg-transparent py-2 text-field text-text placeholder:text-faint focus:border-current"
          style={{ caretColor: "var(--tier)" }}
        />
        <button
          type="button"
          onClick={() => setReady((v) => !v)}
          aria-pressed={ready}
          className={`py-1 text-note ${ready ? "" : "text-faint transition-colors hover:text-dim"}`}
          style={ready ? { color: "var(--tier)" } : undefined}
        >
          can make now ({canMake})
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 text-note">
        {skills.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSkill(key)}
            className={`py-1 ${key === skill ? "" : "text-faint transition-colors hover:text-dim"}`}
            style={key === skill ? { color: "var(--tier)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-note text-faint">
        <span className="tnum">{shown.length}</span> of <span className="tnum">{rows.length}</span>{" "}
        within reach · fuel <span className="tnum text-dim">{fuel.toLocaleString()}</span>
      </p>

      {/* What is not here and when it arrives. A page that quietly omits a
          third of the game is worse than one that says what it omitted. */}
      {locked.length > 0 && (
        <p className="mt-1 text-note text-faint">
          Not open yet:{" "}
          {locked.map((s, n) => (
            <span key={s.label}>
              {n > 0 && " · "}
              {s.label} at character level <span className="tnum text-dim">{s.at}</span>
            </span>
          ))}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-6 text-body text-faint">
          Nothing matches. {ready && "Try it without “can make now”, which is showing only what you already have the materials and the level for."}
        </p>
      ) : (
        <ul className="mt-2">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3 text-body last:border-0"
            >
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                {/*
                  Hue for kind, accent for standing — the same pairing the shelf
                  uses, so a Bronze Pickaxe is the same green mark in both
                  places and the tier beside it is the only thing that moves.
                */}
                <Icon
                  name={markFor({
                    id: r.outputId,
                    cls: r.outputClass,
                    skill: r.outputSkill,
                    style: r.outputStyle,
                  })}
                  className="size-5 shrink-0 self-start"
                  style={{ color: classHue(r.outputClass) }}
                />
                <span className="min-w-0 text-dim">
                  {r.name}
                  {r.qty > 1 && <span className="text-faint"> ×{r.qty}</span>}
                  {" "}
                  <DepthValue step={r.tier} steps={MAX_TIER} label={`t${r.tier}`} />
                  {/* What you already hold of the thing you are about to make. */}
                  {r.held > 0 && (
                    <span className="text-faint">
                      {" · "}
                      <span className="tnum">{r.held.toLocaleString()}</span> held
                    </span>
                  )}
                </span>
              </span>

              <span className="shrink-0">
                {r.ok ? (
                  <CraftButton recipeId={r.id} max={runsPossible(r, fuel)} />
                ) : (
                  <span className="text-note text-faint">{r.missing}</span>
                )}
              </span>

              {/* Every input with what it wants and what you have, so a refusal
                  is a shopping list rather than a single clipped phrase. */}
              <span className="w-full text-note text-faint">
                {r.inputs.map((i, n) => (
                  <span key={i.name}>
                    {n > 0 && " · "}
                    <span className="tnum">{i.need}</span> {i.name}{" "}
                    <span
                      className="tnum"
                      style={i.have < i.need ? { color: "var(--color-warn)" } : undefined}
                    >
                      ({i.have.toLocaleString()})
                    </span>
                  </span>
                ))}
                {" · "}
                <span className="tnum">{r.fuel}</span> fuel · level{" "}
                <span className="tnum">{r.level}</span> {r.skillLabel.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
