import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { loadState } from "@/lib/game-state";
import { loadAchievementBoard } from "@/lib/achievements/service";
import { TitlePicker } from "@/components/TitlePicker";
import { PrestigeChoice } from "@/components/PrestigeChoice";
import { loadPrestigeView } from "@/lib/prestige-service";
import { ETERNAL_RECURRENCE, MAX_STARS, hasEternalRecurrence } from "@/lib/prestige";
import { LEVEL_XP, RANKS, TIERS, describeLevel, rankProgress } from "@/lib/levels";
import { completionRatio, groupNumber, hours, tierAccent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CharacterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [state, board, prestige] = await Promise.all([
    loadState(session.user.id),
    loadAchievementBoard(session.user.id),
    loadPrestigeView(session.user.id),
  ]);
  const worn = board.availableTitles.find((t) => t.id === board.wornTitle) ?? null;
  const info = describeLevel(state.level);
  const progress = rankProgress(state.xp, state.level);
  const ratio = completionRatio(state.sessionsCompleted, state.sessionsAbandoned);
  const accent = tierAccent(info.hue, info.intensity);

  return (
    <div style={{ "--tier": accent } as CSSProperties}>
      <Nav current="/character" />
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="display text-5xl leading-[0.95] sm:text-7xl" style={{ color: accent }}>
          {prestige.stars > 0 && (
            <span className="tnum mr-3 align-middle text-[0.5em]" title={`${prestige.stars} prestige`}>
              ★{prestige.stars}
            </span>
          )}
          {worn ? (
            worn.title
          ) : (
            <>
              {info.title}{" "}
              <span className="opacity-70" style={{ fontVariationSettings: '"WONK" 1' }}>
                {info.rank}
              </span>
            </>
          )}
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-faint">
          {worn && <>{info.fullTitle}, </>}
          Level <span className="tnum text-dim">{state.level}</span> of 100
          {prestige.stars > 0 && (
            <>
              {" — "}
              <span className="tnum text-dim">+{prestige.bonusPercent}%</span> XP from{" "}
              <span className="tnum">{prestige.stars}</span>{" "}
              {prestige.stars === 1 ? "star" : "stars"}
            </>
          )}
          {prestige.cycles > 0 && (
            <>
              {", "}
              <span className="tnum">{prestige.cycles}</span>{" "}
              {prestige.cycles === 1 ? "cycle" : "cycles"} behind you
            </>
          )}
        </p>
        {hasEternalRecurrence(prestige.stars) && (
          <p className="mt-2 text-[13px]" style={{ color: accent }}>
            {ETERNAL_RECURRENCE} — {MAX_STARS} stars, the end of that road.
          </p>
        )}

        <div className="mt-10 h-[2px] w-full bg-rule">
          <div className="h-full" style={{ width: `${progress * 100}%`, backgroundColor: accent }} />
        </div>
        <p className="mt-2 text-[13px] text-faint">
          <span className="tnum text-dim">{groupNumber(state.xp)}</span> XP
          {info.nextXp !== null && (
            <>
              {" — "}
              <span className="tnum text-dim">{groupNumber(Math.max(0, info.nextXp - state.xp))}</span> to{" "}
              {describeLevel(state.level + 1).fullTitle}
            </>
          )}
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t border-rule pt-6 text-[13px]">
          <div>
            <dd className="tnum text-xl">{hours(state.lifetimeFocusedMs)}</dd>
            <dt className="mt-1 text-faint">focused, lifetime</dt>
          </div>
          <div>
            <dd className="tnum text-xl">{groupNumber(state.sessionsCompleted)}</dd>
            <dt className="mt-1 text-faint">sessions finished</dt>
          </div>
          <div>
            <dd className="tnum text-xl">{groupNumber(state.sessionsAbandoned)}</dd>
            <dt className="mt-1 text-faint">abandoned</dt>
          </div>
          <div>
            <dd className="tnum text-xl">
              {ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
            </dd>
            <dt className="mt-1 text-faint">completion ratio</dt>
          </div>
        </dl>

        {prestige.offer.available && (
          <PrestigeChoice stars={prestige.stars} xp={state.xp} levelTitle={info.fullTitle} />
        )}

        {prestige.declinedAt !== null && (
          <p className="mt-10 border-l-2 border-rule pl-4 text-[13px] leading-relaxed text-faint">
            You chose to press on this cycle. The offer returns if you ever reset.
          </p>
        )}

        <section className="mt-16">
          <h2 className="text-[15px] text-text">Title</h2>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
            Wear an earned achievement title instead of your rank. It changes what this page
            calls you, not what you are.
          </p>
          <TitlePicker
            titles={board.availableTitles}
            worn={board.wornTitle}
            levelTitle={info.fullTitle}
          />
        </section>

        <section className="mt-16">
          <h2 className="text-[15px] text-text">The ladder</h2>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-faint">
            Twenty names, five ranks each. Mythic V sits on exactly ten thousand focused
            hours — the cap is the number, not a ceiling.
          </p>

          <ol className="mt-8">
            {TIERS.map((tier, k) => {
              const first = k * 5 + 1;
              const last = first + 4;
              const reached = state.level >= first;
              const current = info.tierIndex === k;
              const tierColor = tierAccent(tier.hue, tier.intensity);
              return (
                <li
                  key={tier.title}
                  className="flex items-baseline gap-3 border-b border-rule py-3 text-[13px] last:border-0 sm:gap-4"
                  style={current ? { backgroundColor: "var(--color-lift)" } : undefined}
                >
                  <span
                    aria-hidden
                    className="h-3 w-[2px] shrink-0 self-center"
                    style={{ backgroundColor: reached ? tierColor : "var(--color-rule)" }}
                  />
                  <span
                    className="w-24 shrink-0 sm:w-32"
                    style={{ color: reached ? tierColor : "var(--color-faint)" }}
                  >
                    {tier.title}
                  </span>
                  <span className="tnum shrink-0 text-faint">
                    {first}–{last}
                  </span>
                  <span className="ml-auto min-w-0 text-right text-faint">
                    <span className="tnum">{groupNumber(LEVEL_XP[last - 1] / 60)}</span> h
                    {/* The tier is already named on the left of this row;
                        repeating it here pushes the row off a narrow screen. */}
                    <span className="hidden sm:inline">
                      {" "}
                      to {tier.title} {RANKS[4]}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
