import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Rail, Empty } from "@/components/GameUi";
import { overview } from "@/lib/game-view-service";
import { groupNumber } from "@/lib/format";
import { RARITIES, spawnPower, successChance } from "@/lib/game/combat";
import { BEATS } from "@/lib/game/archetypes";
import { BIOMES } from "@/lib/game/biomes";

export const dynamic = "force-dynamic";

export default async function GameOverview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const o = await overview(session.user.id);

  const style = o.equipped.weapon?.spec.style ?? null;
  const tier = o.equipped.weapon?.spec.tier ?? 0;
  const ownTier = tier > 0 ? successChance(o.power.offence, spawnPower(tier, RARITIES[0])) : 0;

  return (
    <Screen
      title="The game"
      lead="What your character has, and what it can currently take on. Everything here was earned by a timed session — nothing in this app advances while you are away."
    >
      <Block title="Held" aside="wallet and bank">
        <Rows
          head={["", "Amount"]}
          rows={[
            ["Coins", groupNumber(o.coins)],
            ["Fuel", `${groupNumber(o.fuel)} / ${groupNumber(o.fuelCap)}`],
            ["Bank slots used", `${groupNumber(o.bank.used)} / ${groupNumber(o.bank.slots)}`],
            ["Collected", `${groupNumber(o.collected)} / ${groupNumber(o.catalogue)}`],
            ["Bosses down", `${o.bossesDown} / ${BIOMES.length * 2}`],
            ["Key items", o.keyItems.length > 0 ? o.keyItems.join(", ") : "—"],
          ]}
        />
      </Block>

      <Block title="Loadout" aside={style ? `fighting as ${style}` : "nothing equipped"}>
        {style === null ? (
          <Empty>
            No weapon equipped, so no style and no combat. Gather first — a tool and a tier of ore
            is enough to start a chain.
          </Empty>
        ) : (
          <>
            <Rows
              head={["", "Value"]}
              rows={[
                ["Offence", groupNumber(Math.round(o.power.offence))],
                ["Defence", groupNumber(Math.round(o.power.defence))],
                ["Slots filled", `${o.wornCount} / 10`],
                ["Strong against", BEATS[style]],
                ["Weak to", Object.entries(BEATS).find(([, v]) => v === style)?.[0] ?? "—"],
                ["Own-tier commons", `${Math.round(ownTier * 100)}%`],
              ]}
            />
            <p className="mt-4 text-body leading-relaxed text-faint">
              Offence decides kill speed and whether a spawn converts; defence decides what a
              failure costs in rations. An empty slot counts as tier zero for the requirement
              gate, so a missing cape can close an area.
            </p>
          </>
        )}
      </Block>

      <Block title="Contract" aside="Slaying">
        {o.contract === null ? (
          <Empty>No contract taken. One at a time, and it never expires.</Empty>
        ) : (
          <div className="mt-4 text-body">
            <p className="text-dim">
              {o.contract.variantName}{" "}
              <span className="tnum text-faint">
                {o.contract.killed} / {o.contract.required}
              </span>
            </p>
            <Rail progress={o.contract.killed / Math.max(1, o.contract.required)} />
          </div>
        )}
      </Block>

      <Block
        title="Paid into the ladder"
        aside={`${o.milestones.length} milestone${o.milestones.length === 1 ? "" : "s"}`}
      >
        {o.milestones.length === 0 ? (
          <Empty>
            Nothing yet. A skill level, a biome opening up and a first +10 each pay a lump of
            character XP on top of the per-minute rate — so the game feeds V1's ladder rather
            than competing with it for your afternoon.
          </Empty>
        ) : (
          <>
            <Rows
              head={["Milestone", "XP"]}
              rows={o.milestones.slice(-12).map((m) => [m.label, `+${groupNumber(m.xp)}`])}
              total={o.milestones.length}
            />
            <p className="mt-4 text-body leading-relaxed text-faint">
              <span className="tnum text-dim">
                {groupNumber(o.milestones.reduce((n, m) => n + m.xp, 0))}
              </span>{" "}
              XP in lumps so far. Each is paid once, ever — the record of payment is the same row
              that records it happened.
            </p>
          </>
        )}
      </Block>

      <Block title="Farm" aside={`${o.plots.length} plots`}>
        {o.plots.length === 0 ? (
          <Empty>
            No plots yet. Plots advance one stage per completed session, whatever that session was
            doing — which is why farming costs patience rather than focus.
          </Empty>
        ) : (
          <Rows
            head={["Plot", "Sown", "Stages left"]}
            rows={o.plots.map((p) => [
              `#${p.slot}`,
              p.seedItemId ?? "—",
              p.stagesLeft === 0 ? "ready" : String(p.stagesLeft),
            ])}
          />
        )}
      </Block>
    </Screen>
  );
}
