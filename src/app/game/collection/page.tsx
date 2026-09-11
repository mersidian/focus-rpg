import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Gauge, TierBars } from "@/components/GameUi";
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

  const total = index.size;
  const got = [...index.values()].filter((i) => found.has(i.id)).length;

  return (
    <Screen
      title="Collection"
      lead={
        <>
          Every item type you have <em>ever</em> obtained, permanently. This is deliberately
          separate from the bank: a limited bank would otherwise make the collection achievements
          impossible, so they read this instead. Selling a Legendary never erases that you had one.
        </>
      }
    >
      <div className="mt-6">
        <Gauge label="Found" value={got} cap={total} />
      </div>

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
