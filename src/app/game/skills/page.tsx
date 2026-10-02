import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rail, KindMark, KindDot } from "@/components/GameUi";
import type { IconName } from "@/components/Icon";
import { skillKindHue } from "@/lib/palette";
import { skillViews } from "@/lib/game-view-service";
import { depthInk, groupNumber } from "@/lib/format";
import { MAX_SKILL_LEVEL, SKILL_XP, nextSkillUnlock, nextTierUnlock } from "@/lib/game/skills";
import { gatheredItemId, itemName } from "@/lib/game/items";
import { loadState } from "@/lib/game-state";

export const dynamic = "force-dynamic";

const KINDS = [
  { key: "gathering", label: "Gathering", note: "Levels with the sessions you spend gathering." },
  { key: "combat", label: "Combat", note: "Levels with the sessions you spend fighting." },
  { key: "processing", label: "Processing", note: "Levels at the bench, paid for in fuel." },
];

/**
 * What the next level worth having buys.
 *
 * A gathering skill opens a material and a processing skill opens the recipes
 * made from it, both at the same level, because one curve gates the tier for
 * both. A combat skill gates nothing — an area asks for gear and a character
 * level — so it says nothing rather than inventing a reward.
 */
function opens(s: { key: string; kind: string; level: number }): string | null {
  if (s.kind === "combat") return null;
  const next = nextTierUnlock(s.level);
  if (!next) return null;
  const what =
    s.kind === "gathering"
      ? itemName(gatheredItemId(s.key, next.tier))
      : `tier ${next.tier} recipes`;
  return `level ${next.level} opens ${what}`;
}

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const state = await loadState(session.user.id);
  const skills = await skillViews(session.user.id, state.level);
  // A locked skill has no level to add — counting it would make the total
  // claim credit for a skill you have never been able to touch.
  const total = skills.reduce((n, s) => n + (s.open ? s.level : 0), 0);
  const open = skills.filter((s) => s.open).length;
  const next = nextSkillUnlock(state.level);

  return (
    <Screen
      title="Skills"
      lead={
        <>
          Each runs from 1 to {MAX_SKILL_LEVEL}, and a level is what opens the next material. The
          last one costs <span className="tnum text-dim">{groupNumber(SKILL_XP[MAX_SKILL_LEVEL - 1])}</span>{" "}
          XP, so pick the ones you want.
        </>
      }
    >
      <p className="mt-6 text-body text-faint">
        <span className="tnum text-dim">{open}</span> of{" "}
        <span className="tnum">{skills.length}</span> open · total level{" "}
        <span className="tnum text-dim">{groupNumber(total)}</span> of{" "}
        <span className="tnum">{groupNumber(open * MAX_SKILL_LEVEL)}</span>
        {next && (
          <>
            {" · "}
            {next.label} at character level <span className="tnum text-dim">{next.unlock}</span>
          </>
        )}
      </p>

      {KINDS.map((kind) => {
        const here = skills.filter((s) => s.kind === kind.key);
        return (
          <Block key={kind.key} title={kind.label} aside={`${here.length}`}>
            <p className="mt-3 flex items-baseline gap-2 text-body text-faint">
              <KindDot hue={skillKindHue(kind.key)} />
              {kind.note}
            </p>
            <ul>
              {here.map((s) => (
                <li key={s.key} className="border-b border-rule py-3 last:border-0">
                  <div className={`flex items-center gap-3 ${s.open ? "" : "opacity-55"}`}>
                    {/*
                      The well says what kind of skill this is; the level beside
                      it says how far along. Two questions, two colours — and
                      the level keeps the earned accent, because that is the one
                      of the two that is a quantity.
                    */}
                    <KindMark name={s.key as IconName} hue={skillKindHue(s.kind)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4 text-body">
                        <p className="min-w-0 truncate text-dim">
                          {s.label} <span className="text-faint">— {s.note}</span>
                        </p>
                        {s.open ? (
                          <p
                            className="tnum shrink-0"
                            style={{ color: depthInk(s.level, MAX_SKILL_LEVEL) }}
                          >
                            {s.level}
                          </p>
                        ) : (
                          <p className="shrink-0 text-note text-faint">locked</p>
                        )}
                      </div>
                      {/*
                        A locked skill keeps its mark, its name and its note and
                        loses only its numbers. Hiding it outright would make
                        the game look smaller than it is; showing it with a zero
                        beside it would be a lie about a skill you have never
                        had. What it gets instead is the one fact that is
                        actually true of it — the level it arrives at.
                      */}
                      {s.open ? (
                        <>
                          <Rail progress={s.progress} />
                          <p className="mt-1 text-note text-faint">
                            <span className="tnum">{groupNumber(s.xp)}</span> xp
                            {s.next !== null && (
                              <>
                                {" · "}
                                <span className="tnum">{groupNumber(s.next - s.xp)}</span> to{" "}
                                {s.level + 1}
                              </>
                            )}
                            {opens(s) && (
                              <>
                                {" · "}
                                <span className="text-dim">{opens(s)}</span>
                              </>
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-note text-faint">
                          Opens at character level{" "}
                          <span className="tnum text-dim">{s.unlock}</span>.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Block>
        );
      })}
    </Screen>
  );
}
