import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Empty, Rail, KindMark, DepthRange, Pips } from "@/components/GameUi";
import { Icon, type IconName } from "@/components/Icon";
import { GUN_ENTRY_TIER, MAX_TIER } from "@/lib/game/tiers";
import { contractsFinished, overview, skillViews } from "@/lib/game-view-service";
import { loadState } from "@/lib/game-state";
import { BIOMES, BIOME_BY_INDEX } from "@/lib/game/biomes";
import {
  BIOME_TRINKET,
  contractAreas,
  contractDepth,
  contractPurse,
  trinketMarker,
} from "@/lib/game/contracts";
import { MAX_SKILL_LEVEL, SKILL_XP } from "@/lib/game/skills";
import { describeEffect } from "@/lib/game/effects";
import { variantsIn } from "@/lib/game/variants";
import { answerTo, type Style } from "@/lib/game/archetypes";
import { RARITIES, spawnPower, successChance, wheelFactor } from "@/lib/game/combat";
import { groupNumber, sinceLabel } from "@/lib/format";
import { skillKindHue } from "@/lib/palette";
import { DropContractButton, TakeContractButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

const PACE: Record<string, string> = { fast: "quick", medium: "steady", slow: "slow" };
const styleMark = (style: Style): IconName => (style === "gun" ? "gunplay" : style);

/** The Slaying level at which the ladder next reaches a deeper biome. */
function nextDepthAt(level: number): number | null {
  const now = contractDepth(level);
  for (let l = level + 1; l <= MAX_SKILL_LEVEL; l++) {
    if (contractDepth(l) > now) return l;
  }
  return null;
}

/**
 * Slaying: the skill, the contract, and the ladder it climbs.
 *
 * It was two blocks — a gauge with a paragraph under it, and a table of the
 * biomes the ladder reached — and the three things a contract is for were each
 * one clause in that paragraph: who to hunt, where, and for what. The target
 * and the purse lead now, as a bounty does; the skill that the purse pays into
 * sits above it with its own rail, because "Slaying 6 adds the next biome" is
 * the reason the skill exists; and the ladder shows the next rung it has not
 * reached, rather than stopping at the last one it has.
 */
export default async function SlayingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const [state, o, done] = await Promise.all([
    loadState(userId),
    overview(userId),
    contractsFinished(userId),
  ]);
  const skill = (await skillViews(userId, state.level)).find((s) => s.key === "slaying");
  const level = skill?.level ?? 1;

  const depth = contractDepth(level);
  const deeper = nextDepthAt(level);
  const claimed = new Set(o.markers);
  const style = (o.equipped.weapon?.spec.style as Style | undefined) ?? null;

  const c = o.contract;
  const purse = c ? contractPurse(c.tier, c.required) : null;
  const biome = c ? BIOME_BY_INDEX.get(c.biome) : null;
  const areas = c ? contractAreas(c.variantName, c.biome) : [];
  const target = c && biome ? variantsIn(biome).find((v) => v.name === c.variantName) : undefined;
  const trinket = c && !claimed.has(trinketMarker(c.biome)) ? BIOME_TRINKET.get(c.biome) : null;
  const odds =
    target && style
      ? successChance(
          o.power.offence * wheelFactor(style, target.style),
          spawnPower(target.tier, RARITIES[0]),
        )
      : null;
  const where =
    biome &&
    `${biome.name}${
      areas.length === 0
        ? ""
        : areas.length === 1
          ? `, area ${areas[0]}`
          : `, areas ${areas[0]}–${areas[areas.length - 1]}`
    }`;

  // The rungs reached, and the one after them, which is what the skill is for.
  const ladder = BIOMES.filter((b) => b.index <= Math.min(BIOMES.length, depth + 1));

  return (
    <Screen title="Slaying" lead="One target at a time, and no deadline.">
      {/* The skill first, because everything below is paid into it. */}
      <div className="mt-8 flex items-center gap-4 border-y border-rule py-5">
        <KindMark large name="slaying" hue={skillKindHue("combat")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-lead text-text">
              Slaying <span className="tnum text-stat leading-none">{level}</span>
            </p>
            <p className="text-note text-faint">
              <span className="tnum text-dim">{groupNumber(done.total)}</span>{" "}
              {done.total === 1 ? "contract" : "contracts"} finished
            </p>
          </div>
          {skill && <Rail progress={skill.progress} />}
          <p className="mt-1.5 text-note text-faint">
            {skill && skill.next !== null && (
              <>
                <span className="tnum">{groupNumber(skill.next - skill.xp)}</span> XP to level{" "}
                <span className="tnum">{level + 1}</span>.{" "}
              </>
            )}
            {deeper === null ? (
              <>Contracts reach every biome.</>
            ) : (
              <>
                Level <span className="tnum text-dim">{deeper}</span> sends contracts one biome
                deeper{deeper > level + 1 && (
                  <>
                    , <span className="tnum">{groupNumber(SKILL_XP[deeper - 1] - (skill?.xp ?? 0))}</span>{" "}
                    XP away
                  </>
                )}
                .
              </>
            )}{" "}
            Every kill raises it, and a finished contract raises it most.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------ the contract */}
        <section>
          <h2 className="border-b border-rule pb-2 text-lead font-medium text-text">
            Your contract
          </h2>
          {c === null || purse === null ? (
            <div className="slot-empty mt-5 p-6">
              <p className="text-stat font-medium leading-tight text-text">No contract taken</p>
              <p className="mt-2 max-w-[52ch] text-body text-faint">
                A contract names one monster and where it lives. Finish it for coins, upgrade
                stones and Slaying XP, and the first one in each biome gives up that biome&apos;s
                trinket. It never expires, and dropping one costs nothing.
              </p>
              <div className="mt-5">
                <TakeContractButton />
              </div>
            </div>
          ) : (
            <div className="slot mt-5 p-6">
              <p className="text-note text-faint">Hunt</p>
              <p className="mt-1 text-head font-medium leading-tight text-text">
                {c.variantName}
              </p>
              <p className="mt-2 text-body text-dim">{where}</p>

              {/* The count, as the thing a contract is. */}
              <div className="mt-6 flex items-baseline justify-between gap-4">
                <p className="tnum text-title leading-none" style={{ color: "var(--tier)" }}>
                  {c.killed}
                  <span className="text-lead text-faint"> / {c.required}</span>
                </p>
                <p className="text-note text-faint">
                  <span className="tnum">{c.required - c.killed}</span> to go
                </p>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-rule">
                <div
                  className="animate-hairline h-full rounded-full"
                  style={{
                    width: `${Math.round((c.killed / Math.max(1, c.required)) * 100)}%`,
                    backgroundColor: "var(--tier)",
                  }}
                />
              </div>

              {target && (
                <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-rule pt-4">
                  <div>
                    <dd className="flex items-center gap-1.5 text-body text-text">
                      <Icon
                        name={styleMark(answerTo(target.style))}
                        className="size-4"
                        style={
                          style === answerTo(target.style) ? { color: "var(--tier)" } : undefined
                        }
                      />
                      {answerTo(target.style)}
                    </dd>
                    <dt className="mt-1 text-note text-faint">
                      weak to
                      {/* Said rather than hidden: below the gun line this
                          monster has no style that beats it. */}
                      {answerTo(target.style) === "gun" && target.tier < GUN_ENTRY_TIER && (
                        <>, and no gun exists before tier {GUN_ENTRY_TIER}</>
                      )}
                    </dt>
                  </div>
                  <div>
                    <dd className="text-body text-text">{PACE[target.species.speed]}</dd>
                    <dt className="mt-1 text-note text-faint">to kill</dt>
                  </div>
                  <div>
                    <dd
                      className="tnum text-body"
                      style={{
                        color:
                          odds === null || odds <= 0.1 ? "var(--color-warn)" : "var(--color-text)",
                      }}
                    >
                      {odds === null ? "unarmed" : `${Math.round(odds * 100)}%`}
                    </dd>
                    <dt className="mt-1 text-note text-faint">of fights you land</dt>
                  </div>
                </dl>
              )}

              {/* The purse, as figures: it was one clause of a sentence. */}
              <div className="mt-6 border-t border-rule pt-4">
                <p className="text-note text-faint">Finishing it pays</p>
                <ul className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-body">
                  <li>
                    <span className="tnum text-stat leading-none text-text">
                      {groupNumber(purse.coins)}
                    </span>{" "}
                    <span className="text-faint">coins</span>
                  </li>
                  <li>
                    <span className="tnum text-stat leading-none text-text">{purse.stones}</span>{" "}
                    <span className="text-faint">
                      upgrade {purse.stones === 1 ? "stone" : "stones"}
                    </span>
                  </li>
                  <li>
                    <span className="tnum text-stat leading-none text-text">
                      {groupNumber(purse.xp)}
                    </span>{" "}
                    <span className="text-faint">Slaying XP</span>
                  </li>
                </ul>
                {trinket && (
                  <p className="mt-3 text-body text-dim">
                    And, as your first in {biome?.name},{" "}
                    <span className="named" style={{ color: "var(--tier)" }}>
                      {trinket.name}
                    </span>
                    : {describeEffect(trinket.effect)}.
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/game/areas?b=${c.biome}`}
                  className="rounded-sm px-4 py-2 text-body font-medium text-ground transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--action)" }}
                >
                  Go to {biome?.name}
                </Link>
                <DropContractButton />
              </div>
              <p className="mt-3 text-note text-faint">
                Kills count when you pick one of its areas before a session. Dropping it costs
                nothing, and the next contract is a different target.
              </p>
            </div>
          )}

          {done.recent.length > 0 && (
            <Block title="Finished lately">
              <ul className="mt-2">
                {done.recent.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 text-body last:border-0"
                  >
                    <span className="min-w-0 truncate text-text">
                      {r.variantName}{" "}
                      <span className="text-faint">
                        in {BIOME_BY_INDEX.get(r.biome)?.name ?? "a biome"}
                      </span>
                    </span>
                    <span className="shrink-0 text-note text-faint">
                      {sinceLabel(r.at.getTime(), o.now)}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </section>

        {/* ------------------------------------------------ the ladder */}
        <section>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <h2 className="text-lead font-medium text-text">Where contracts send you</h2>
            <p className="text-note text-faint">
              <span className="tnum">{Math.min(depth, BIOMES.length)}</span> of{" "}
              <span className="tnum">{BIOMES.length}</span>
            </p>
          </div>
          {/*
            A rung per biome, with the trinket its first contract gives up. The
            rung after the last one reached is drawn too, shut, with the level
            that opens it: a ladder that stops at the top rung you are on gives
            you no reason to climb.
          */}
          <ol className="mt-2">
            {ladder.map((b) => {
              const open = b.index <= depth;
              const prize = BIOME_TRINKET.get(b.index);
              const got = claimed.has(trinketMarker(b.index));
              const here = c?.biome === b.index;
              return (
                <li
                  key={b.index}
                  className={`border-b border-rule py-3 last:border-0 ${open ? "" : "opacity-60"}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="named text-lead text-text">{b.name}</span>
                    <span className="shrink-0 text-note">
                      <DepthRange lo={b.tierLo} hi={b.tierHi} steps={MAX_TIER} />
                    </span>
                  </div>
                  {prize && (
                    <p className="mt-1 text-note text-faint">
                      {got ? (
                        <>
                          <span className="named text-dim">{prize.name}</span>, yours
                        </>
                      ) : (
                        <>
                          First contract gives{" "}
                          <span className="named" style={open ? { color: "var(--tier)" } : undefined}>
                            {prize.name}
                          </span>
                          : {describeEffect(prize.effect)}
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-2 text-note text-faint">
                    {!open ? (
                      <>Opens at Slaying {deeper}</>
                    ) : here ? (
                      <span style={{ color: "var(--tier)" }}>Your contract is here</span>
                    ) : (
                      <>
                        <Pips lit={got ? 1 : 0} of={1} label={got ? "trinket claimed" : "trinket not yet claimed"} />
                        {got ? "claimed" : "not yet claimed"}
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
          {o.contract === null && (
            <Empty>Take a contract and it will be drawn from these, usually the deepest.</Empty>
          )}
        </section>
      </div>
    </Screen>
  );
}
