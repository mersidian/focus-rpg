import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Rail, Empty } from "@/components/GameUi";
import { overview } from "@/lib/game-view-service";
import { itemName } from "@/lib/game-view-service";
import { CROP_LINES } from "@/lib/game/items";

export const dynamic = "force-dynamic";

export default async function FarmPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const o = await overview(session.user.id);

  return (
    <Screen
      title="Farm"
      lead={
        <>
          Plots advance <strong>one stage per completed session</strong>, whatever that session was
          doing — never by elapsed time. That is the only reason farming is allowed here: your
          focus is the app's only clock, and nothing may move while you are away.
        </>
      }
    >
      <Block title="Plots" aside={`${o.plots.length} owned`}>
        {o.plots.length === 0 ? (
          <Empty>
            No plots yet. They are bought with coins, and they are the one thing in the game that
            costs patience rather than sessions.
          </Empty>
        ) : (
          <ul className="mt-2">
            {o.plots.map((p) => (
              <li key={p.slot} className="border-b border-rule py-3 last:border-0 text-[13px]">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-dim">
                    Plot #{p.slot}{" "}
                    <span className="text-faint">
                      {p.seedItemId ? itemName(p.seedItemId) : "empty"}
                    </span>
                  </p>
                  <p className="tnum shrink-0 text-faint">
                    {p.seedItemId === null
                      ? "—"
                      : p.stagesLeft === 0
                        ? "ready"
                        : `${p.stagesLeft} sessions`}
                  </p>
                </div>
                {p.seedItemId && <Rail progress={p.stagesLeft === 0 ? 1 : 0.5} />}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="What it grows" aside="four lines">
        <Rows
          head={["Line", "Why it cannot be gathered instead"]}
          rows={[
            ["Herb", "Foraging finds them, but only in the biome you happen to be in"],
            ["Fibre", "Above tier 8 cloth is farm-only — Magic's armour has no other source"],
            ["Sapling", "Hardwood yields one tier above anything choppable in the wild"],
            ["Stock", "Guaranteed-tier hides, where Hunting's roll"],
          ]}
        />
        <p className="mt-4 text-[13px] text-faint">
          {CROP_LINES.length} lines across the spine. Nothing spoils — this app does not punish
          absence.
        </p>
      </Block>
    </Screen>
  );
}
