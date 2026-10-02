import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Screen, Block, Rows, Empty, Gauge, TierBars } from "@/components/GameUi";
import { UNIQUES } from "@/lib/game/uniques";
import { BOSSES, bossTable } from "@/lib/game/bosses";
import { BIOME_TRINKET, CONTRACT_UNIQUES } from "@/lib/game/contracts";
import { describeEffect } from "@/lib/game/effects";
import { Icon } from "@/components/Icon";
import { markFor } from "@/components/item-mark";
import { classHue } from "@/lib/palette";
import { collectionProgress, itemIndex } from "@/lib/game-view-service";
import { groupNumber } from "@/lib/format";
import { TIERS } from "@/lib/game/tiers";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const found = await collectionProgress(session.user.id);
  const index = itemIndex();

  const byClass = new Map<string, { total: number; got: number }>();
  const byTier = new Map<number, { total: number; got: number }>();
  for (const item of index.values()) {
    const cls = byClass.get(item.cls) ?? { total: 0, got: 0 };
    cls.total += 1;
    if (found.has(item.id)) cls.got += 1;
    byClass.set(item.cls, cls);

    const t = byTier.get(item.tier) ?? { total: 0, got: 0 };
    t.total += 1;
    if (found.has(item.id)) t.got += 1;
    byTier.set(item.tier, t);
  }

  const uniques = UNIQUES.filter((u) => found.has(`unique:${u.name}`));
  const bossHeld = BOSSES.reduce((n, b) => n + bossTable(b).length, 0);

  const total = index.size;
  const got = [...index.values()].filter((i) => found.has(i.id)).length;

  return (
    <Screen
      title="Collection"
      lead="Every kind of item you have ever held. Selling one never takes it off the list."
    >
      <div className="mt-6">
        <Gauge label="Found" value={got} cap={total} />
      </div>

      {/*
        The uniques, by name. They are the only items in the game that were
        written rather than generated, each with a rule of its own, and the one
        screen about collecting things counted them into nothing — they are not
        catalogue rows, so they were in neither the total nor either chart.
      */}
      <Block title="Uniques" aside={`${uniques.length} of ${UNIQUES.length} found`}>
        {uniques.length === 0 ? (
          <Empty>
            None yet. A boss&apos;s first kill always gives one up, and so does the first contract
            you finish in each biome.
          </Empty>
        ) : (
          <ul className="mt-2">
            {uniques.map((u) => (
              <li
                key={u.name}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5 text-body last:border-0"
              >
                <span style={{ color: "var(--tier)" }}>{u.name}</span>
                <span className="text-note text-faint">
                  {u.slot} · tier {u.tier}
                  {u.source && ` · ${u.source}`}
                </span>
                <span className="w-full text-faint">{describeEffect(u.effect)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 max-w-2xl text-body leading-relaxed text-faint">
          <span className="tnum text-dim">{bossHeld}</span> are on a boss&apos;s table,{" "}
          <span className="tnum text-dim">{BIOME_TRINKET.size}</span> come with the first contract
          in each biome, and <span className="tnum text-dim">{CONTRACT_UNIQUES.length}</span> turn
          up on later contracts.{" "}
          <Link href="/game/areas" className="text-dim underline underline-offset-2">
            Each boss names its own
          </Link>
          .
        </p>
      </Block>

      <Block title="By class" aside="what you have seen">
        <Rows
          head={["Class", "Found", "Total", "Share"]}
          rows={[...byClass.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cls, n]) => [
              <span key="c" className="inline-flex items-baseline gap-2 text-dim">
                {/* The class's own mark rather than a dot: the collection is a
                    list of kinds, and a kind is exactly what a mark says. */}
                <Icon
                  name={markFor({ id: "", cls })}
                  className="size-4 shrink-0 self-center"
                  style={{ color: classHue(cls) }}
                />
                {cls}
              </span>,
              groupNumber(n.got),
              groupNumber(n.total),
              `${Math.round((n.got / n.total) * 100)}%`,
            ])}
        />
      </Block>

      <Block title="By tier" aside="how deep you have been">
        {/*
          Twenty-four rows of "found" and "total" made you read the whole table
          to learn the one thing it was for — how far in you have got. As bars
          it is a wall that stops where you stopped.
        */}
        <TierBars
          bars={TIERS.map((t) => {
            const n = byTier.get(t.tier) ?? { total: 0, got: 0 };
            return { tier: t.tier, got: n.got, total: n.total };
          })}
          label={(b) =>
            `Tier ${b.tier} ${TIERS[b.tier - 1]?.metal ?? ""} — ${groupNumber(b.got)} of ${groupNumber(b.total)} found`
          }
        />
      </Block>
    </Screen>
  );
}
