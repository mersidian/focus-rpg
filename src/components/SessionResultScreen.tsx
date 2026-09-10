"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useGameOptional } from "./GameProvider";
import { CountUp } from "./CountUp";
import { groupNumber } from "@/lib/format";
import type { ResolutionSummary } from "@/lib/game-types";

/**
 * What the session came to, for the character rather than the ladder.
 *
 * This screen did not exist. `resolveActivity` built a full account of every
 * session — kills, drops, coins, skill XP, the gear it kept, the ammunition it
 * ran out of, the milestones it paid into the ladder — and its one caller threw
 * the whole thing away. So a fifty-minute fight that stopped after four minutes
 * because the ammunition ran out reported "+1250 XP banked" and not one word
 * more, and the only way to learn what you had actually got was to remember
 * what you chose, open the bank, and search a list of a thousand stacks with no
 * timestamp and no ordering by recency.
 *
 * It comes after the report rather than instead of it: resolution runs when a
 * session is logged, so the reward is not known until the honesty fork is
 * answered. A "just focus" session resolves to null and never lands here at
 * all — that falls out of the null rather than being a case bolted on.
 *
 * No Fraunces (§8), no cards, no shadows. Hairlines, one accent, and the
 * motion the app already owns.
 */
/**
 * Hoisted, because it is a dependency. Written inline, this was a new function
 * on every render, so the Escape listener below detached and reattached every
 * time the screen drew — which is what the dependency warning was pointing at.
 */
const NOTHING = () => {};

