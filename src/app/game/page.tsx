import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  Screen,
  Block,
  Rows,
  Rail,
  Empty,
  Gauge,
  Gauges,
  SlotRack,
  StyleWheel,
} from "@/components/GameUi";
import { overview, ledgerHistory, FAUCETS, type Faucet } from "@/lib/game-view-service";
import { itemName } from "@/lib/game/items";
import { groupNumber } from "@/lib/format";
import { Icon, type IconName } from "@/components/Icon";
import { StackedBars, Legend } from "@/components/Charts";
import { skillKindHue } from "@/lib/palette";
import { SKILLS } from "@/lib/game/skills";
import { sinceLabel } from "@/lib/format";
import { RARITIES, spawnPower, successChance } from "@/lib/game/combat";
import { BEATS, STYLES, type Style } from "@/lib/game/archetypes";
import { SLOTS } from "@/lib/game/power";
import { KEY_NAME } from "@/lib/game/gate";
import { BIOMES } from "@/lib/game/biomes";
import type { BiomeKey } from "@/lib/game/biomes";

export const dynamic = "force-dynamic";

/** A month of it. Long enough to show a habit, short enough to stay one glance. */
const HISTORY_DAYS = 30;

const SKILL_MARKS = new Set(SKILLS.map((s) => s.key));

/**
 * What earned a milestone, as its own mark.
 *
 * Six rows reading "Woodcutting 10", "Smelting 10", "Firemaking 10" differ by
 * one word each and scan as one block of text. The skills already have marks —
 * twenty-two of them, drawn for the skills page — so the row that says a skill
 * levelled can simply wear it.
 */
function milestoneMark(label: string): IconName {
  const first = label.split(" ")[0]?.toLowerCase() ?? "";
  if (SKILL_MARKS.has(first)) return first as IconName;
  if (label.endsWith("opened")) return "areas";
  return "temper";
}

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const FAUCET_LABEL: Record<Faucet, string> = {
  gathered: "gathered",
  fought: "taken off kills",
  made: "made at the bench",
};

/*
 * The three faucets take the three skill-kind hues, which is not a new palette
 * but the existing one used for exactly the thing it was defined for: gathering,
 * combat and processing. The skills page already colours these three the same
 * way, so a green column here and a green heading there are the same claim.
 */
const FAUCET_HUE: Record<Faucet, string> = {
  gathered: skillKindHue("gathering"),
  fought: skillKindHue("combat"),
  made: skillKindHue("processing"),
};

