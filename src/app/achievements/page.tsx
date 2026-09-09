import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { loadAchievementBoard } from "@/lib/achievements/service";
import { evaluateAchievements } from "@/lib/achievements/service";
import { ALL_FAMILIES as FAMILIES, ALL_FAMILY_LABEL as FAMILY_LABEL, RARITY_LABEL } from "@/lib/achievements/definitions";
import { groupNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const RARITY_ALPHA: Record<string, number> = {
  common: 0.32,
  uncommon: 0.5,
  rare: 0.68,
  epic: 0.84,
  legendary: 1,
};

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  // Judged on arrival, so the page can never show a stale board.
  await evaluateAchievements(userId);

  const board = await loadAchievementBoard(userId);

  const earnedXp = board.items
    .filter((i) => i.unlocked)
    .reduce((n, i) => n + i.xp, 0);

  return (
    <>
      <Nav current="/achievements" />
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="display text-4xl sm:text-5xl">Achievements</h1>
        <p className="mt-3 text-[13px] text-faint">
          <span className="tnum text-dim">{board.progress.unlockedCount}</span> of{" "}
          <span className="tnum">{board.progress.total}</span> earned, worth{" "}
          <span className="tnum text-dim">{groupNumber(earnedXp)}</span> XP so far.
        </p>

        <div className="mt-6 h-[2px] w-full bg-rule">
          <div
            className="h-full"
            style={{
              width: `${(board.progress.unlockedCount / board.progress.total) * 100}%`,
              backgroundColor: "var(--tier)",
            }}
          />
        </div>

        {FAMILIES.map((family) => {
          const items = board.items.filter((i) => i.family === family);
          const done = items.filter((i) => i.unlocked).length;
          return (
            <section key={family} className="mt-14">
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <h2 className="text-[15px] text-text">{FAMILY_LABEL[family]}</h2>
                <p className="text-[13px] text-faint">
                  <span className="tnum" style={done === items.length ? { color: "var(--tier)" } : undefined}>
                    {done}
                  </span>
                  <span className="tnum"> / {items.length}</span>
                </p>
              </div>

              <ul>
                {items.map((item) => {
                  const concealed = item.hidden && !item.unlocked;
                  return (
                    <li
                      key={item.id}
                      className="flex items-baseline gap-4 border-b border-rule py-3 text-[13px] last:border-0"
                    >
                      <span
                        aria-hidden
                        className="mt-1 h-3 w-[3px] shrink-0 self-start"
                        style={{
                          backgroundColor: item.unlocked ? "var(--action)" : "var(--color-rule)",
                          opacity: item.unlocked ? RARITY_ALPHA[item.rarity] : 1,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p style={{ color: item.unlocked ? "var(--color-text)" : undefined }}
                           className={item.unlocked ? "" : "text-faint"}>
                          {concealed ? "————————" : item.name}
                          {item.title && !concealed && (
                            <span className="text-faint"> — title: {item.title}</span>
                          )}
                        </p>
                        <p className="mt-1 leading-relaxed text-faint">
                          {concealed
                            ? `Hidden. Something in ${FAMILY_LABEL[family].toLowerCase()} will trip it.`
                            : item.description}
                          {item.deferred && !item.unlocked && (
                            <span> Waits on prestige, which arrives in a later phase.</span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum text-faint">+{groupNumber(item.xp)}</p>
                        <p className="mt-1 text-[12px] text-faint">
                          {concealed ? "?" : RARITY_LABEL[item.rarity]}
                          {item.freezes > 0 && !concealed && (
                            <span className="block">
                              <span className="tnum">{item.freezes}</span>{" "}
                              freeze{item.freezes === 1 ? "" : "s"}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </>
  );
}