export function SessionResultScreen({
  result,
  onDismiss,
}: {
  result: ResolutionSummary;
  onDismiss?: () => void;
}) {
  // Same shape as the toasts: the provider when there is one, a prop when there
  // is not, so the screen can be rendered and looked at on its own.
  const game = useGameOptional();
  const dismissGameResult = onDismiss ?? game?.dismissGameResult ?? NOTHING;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissGameResult();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissGameResult]);

  const milestoneXp = result.milestones.reduce((n, m) => n + m.xp, 0);

  return (
    <main className="animate-rise mx-auto w-full max-w-2xl px-6 pb-24 pt-16 sm:px-10">
      {/* One preposition per kind. "in" wants a place: you are in an area, but
          you are *against* a boss and you are simply mining. */}
      <p className="text-body text-faint">
        <span className="tnum">{result.minutes ?? 0}</span> minutes
        {result.kind === "gathering" && <> {result.skill}</>}
        {result.kind === "combat" && result.where && <> in {result.where}</>}
        {result.kind === "boss" && result.where && <> against {result.where}</>}.
      </p>

      <Headline result={result} />

      {result.kind === "gathering" && <GatheringDetail result={result} />}
      {result.kind !== "gathering" && <CombatDetail result={result} />}

      {result.milestones.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="text-lead text-text">Paid toward your rank</h2>
          <ul className="mt-3">
            {result.milestones.map((m, i) => (
              <li
                key={m.marker}
                className="cell-in flex items-baseline justify-between gap-4 border-b border-rule py-2 text-body last:border-0"
                style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              >
                <span className="text-dim">{m.label}</span>
                <span className="tnum shrink-0" style={{ color: "var(--tier)" }}>
                  +{groupNumber(m.xp)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-body leading-relaxed text-faint">
            <span className="tnum text-dim">+{groupNumber(milestoneXp)}</span> XP, on top of
            what the session itself paid. Each of these is paid once and never again.
          </p>
        </section>
      )}

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={dismissGameResult}
          className="rounded-sm px-6 py-4 text-lead font-medium text-ground transition-opacity"
          style={{ backgroundColor: "var(--action)" }}
        >
          Carry on
        </button>
        <Link
          href="/game/bank?new=1"
          className="text-body text-faint underline underline-offset-4 transition-colors hover:text-dim"
        >
          See it in the bank
        </Link>
      </div>
    </main>
  );
}

/**
 * The one line that has to be true.
 *
 * A session that stopped early must not read as a success, so the failure owns
 * the headline rather than sitting in a footnote under a large happy number.
 */
function Headline({ result }: { result: ResolutionSummary }) {
  if (result.outOfAmmo) {
    const stoppedAt = Math.round((result.secondsFought ?? 0) / 60);
    return (
      <>
        <h1 className="mt-2 text-title font-medium tracking-tight sm:text-hero">
          Your ammunition ran out
          {stoppedAt > 0 && (
            <>
              {" "}
              <span className="tnum">{stoppedAt}</span> minutes in
            </>
          )}
          .
        </h1>
        <p className="mt-4 max-w-prose text-lead leading-relaxed text-dim">
          <span className="tnum">{result.kills ?? 0}</span>{" "}
          {result.kills === 1 ? "kill" : "kills"}, and then nothing.
        </p>
        <p
          className="mt-4 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          You brought <span className="tnum">{result.ammoCarried ?? 0}</span> rounds and spent
          all of them.{" "}
          {wanted(result) !== null && (
            <>
              {result.minutes} minutes at that rate wants about{" "}
              <span className="tnum">{wanted(result)}</span>.{" "}
            </>
          )}
          The session paid its XP in full — this cost you the loot, not the focus.
        </p>
      </>
    );
  }

  if (result.kind === "boss") {
    return (
      <>
        <h1 className="mt-2 text-title font-medium tracking-tight sm:text-hero">
          {result.bossDown ? (
            <span style={{ color: "var(--tier)" }}>{result.bossName ?? "It"} is down.</span>
          ) : (
            <>{result.bossName ?? "It"} held.</>
          )}
        </h1>
        {!result.bossDown && (
          <>
            <div className="mt-5 h-[2px] w-full bg-rule">
              <div
                className="h-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.round((result.bossProgress ?? 0) * 100)}%`,
                  backgroundColor: "var(--tier)",
                }}
              />
            </div>
            <p className="mt-2 text-note text-faint">
              <span className="tnum">{Math.round((result.bossProgress ?? 0) * 100)}%</span> of
              the way through
            </p>
            <p className="mt-5 max-w-prose text-body leading-relaxed text-dim">
              {result.bossTooShort ? (
                <>
                  A {result.minutes} was not long enough. More offence shortens the fight, and
                  nothing else will — it is exactly where you left it.
                </>
              ) : (
                <>
                  You reached it with time to spare and lost the fight.
                  {result.bossWeakTo && result.style && result.bossWeakTo !== result.style && (
                    <>
                      {" "}
                      It is weak to {result.bossWeakTo} and you fought as {result.style}, which
                      cost you most of your offence.
                    </>
                  )}{" "}
                  Nothing was taken that you cannot replace, and it is exactly where you left
                  it.
                </>
              )}
            </p>
          </>
        )}
      </>
    );
  }

  if (result.kind === "combat") {
    const away = result.failures ?? 0;
    return (
      <>
        <h1 className="mt-2 text-title font-medium tracking-tight sm:text-hero">
          <span className="tnum animate-pop inline-block" style={{ color: "var(--tier)" }}>
            {result.kills ?? 0}
          </span>{" "}
          {result.kills === 1 ? "kill" : "kills"}
          {away > 0 && (
            <span className="text-dim">
              {" — "}
              <span className="tnum">{away}</span> got away
            </span>
          )}
        </h1>
        {result.killsByRarity && <RarityLine by={result.killsByRarity} />}
      </>
    );
  }

  const first = result.items[0];
  return (
    <h1 className="mt-2 text-title font-medium tracking-tight sm:text-hero">
      <span className="tnum animate-pop inline-block" style={{ color: "var(--tier)" }}>
        <CountUp value={result.units ?? 0} />
      </span>{" "}
      {first?.name ?? "units"}
    </h1>
  );
}

/** How many rounds a session of this length would have wanted. */
function wanted(result: ResolutionSummary): number | null {
  const used = result.ammoUsed ?? 0;
  const fought = result.secondsFought ?? 0;
  const total = (result.minutes ?? 0) * 60;
  if (used <= 0 || fought <= 0 || total <= 0) return null;
  return Math.round((used / fought) * total);
}

function RarityLine({ by }: { by: Record<string, number> }) {
  const notable = Object.entries(by).filter(([k]) => k !== "common");
  if (notable.length === 0) return null;
  return (
    <p className="mt-4 text-body leading-relaxed text-dim">
      {notable.map(([rarity, n], i) => (
        <span key={rarity}>
          {i > 0 && ", "}
          <span className="tnum">{n}</span>{" "}
          <span style={rarity === "legendary" ? { color: "var(--tier)" } : undefined}>
            {rarity}
          </span>
        </span>
      ))}
      , the rest common.
    </p>
  );
}

/**
 * Where the number came from.
 *
 * The house rule: a figure that is the product of a multiplier has to show its
 * parts, because "a number the user cannot take apart is a number they cannot
 * trust, and they will assume the smallest of the possible explanations". A
 * factor of exactly 1 is dropped — listing what did nothing would turn this
 * into boilerplate nobody reads.
 */