export default async function GameOverview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [o, history] = await Promise.all([
    overview(session.user.id),
    ledgerHistory(session.user.id, HISTORY_DAYS),
  ]);

  const style = (o.equipped.weapon?.spec.style as Style | undefined) ?? null;
  const tier = o.equipped.weapon?.spec.tier ?? 0;
  const ownTier = tier > 0 ? successChance(o.power.offence, spawnPower(tier, RARITIES[0])) : 0;

  /*
   * The ten slots in the game's own order, with an empty one as tier 0 — which
   * is not a placeholder but the literal value the requirement gate reads. See
   * `loadoutPower`: an unfilled slot makes the whole loadout tier 0, and that
   * is the fact this page has always explained in prose and never shown.
   */
  const slots = SLOTS.map((slot) => ({ slot, tier: o.equipped[slot]?.spec.tier ?? 0 }));
  const gateTier = Math.min(...slots.map((s) => s.tier));
  const empty = slots.filter((s) => s.tier === 0).length;
  const beatenBy = (Object.entries(BEATS).find(([, v]) => v === style)?.[0] ?? null) as Style | null;
  const dayTotal = (d: (typeof history)[number]) =>
    FAUCETS.reduce((m, f) => m + d.parts[f], 0);
  const earned = history.reduce((n, d) => n + dayTotal(d), 0);
  const active = history.filter((d) => dayTotal(d) > 0).length;

  return (
    <Screen
      title="The game"
      lead="What your character has, and what it can currently take on. Everything here was earned by a timed session — nothing in this app advances while you are away."
    >
      {/*
        The loadout leads, because the page's own first sentence promises "what
        it can currently take on" and this is the thing that decides it. It used
        to sit third, under the wallet, as a six-row table whose second column
        was headed "Value" and held two numbers, a ratio, two style names and a
        percentage.
      */}
      <Block
        title="Standing"
        aside={style ? `fighting as ${style}` : "no weapon, so no style"}
        icon="equipment"
        href="/game/equipment"
      >
        <div className="mt-4 flex flex-wrap items-baseline gap-x-10 gap-y-2">
          {/*
            Two figures and not one. `power.ts` records why: folding them
            together made gunfire — highest offence, thinnest coat — come out
            as the weakest loadout in the game, exactly backwards from the cost
            ladder. They are deliberately `text-title` rather than the page's
            largest size, because the rack below is the thing worth looking at.
          */}
          <p className="text-body text-faint">
            <span className="tnum block text-title" style={{ color: "var(--tier)" }}>
              {groupNumber(Math.round(o.power.offence))}
            </span>
            offence
          </p>
          <p className="text-body text-faint">
            <span className="tnum block text-title text-dim">
              {groupNumber(Math.round(o.power.defence))}
            </span>
            defence
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
          Offence decides kill speed and whether a spawn converts. Defence decides what a failure
          costs in rations.
        </p>

        <SlotRack slots={slots} />

        <p className="mt-5 max-w-2xl text-body leading-relaxed text-faint">
          {empty === 10 ? (
            <>
              Nothing worn yet. The gate takes the shallowest of the ten, so until every slot
              holds something it reads tier 0 and no area opens on gear.{" "}
              <Link href="/game/crafting" className="text-dim underline underline-offset-2">
                Smith a piece
              </Link>{" "}
              or take one off a kill.
            </>
          ) : empty > 0 ? (
            <>
              <span className="tnum" style={{ color: "var(--color-warn)" }}>
                {empty}
              </span>{" "}
              {empty === 1 ? "slot is" : "slots are"} empty — {""}
              {slots
                .filter((s) => s.tier === 0)
                .map((s) => s.slot)
                .join(", ")}
              . The gate reads the shortest bar, so it reads tier 0 however deep the rest go.
            </>
          ) : (
            <>
              All ten filled. The gate reads the shortest bar, so it reads{" "}
              <span className="tnum text-dim">tier {gateTier}</span> — and the way to open a
              deeper area is to raise that one, not the deepest you own.
            </>
          )}
        </p>

        <StyleWheel order={[...STYLES]} yours={style} />
        <p className="mt-2 max-w-2xl text-body leading-relaxed text-faint">
          {style === null ? (
            <>
              Four styles in a cycle, so none of them is merely safe. Equipping a weapon picks
              yours.
            </>
          ) : (
            <>
              You fight as <span className="text-dim">{style}</span>: you beat{" "}
              <span className="text-dim">{BEATS[style]}</span>, and{" "}
              <span className="text-dim">{beatenBy}</span> beats you. At your own tier you take{" "}
              <span className="tnum text-dim">{Math.round(ownTier * 100)}%</span> of commons.
            </>
          )}
        </p>
      </Block>

      {/*
        Four of these five were ratios printed as "1 234 / 5 678" in a
        two-column table, which is the shape that makes a proportion hardest to
        read. Coins is the only figure here with no ceiling, so it is the only
        one that stays a number.
      */}
      <Block title="Held" aside="wallet and bank" icon="bank" href="/game/bank">
        <p className="mt-4 text-body text-dim">
          <span className="tnum text-stat" style={{ color: "var(--tier)" }}>
            {groupNumber(o.coins)}
          </span>{" "}
          coins
        </p>
        <Gauges>
          <Gauge
            label="Fuel"
            value={o.fuel}
            cap={o.fuelCap}
            tone="full"
            note="Spent between sessions, on processing."
          />
          <Gauge
            label="Bank slots"
            value={o.bank.used}
            cap={o.bank.slots}
            note="A slot holds an item type; stacks inside it are unlimited."
          />
          <Gauge
            label="Collected"
            value={o.collected}
            cap={o.catalogue}
            note="Every type ever obtained, kept whether or not you still hold it."
          />
          <Gauge
            label="Bosses down"
            value={o.bossesDown}
            cap={BIOMES.length * 2}
            note="Two to a biome, and neither comes back."
          />
        </Gauges>
        <p className="mt-5 text-body text-faint">
          Key items{" "}
          <span className="text-dim">
            {o.keyItems.length > 0
              ? o.keyItems.map((k) => KEY_NAME[k as BiomeKey] ?? k).join(", ")
              : "none yet"}
          </span>
          {o.keyItems.length === 0 && (
            <> — a boss drops one, and three biomes will not open without theirs.</>
          )}
        </p>
      </Block>

      <Block title="Contract" aside="Slaying" icon="slaying" href="/game/slaying">
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
            character XP on top of the per-minute rate — so the game feeds V1&apos;s ladder rather
            than competing with it for your afternoon.
          </Empty>
        ) : (
          <>
            {/*
              When it was paid, which `overview` has always fetched and this
              page has always dropped. Six rows reading "Woodcutting 10 · +20"
              are six identical rows; the same six with a day against them are a
              record of an afternoon.
            */}
            <Rows
              head={["Milestone", "Paid", "XP"]}
              rows={o.milestones
                .slice(-12)
                .map((m) => [
                  <span key="what" className="flex items-center gap-2">
                    <Icon
                      name={milestoneMark(m.label)}
                      className="size-4 shrink-0 text-faint"
                      aria-hidden
                    />
                    <span className="min-w-0">{m.label}</span>
                  </span>,
                  // Words, so they keep their own widths — `Rows` sets tabular
                  // figures on every cell but the first, which is right for a
                  // column of numbers and wrong for "3 days ago".
                  <span key="at" className="font-sans normal-nums">
                    {sinceLabel(m.at.getTime(), o.now)}
                  </span>,
                  `+${groupNumber(m.xp)}`,
                ])}
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

{/*
        The one thing on this page with a time axis.

        Everything above is a snapshot — coins now, gear now, plots now — in an
        app whose whole claim is that it accumulates. The ledger is the only
        record of what actually arrived and when, so the history is read off it
        rather than derived from any of the caches above.
      */}
      <Block
        title="History"
        aside={`${active} of the last ${HISTORY_DAYS} days`}
      >
        {earned === 0 ? (
          <Empty>
            Nothing banked in the last {HISTORY_DAYS} days. Pick an activity before a session and
            what it produces will land here.
          </Empty>
        ) : (
          <>
            <StackedBars
              columns={history.map((d) => ({
                label: new Date(d.day).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                }),
                parts: d.parts,
              }))}
              keys={[...FAUCETS]}
              colorOf={(k) => FAUCET_HUE[k as Faucet]}
              labelOf={(k) => FAUCET_LABEL[k as Faucet]}
              format={(n) => `${groupNumber(Math.round(n))} coins`}
              caption={`What each of the last ${HISTORY_DAYS} days put in the bank, by where it came from`}
              height={120}
            />
            {/*
              Two dates under the chart, because without them a run of empty
              columns reads as a broken chart rather than as three weeks you
              did not play — and the only way to date a bar otherwise is a
              `<title>` tooltip, which a phone cannot reach.
            */}
            <div className="mt-1 flex items-baseline justify-between text-note text-faint">
              <span>{dayLabel(history[0]?.day ?? o.now)}</span>
              <span>today</span>
            </div>
            <Legend
              items={FAUCETS.map((f) => ({
                label: FAUCET_LABEL[f],
                color: FAUCET_HUE[f],
                value: groupNumber(
                  Math.round(history.reduce((n, d) => n + d.parts[f], 0)),
                ),
              }))}
            />
            <p className="mt-4 max-w-2xl text-body leading-relaxed text-faint">
              <span className="tnum text-dim">{groupNumber(Math.round(earned))}</span> coins&apos;
              worth, measured at what the shop would pay rather than counted: a day of tier-1
              mining is twenty ore and a day at the bench is two bars, so counting things would
              hide the bench entirely. Buying and trading are left out — this is what the game
              made, not what you shopped for.
            </p>
          </>
        )}
      </Block>

      <Block title="Farm" aside={`${o.plots.length} plots`} icon="farm" href="/game/farm">
        {o.plots.length === 0 ? (
          <Empty>
            No plots yet. Plots advance one stage per completed session, whatever that session was
            doing — which is why farming costs patience rather than focus.
          </Empty>
        ) : (
          <>
            <Rows
              head={["Plot", "Sown", "Stages left"]}
              rows={o.plots.map((p) => [
                `#${p.slot}`,
                /*
                  The seed's name, not its id. This column rendered the raw
                  `seed:Fibre:3` — the same bug the session result screen had,
                  in the same shape: an id is not a name just because it is a
                  string the user can read.
                */
                p.seedItemId ? itemName(p.seedItemId) : "empty",
                /*
                  And an empty plot is not "ready". `stagesLeft` starts at 0 on
                  a plot that has never been sown, so four untouched plots all
                  claimed a harvest was waiting.
                */
                p.seedItemId === null ? "—" : p.stagesLeft === 0 ? "ready" : String(p.stagesLeft),
              ])}
            />
            <p className="mt-4 text-body leading-relaxed text-faint">
              A stage passes per completed session, whatever that session was doing. Nothing here
              grows while the app is closed.
            </p>
          </>
        )}
      </Block>
    </Screen>
  );
}
