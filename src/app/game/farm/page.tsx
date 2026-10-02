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
      lead="A crop grows one stage for every session you finish, whatever the session was."
    >
      <Block title="Plots" aside={`${o.plots.length} of ${MAX_PLOTS}`}>
        {/*
          A plot is a slot: it holds one crop or it is bare, and a bare one is
          a dashed outline with its Sow control in it rather than a row reading
          "empty" with a control at the far end.
        */}
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {o.plots.map((p) => {
            const tier = p.seedItemId ? Number(p.seedItemId.split(":")[2] ?? 1) : 0;
            const ready = p.seedItemId !== null && p.stagesLeft === 0;
            return (
              <li
                key={p.slot}
                className={`flex min-h-[8.5rem] flex-col p-3.5 ${p.seedItemId ? "slot" : "slot-empty"}`}
              >
                <div className="flex items-center justify-between gap-2 text-note text-faint">
                  <span>Plot {p.slot}</span>
                  {p.seedItemId && (
                    <span className="inline-flex items-center gap-1.5">
                      <Depth step={tier} steps={MAX_TIER} title={`Tier ${tier}`} />
                      <span className="tnum">tier {tier}</span>
                    </span>
                  )}
                </div>
                {p.seedItemId ? (
                  <>
                    <p className="mt-2 flex items-center gap-2 text-body text-text">
                      <Icon
                        name={markFor({ id: p.seedItemId, cls: "seed" })}
                        className="size-4 shrink-0"
                        style={{ color: classHue("seed") }}
                      />
                      {itemName(p.seedItemId)}
                    </p>
                    <Rail progress={ready ? 1 : Math.max(0, 1 - p.stagesLeft / Math.max(1, growthStages(tier)))} />
                    <div className="mt-auto pt-3">
                      {ready ? (
                        <HarvestButton slot={p.slot} />
                      ) : (
                        <p className="text-note text-faint">
                          <span className="tnum text-dim">{p.stagesLeft}</span> more{" "}
                          {p.stagesLeft === 1 ? "session" : "sessions"}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-body text-faint">Bare</p>
                    <div className="mt-auto pt-3">
                      <SowButton slot={p.slot} seeds={seeds} />
                    </div>
                  </>
                )}
              </li>
            );
          })}
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
      <Block title="What it grows">
        <Rows
          head={["Seed", "Grows", "Why grow it"]}
          words={[1, 2]}
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
          Nothing spoils. A grown crop waits until you harvest it, and the shop sells seed.
        </p>
      </Block>
    </Screen>
  );
}
