import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Rail } from "@/components/GameUi";
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
      <p className="mt-6 text-body text-faint">
        <span className="tnum text-dim">{groupNumber(got)}</span> of{" "}
        <span className="tnum">{groupNumber(total)}</span> found
      </p>
      <Rail progress={total === 0 ? 0 : got / total} />

      <Block title="By class" aside="what you have seen">
        <Rows
          head={["Class", "Found", "Total", "Share"]}
          rows={[...byClass.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cls, n]) => [
              cls,
              groupNumber(n.got),
              groupNumber(n.total),
              `${Math.round((n.got / n.total) * 100)}%`,
            ])}
        />
      </Block>

      <Block title="By tier" aside="how deep you have been">
        <Rows
          head={["Tier", "Material", "Found", "Total"]}
          rows={TIERS.map((t) => {
            const n = byTier.get(t.tier) ?? { total: 0, got: 0 };
            return [
              String(t.tier),
              <span key="m" className="text-faint">
                {t.metal}
              </span>,
              groupNumber(n.got),
              groupNumber(n.total),
            ];
          })}
        />
      </Block>
    </Screen>
  );
}
