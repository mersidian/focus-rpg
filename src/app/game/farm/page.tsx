import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Rail } from "@/components/GameUi";
import { overview } from "@/lib/game-view-service";
import { itemName } from "@/lib/game-view-service";
import { ensurePlots, seedsHeld } from "@/lib/farm-service";
import { plotCost, MAX_PLOTS, growthStages } from "@/lib/game/farm";
import { CROP_LINES } from "@/lib/game/items";
import { BuyPlotButton, HarvestButton, SowButton } from "@/components/GameActions";
import { groupNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FarmPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  await ensurePlots(session.user.id);
  const [o, seeds] = await Promise.all([overview(session.user.id), seedsHeld(session.user.id)]);

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
      <Block title="Plots" aside={`${o.plots.length} of ${MAX_PLOTS}`}>
        <ul className="mt-2">
          {o.plots.map((p) => (
            <li key={p.slot} className="border-b border-rule py-3 last:border-0 text-body">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p className="text-dim">
                  Plot #{p.slot}{" "}
                  <span className="text-faint">
                    {p.seedItemId ? itemName(p.seedItemId) : "empty"}
                  </span>
                </p>
                <span className="shrink-0">
                  {p.seedItemId === null ? (
                    <SowButton slot={p.slot} seeds={seeds} />
                  ) : p.stagesLeft === 0 ? (
                    <HarvestButton slot={p.slot} />
                  ) : (
                    <span className="tnum text-note text-faint">
                      {p.stagesLeft} more session{p.stagesLeft === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </div>
              {p.seedItemId && (
                <Rail
                  progress={
                    p.stagesLeft === 0
                      ? 1
                      : Math.max(
                          0,
                          1 - p.stagesLeft / Math.max(1, growthStages(Number(p.seedItemId.split(":")[2] ?? 1))),
                        )
                  }
                />
              )}
            </li>
          ))}
        </ul>
        {o.plots.length < MAX_PLOTS && (
          <div className="mt-5">
            <BuyPlotButton />
            <p className="mt-2 text-note text-faint">
              The next plot costs{" "}
              <span className="tnum text-dim">{groupNumber(plotCost(o.plots.length))}</span> coins.
            </p>
          </div>
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
        <p className="mt-4 text-body text-faint">
          {CROP_LINES.length} lines across the spine. Nothing spoils — this app does not punish
          absence.
        </p>
      </Block>
    </Screen>
  );
}