function GatheringDetail({ result }: { result: ResolutionSummary }) {
  const parts = (result.yieldParts ?? []).filter((p) => Math.abs(p.factor - 1) > 0.001);

  return (
    <>
      {parts.length > 0 && (
        <section className="mt-8 border-t border-rule pt-6">
          <h2 className="text-lead text-text">Where that came from</h2>
          <ul className="mt-3">
            {parts.map((p) => (
              <li
                key={p.label}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-2 text-body last:border-0"
              >
                <span className="text-dim">{p.label}</span>
                <span className="tnum shrink-0 text-faint">×{p.factor.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          {result.unitsExpected !== undefined && (
            <p className="mt-3 text-body text-faint">
              <span className="tnum">{result.unitsExpected.toFixed(1)}</span> expected,{" "}
              <span className="tnum text-dim">{result.units ?? 0}</span> rolled.
            </p>
          )}
        </section>
      )}
      <Earnings result={result} />
    </>
  );
}

function CombatDetail({ result }: { result: ResolutionSummary }) {
  const drops = result.coinsFromDrops ?? 0;
  const salvage = result.coinsFromSalvage ?? 0;

  return (
    <>
      {result.coins > 0 && (
        <section className="mt-8 border-t border-rule pt-6">
          <h2 className="text-lead text-text">Coins</h2>
          <p className="mt-3 text-title" style={{ color: "var(--tier)" }}>
            <span className="tnum">
              +<CountUp value={result.coins} />
            </span>
          </p>
          {drops > 0 && salvage > 0 && (
            <ul className="mt-3">
              <li className="flex items-baseline justify-between gap-4 border-b border-rule py-2 text-body">
                <span className="text-dim">what they dropped</span>
                <span className="tnum shrink-0 text-faint">{groupNumber(drops)}</span>
              </li>
              <li className="flex items-baseline justify-between gap-4 py-2 text-body">
                <span className="text-dim">gear sold on the way in</span>
                <span className="tnum shrink-0 text-faint">{groupNumber(salvage)}</span>
              </li>
            </ul>
          )}
        </section>
      )}

      {result.equipment && result.equipment.length > 0 && (
        <section className="mt-8 border-t border-rule pt-6">
          <h2 className="text-lead text-text">Kept</h2>
          <ul className="mt-3">
            {result.equipment.map((piece, i) => (
              <li
                key={`${piece.name}-${i}`}
                className="cell-in flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2 text-body last:border-0"
                style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              >
                <span className="min-w-0 flex-1 text-text">{piece.name}</span>
                <span className="text-note text-faint">{piece.quality}</span>
                <span className="tnum w-16 shrink-0 text-right text-faint">
                  {Math.round(piece.percentile * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Cost result={result} />
      <Earnings result={result} />
    </>
  );
}

/** What the session spent, which is the half a reward screen usually hides. */
function Cost({ result }: { result: ResolutionSummary }) {
  const rations = result.rationsUsed ?? 0;
  const salvaged = result.equipmentSalvaged ?? 0;
  if (rations === 0 && salvaged === 0 && !result.ranDry) return null;

  return (
    <p className="mt-8 border-l-2 border-rule pl-4 text-body leading-relaxed text-dim">
      {rations > 0 && (
        <>
          <span className="tnum">{result.failures ?? 0}</span>{" "}
          {result.failures === 1 ? "failure" : "failures"} cost{" "}
          <span className="tnum">{rations}</span> {rations === 1 ? "ration" : "rations"} and as
          many knocks on your weapon.{" "}
        </>
      )}
      {salvaged > 0 && (
        <>
          <span className="tnum">{salvaged}</span>{" "}
          {salvaged === 1 ? "piece was" : "pieces were"} below your salvage line and never
          reached the bank.{" "}
        </>
      )}
      {result.ranDry && (
        <>Your rations ran out partway through — nothing was taken that you did not have.</>
      )}
    </p>
  );
}

function Earnings({ result }: { result: ResolutionSummary }) {
  return (
    <p className="mt-8 text-body leading-relaxed text-faint">
      <span className="tnum text-dim">+{groupNumber(result.skillXp)}</span>{" "}
      {result.skill} XP
      {result.fuel > 0 && (
        <>
          {" · "}
          <span className="tnum text-dim">+{groupNumber(result.fuel)}</span> fuel
        </>
      )}
      {result.kind === "gathering" && result.coins > 0 && (
        <>
          {" · "}
          <span className="tnum text-dim">+{groupNumber(result.coins)}</span> coins
        </>
      )}
      {result.salvageStones !== undefined && result.salvageStones > 0 && (
        <>
          {" · "}
          <span className="tnum text-dim">{result.salvageStones}</span> upgrade stones
        </>
      )}
    </p>
  );
}
