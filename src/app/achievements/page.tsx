import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { UnlockToast } from "@/components/UnlockToast";
import { loadAchievementBoard } from "@/lib/achievements/service";
import { evaluateAchievements } from "@/lib/achievements/service";
import {
  ALL_FAMILIES as FAMILIES,
  ALL_FAMILY_LABEL as FAMILY_LABEL,
  FAMILIES as TIMER_FAMILIES,
  RARITY_LABEL,
} from "@/lib/achievements/definitions";
import type { AchievementView } from "@/lib/achievements/service";
import { groupNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const RARITY_ALPHA: Record<string, number> = {
  common: 0.32,
  uncommon: 0.5,
  rare: 0.68,
  epic: 0.84,
  legendary: 1,
};

/**
 * The two halves of the list, derived rather than written down.
 *
 * V1's 131 and the game's 224 are one board, and a board is what the page is
 * about — but a user who has never opened the game had to scroll past 224 rows
 * about killing things to reach the end of it. Splitting the index says so once
 * instead of hiding anything. Derived from the exported family lists so adding
 * a family cannot silently drop it off the page.
 */
const TIMER = new Set<string>(TIMER_FAMILIES);

/** How many of the most recent unlocks the trophy case shows. */
const RECENT = 8;

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ fam?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  /*
   * Judged on arrival, so the page can never show a stale board — and the list
   * it returns is now used. It was discarded, so the one route that unlocks
   * achievements as a side effect of being visited was also the one route that
   * could not say it had.
   */
  const unlocked = await evaluateAchievements(userId);

  const board = await loadAchievementBoard(userId);
  const { fam } = await searchParams;

  const earnedXp = board.items.filter((i) => i.unlocked).reduce((n, i) => n + i.xp, 0);

  /*
   * The whole board used to render on every visit: 355 rows in 23 sections, no
   * filter and no index, which is about forty screens of 13px text on a phone
   * and the only affordance for finding anything was the scrollbar. A section
   * per family with a `<details>` would have hidden it without making the
   * document any smaller, so the filter is a search param on the server — the
   * rows that are not shown are not sent.
   */
  const all = fam === "all";
  const one = !all && fam && FAMILIES.includes(fam) ? fam : null;
  const shown = all ? FAMILIES : one ? [one] : [];

  const recent = board.items
    .filter((i) => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0));

  return (
    <>
      <Nav current="/achievements" />
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
        <h1 className="text-title font-medium tracking-tight sm:text-hero">Achievements</h1>
        <p className="mt-3 text-body text-faint">
          <span className="tnum text-dim">{board.progress.unlockedCount}</span> of{" "}
          <span className="tnum">{board.progress.total}</span> earned, worth{" "}
          <span className="tnum text-dim">{groupNumber(earnedXp)}</span> XP so far.
        </p>

        <div className="mt-6 h-[2px] w-full bg-rule">
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{
              width: `${(board.progress.unlockedCount / board.progress.total) * 100}%`,
              backgroundColor: "var(--tier)",
            }}
          />
        </div>

        {!all && !one && (
          <>
            <section className="mt-14">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h2 className="text-lead text-text">Earned</h2>
                {recent.length > RECENT && (
                  <p className="shrink-0 text-note text-faint">
                    latest <span className="tnum">{RECENT}</span> of{" "}
                    <span className="tnum">{recent.length}</span>
                  </p>
                )}
              </div>
              {recent.length === 0 ? (
                <p className="mt-4 max-w-prose text-lead leading-relaxed text-dim">
                  Nothing earned yet. They arrive on their own — for hours put in, for
                  streaks kept, for finishing what you start and for a few things nobody
                  will tell you about in advance. Finish a session and the first few come
                  quickly.
                </p>
              ) : (
                <ul>
                  {recent.slice(0, RECENT).map((item) => (
                    <Row key={item.id} item={item} family={item.family} />
                  ))}
                </ul>
              )}
            </section>

            <FamilyIndex
              title="The timer"
              families={FAMILIES.filter((f) => TIMER.has(f))}
              items={board.items}
            />
            <FamilyIndex
              title="The game"
              families={FAMILIES.filter((f) => !TIMER.has(f))}
              items={board.items}
            />

            <p className="mt-14 text-body text-faint">
              <Link href="/achievements?fam=all" className="underline underline-offset-4">
                Show all {board.progress.total} at once
              </Link>
            </p>
          </>
        )}

        {(all || one) && (
          <p className="mt-8 text-body text-faint">
            <Link href="/achievements" className="underline underline-offset-4">
              Back to the families
            </Link>
          </p>
        )}

        {shown.map((family) => {
          const items = board.items.filter((i) => i.family === family);
          const done = items.filter((i) => i.unlocked).length;
          return (
            <section key={family} className="mt-14">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h2 className="text-lead text-text">{FAMILY_LABEL[family]}</h2>
                <p className="text-body text-faint">
                  <span
                    className="tnum"
                    style={done === items.length ? { color: "var(--tier)" } : undefined}
                  >
                    {done}
                  </span>
                  <span className="tnum"> / {items.length}</span>
                </p>
              </div>
              <ul>
                {items.map((item) => (
                  <Row key={item.id} item={item} family={family} />
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      <UnlockToast unlocked={unlocked} />
    </>
  );
}

/** One family per row: how far along it is, and a way in. */
function FamilyIndex({
  title,
  families,
  items,
}: {
  title: string;
  families: string[];
  items: AchievementView[];
}) {
  const total = items.filter((i) => families.includes(i.family)).length;
  const done = items.filter((i) => families.includes(i.family) && i.unlocked).length;

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-lead text-text">{title}</h2>
        <p className="shrink-0 text-note text-faint">
          <span className="tnum">{done}</span> of <span className="tnum">{total}</span>
        </p>
      </div>
      <ul>
        {families.map((family) => {
          const mine = items.filter((i) => i.family === family);
          const got = mine.filter((i) => i.unlocked).length;
          const complete = got === mine.length;
          return (
            <li key={family} className="border-b border-rule last:border-0">
              <Link
                href={`/achievements?fam=${family}`}
                className="flex items-baseline gap-4 py-3 text-body transition-colors hover:text-text"
              >
                <span className="min-w-0 flex-1 text-dim">{FAMILY_LABEL[family]}</span>
                <span className="w-24 shrink-0">
                  <span className="h-[2px] block w-full bg-rule">
                    <span
                      className="block h-full"
                      style={{
                        width: `${(got / mine.length) * 100}%`,
                        backgroundColor: "var(--tier)",
                      }}
                    />
                  </span>
                </span>
                <span className="tnum w-16 shrink-0 text-right text-faint">
                  <span style={complete ? { color: "var(--tier)" } : undefined}>{got}</span> /{" "}
                  {mine.length}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ item, family }: { item: AchievementView; family: string }) {
  const concealed = item.hidden && !item.unlocked;
  return (
    <li className="flex items-baseline gap-4 border-b border-rule py-3 text-body last:border-0">
      <span
        aria-hidden
        className="mt-1 h-3 w-[3px] shrink-0 self-start"
        style={{
          backgroundColor: item.unlocked ? "var(--action)" : "var(--color-rule)",
          opacity: item.unlocked ? RARITY_ALPHA[item.rarity] : 1,
        }}
      />
      <div className="min-w-0 flex-1">
        <p
          style={{ color: item.unlocked ? "var(--color-text)" : undefined }}
          className={item.unlocked ? "" : "text-faint"}
        >
          {concealed ? "————————" : item.name}
          {item.title && !concealed && (
            <span className="text-faint"> — title: {item.title}</span>
          )}
        </p>
        <p className="mt-1 leading-relaxed text-faint">
          {concealed ? conceal(family) : item.description}
          {item.deferred && !item.unlocked && (
            <span> Waits on prestige, which arrives in a later phase.</span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tnum text-faint">+{groupNumber(item.xp)}</p>
        <p className="mt-1 text-note text-faint">
          {concealed ? "?" : RARITY_LABEL[item.rarity]}
          {item.freezes > 0 && !concealed && (
            <span className="block">
              <span className="tnum">{item.freezes}</span> freeze
              {item.freezes === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

/**
 * What a concealed row says about itself.
 *
 * The old line was `Something in ${family} will trip it`, which for the two
 * hidden families printed "Hidden. Something in hidden will trip it." — under a
 * heading already reading Hidden, beside a name rendered as dashes. A hint that
 * points at itself is worse than admitting there is no hint.
 */
function conceal(family: string): string {
  if (family === "hidden" || family === "hiddenV2") {
    return "Hidden, and there is no clue by design. You will find it or you will not.";
  }
  return `Hidden. Something in ${FAMILY_LABEL[family].toLowerCase()} will trip it.`;
}
