import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rail, KindMark, KindDot } from "@/components/GameUi";
import type { IconName } from "@/components/Icon";
import { skillKindHue } from "@/lib/palette";
import { skillViews } from "@/lib/game-view-service";
import { depthInk, groupNumber } from "@/lib/format";
import { MAX_SKILL_LEVEL, SKILL_XP } from "@/lib/game/skills";

export const dynamic = "force-dynamic";

const KINDS = [
  { key: "gathering", label: "Gathering", note: "The session is the action: minutes are the only input." },
  { key: "combat", label: "Combat", note: "Also sessions. Kill count comes from minutes and gear." },
  { key: "processing", label: "Processing", note: "Paid for with fuel, between sessions." },
];

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const skills = await skillViews(session.user.id);
  const total = skills.reduce((n, s) => n + s.level, 0);

  return (
    <Screen
      title="Skills"
      lead={
        <>
          Twenty-two skills, each 1–{MAX_SKILL_LEVEL}. Level {MAX_SKILL_LEVEL} costs{" "}
          <span className="tnum text-dim">{groupNumber(SKILL_XP[MAX_SKILL_LEVEL - 1])}</span> XP —
          about six hundred focused hours on that one skill, so nobody maxes all of them. That is
          deliberate, and it is why no achievement asks you to.
        </>
      }
    >
      <p className="mt-6 text-body text-faint">
        Total level <span className="tnum text-dim">{groupNumber(total)}</span> of{" "}
        <span className="tnum">{groupNumber(skills.length * MAX_SKILL_LEVEL)}</span>
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
                  <div className="flex items-center gap-3">
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
                        <p
                          className="tnum shrink-0"
                          style={{ color: depthInk(s.level, MAX_SKILL_LEVEL) }}
                        >
                          {s.level}
                        </p>
                      </div>
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
                      </p>
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
