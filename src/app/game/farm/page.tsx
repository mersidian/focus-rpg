import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Rail, Depth } from "@/components/GameUi";
import { MAX_TIER } from "@/lib/game/tiers";
import { overview } from "@/lib/game-view-service";
import { itemName } from "@/lib/game-view-service";
import { ensurePlots, seedsHeld } from "@/lib/farm-service";
import { plotCost, MAX_PLOTS, growthStages } from "@/lib/game/farm";
import { CROP_LINES } from "@/lib/game/items";
import { CROP_OUTPUT } from "@/lib/game/farm";
import { BuyPlotButton, HarvestButton, SowButton } from "@/components/GameActions";
import { groupNumber } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { markFor } from "@/components/item-mark";
import { classHue } from "@/lib/palette";

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
                  {p.seedItemId ? (
                    <span className="inline-flex items-baseline gap-1.5 text-faint">
                      <Depth
                        step={Number(p.seedItemId.split(":")[2] ?? 1)}
                        steps={MAX_TIER}
                        title={`Tier ${p.seedItemId.split(":")[2] ?? 1}`}
                      />
                      <Icon
                        name={markFor({ id: p.seedItemId, cls: "seed" })}
                        className="size-4 shrink-0 self-center"
                        style={{ color: classHue("seed") }}
                      />
                      {itemName(p.seedItemId)}
                    </span>
                  ) : (
                    <span className="text-faint">empty</span>
                  )}
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

      {/*
        Rendered from CROP_OUTPUT rather than retyped beside it. The hand-typed
        version had "Guaranteed-tier hides, where Hunting's roll" — a sentence
        that stops mid-clause — and an aside reading "four lines" above a
        paragraph that counted them properly. Prose says what a thing is about;
        the page prints the facts.
      */}
      <Block title="What it grows" aside={`${CROP_LINES.length} lines`}>
        <Rows
          head={["Line", "Grows", "Why the wild will not do"]}
          rows={CROP_LINES.map((line) => [
            <span key="l" className="inline-flex items-baseline gap-2 text-dim">
              <Icon
                name={markFor({ id: `seed:${line}:1`, cls: "seed" })}
                className="size-4 shrink-0 self-center"
                style={{ color: classHue("seed") }}
              />
              {line}
            </span>,
            itemName(`${CROP_OUTPUT[line].itemLine}:1`),
            CROP_OUTPUT[line].note,
          ])}
        />
        <p className="mt-4 text-body text-faint">
          Nothing spoils — this app does not punish absence.
        </p>
      </Block>
    </Screen>
  );
}
