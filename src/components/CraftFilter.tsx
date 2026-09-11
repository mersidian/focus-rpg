"use client";

import { useMemo, useState } from "react";
import { CraftButton } from "./GameActions";
import { Depth } from "./GameUi";
import { MAX_TIER } from "@/lib/game/tiers";
import { depthInk } from "@/lib/format";

export type CraftIngredient = { name: string; need: number; have: number };

export type CraftRow = {
  id: string;
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
 * Deepest first, because a crafting list is a list of what to make next and
 * nobody needs reminding they can still make a copper axe.
 */
export function CraftFilter({ rows, fuel }: { rows: CraftRow[]; fuel: number }) {
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
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
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
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <Depth step={r.tier} steps={MAX_TIER} title={`Tier ${r.tier}`} />
                <span className="min-w-0 text-dim">
                  {r.name}
                  {r.qty > 1 && <span className="text-faint"> ×{r.qty}</span>}
                  <span className="tnum" style={{ color: depthInk(r.tier, MAX_TIER) }}>
                    {" "}
                    t{r.tier}
                  </span>
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
                  <CraftButton recipeId={r.id} />
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
