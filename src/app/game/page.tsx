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
  StepList,
  StyleWheel,
} from "@/components/GameUi";
import { overviewWithGuide, ledgerHistory, FAUCETS, type Faucet } from "@/lib/game-view-service";
import { itemName } from "@/lib/game/items";
import { groupNumber } from "@/lib/format";
import { Icon, type IconName } from "@/components/Icon";
import { StackedBars, Legend } from "@/components/Charts";
import { skillKindHue } from "@/lib/palette";
import { SKILLS } from "@/lib/game/skills";
import { sinceLabel } from "@/lib/format";
import { RARITIES, spawnPower, successChance } from "@/lib/game/combat";
import { BEATS, STYLES, type Style } from "@/lib/game/archetypes";
import { SLOTS, emptySlots, gateTier } from "@/lib/game/power";
import { KEY_NAME } from "@/lib/game/gate";
import { BIOMES } from "@/lib/game/biomes";
import type { BiomeKey } from "@/lib/game/biomes";
import { growthStages } from "@/lib/game/farm";

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

/** How many routes to show. The first is the answer; the rest are the horizon. */
const STEPS_SHOWN = 5;

export default async function GameOverview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [{ overview: o, steps }, history] = await Promise.all([
    overviewWithGuide(session.user.id),
    ledgerHistory(session.user.id, HISTORY_DAYS),
  ]);

  const style = (o.equipped.weapon?.spec.style as Style | undefined) ?? null;
  const tier = o.equipped.weapon?.spec.tier ?? 0;
  const ownTier = tier > 0 ? successChance(o.power.offence, spawnPower(tier, RARITIES[0])) : 0;

  /*
   * The ten slots in the game's own order, with an empty one as tier 0 — which
   * is not a placeholder but the literal value the requirement gate reads. The
   * floor comes from `gateTier`, the same function the gate calls, so the
   * sentence under the rack cannot disagree with what an area will say.
   */
  const slots = SLOTS.map((slot) => ({ slot, tier: o.equipped[slot]?.spec.tier ?? 0 }));
  const floor = gateTier(o.equipped);
  const empty = emptySlots(o.equipped);
  const beatenBy = (Object.entries(BEATS).find(([, v]) => v === style)?.[0] ?? null) as Style | null;
  const dayTotal = (d: (typeof history)[number]) =>
    FAUCETS.reduce((m, f) => m + d.parts[f], 0);
  const earned = history.reduce((n, d) => n + dayTotal(d), 0);
  const active = history.filter((d) => dayTotal(d) > 0).length;
  const ready = o.plots.filter((p) => p.seedItemId !== null && p.stagesLeft === 0).length;

  return (
    <Screen title="The game" lead="Everything here was earned in a session you finished.">
      {/*
        The route leads. This page opened on a wallet, then on a loadout, and
        both times it was a report: accurate about a character with no weapon
        and no contract, and silent on what to do about either.
      */}
      <StepList steps={steps.slice(0, STEPS_SHOWN)} />

      <Block
        title="Loadout"
        aside={style ? `fighting as ${style}` : "unarmed"}
        icon="equipment"
        href="/game/equipment"
      >
        <div className="mt-4 flex flex-wrap items-baseline gap-x-10 gap-y-2">
          {/*
            Two figures and not one. `power.ts` records why: folding them
            together made gunfire — highest offence, thinnest coat — come out
            as the weakest loadout in the game, exactly backwards from the cost
            ladder.
          */}
          <p className="text-body text-faint">
            <span
              className="tnum block text-title"
              style={{ color: o.power.offence > 0 ? "var(--tier)" : "var(--color-warn)" }}
            >
              {groupNumber(Math.round(o.power.offence))}
            </span>
            offence · how often a fight lands
          </p>
          <p className="text-body text-faint">
            <span className="tnum block text-title text-dim">
              {groupNumber(Math.round(o.power.defence))}
            </span>
            defence · what a miss costs in rations
          </p>
        </div>

        <SlotRack slots={slots} />

        <p className="mt-5 max-w-2xl text-body leading-relaxed text-faint">
          {empty.length === SLOTS.length ? (
            <>
              Nothing worn yet. Areas read your shallowest slot, so nothing past tier 2 opens
              until all ten hold something.
            </>
          ) : empty.length > 0 ? (
            <>
              <span className="tnum" style={{ color: "var(--color-warn)" }}>
                {empty.length}
              </span>{" "}
              empty: {empty.join(", ")}. Areas read your shallowest slot, so the set counts as
              tier 0 until they are filled.
            </>
          ) : (
            <>
              All ten filled. Areas read your shallowest slot, which is{" "}
              <span className="tnum text-dim">tier {floor}</span> — raising that one opens the
              next area, not the deepest piece you own.
            </>
          )}
        </p>

        <StyleWheel order={[...STYLES]} yours={style} />
        <p className="mt-2 max-w-2xl text-body leading-relaxed text-faint">
          {style === null ? (
            <>Each style beats the next one round. Your weapon picks yours.</>
          ) : (
            <>
              You beat <span className="text-dim">{BEATS[style]}</span>, and{" "}
              <span className="text-dim">{beatenBy}</span> beats you. At your own tier you land{" "}
              <span className="tnum text-dim">{Math.round(ownTier * 100)}%</span> of fights with
              commons.
            </>
          )}
        </p>
      </Block>

      <Block title="Held" aside="wallet and bank" icon="bank" href="/game/bank">
        <p className="mt-4 text-body text-dim">
          <span className="tnum text-stat" style={{ color: "var(--tier)" }}>
            {groupNumber(o.coins)}
          </span>{" "}
          coins
        </p>
        <Gauges>
          <Gauge label="Fuel" value={o.fuel} cap={o.fuelCap} tone="full" note="Pays for crafting." />
          <Gauge
            label="Bank slots"
            value={o.bank.used}
            cap={o.bank.slots}
            note="One per kind of item, however many you stack."
          />
          <Gauge
            label="Collected"
            value={o.collected}
            cap={o.catalogue}
            note="Every kind of item you have ever held."
          />
          <Gauge
            label="Bosses down"
            value={o.bossesDown}
            cap={BIOMES.length * 2}
            note="Two in each biome."
          />
        </Gauges>
        {o.keyItems.length > 0 && (
          <p className="mt-5 text-body text-faint">
            Key items{" "}
            <span className="text-dim">
              {o.keyItems.map((k) => KEY_NAME[k as BiomeKey] ?? k).join(", ")}
            </span>
          </p>
        )}
      </Block>

      <Block
        title="Farm"
        aside={ready > 0 ? `${ready} ready` : `${o.plots.length} plots`}
        icon="farm"
        href="/game/farm"
      >
        {o.plots.length === 0 ? (
          <Empty>
            No plots yet.{" "}
            <Link href="/game/farm" className="text-dim underline underline-offset-2">
              Open the farm
            </Link>{" "}
            to claim your first four.
          </Empty>
        ) : (
          <>
            {/*
              A rail per plot rather than a table of "Stages left". A crop is a
              thing with a length, and "3" in a column says nothing about
              whether that is nearly done or barely planted.
            */}
            <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {o.plots.map((p) => {
                const stages = p.seedItemId
                  ? growthStages(Number(p.seedItemId.split(":")[2] ?? 1))
                  : 1;
                return (
                  <li key={p.slot} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3 text-body">
                      {/* The seed's name, not its id, and never "ready" on a
                          plot that has not been sown. */}
                      <span className={p.seedItemId ? "truncate text-dim" : "text-faint"}>
                        {p.seedItemId ? itemName(p.seedItemId) : `Plot ${p.slot}`}
                      </span>
                      <span className="shrink-0 text-note text-faint">
                        {p.seedItemId === null ? (
                          "bare"
                        ) : p.stagesLeft === 0 ? (
                          <span style={{ color: "var(--tier)" }}>ready</span>
                        ) : (
                          <>
                            <span className="tnum">{p.stagesLeft}</span>{" "}
                            {p.stagesLeft === 1 ? "session" : "sessions"}
                          </>
                        )}
                      </span>
                    </div>
                    <Rail
                      progress={p.seedItemId === null ? 0 : 1 - p.stagesLeft / Math.max(1, stages)}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-body text-faint">
              A crop grows one stage for every session you finish.
            </p>
          </>
        )}
      </Block>

      {/*
        The one thing on this page with a time axis, read off the ledger rather
        than derived from any of the caches above.
      */}
      <Block title="Last thirty days" aside={`played on ${active} ${active === 1 ? "day" : "days"}`}>
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
              did not play.
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
            {/*
              Still says how the figure is made — a number the user cannot take
              apart is one they cannot trust — in one sentence instead of four.
            */}
            <p className="mt-4 max-w-2xl text-body leading-relaxed text-faint">
              <span className="tnum text-dim">{groupNumber(Math.round(earned))}</span> coins&apos;
              worth, priced at what the shop would pay so that two bars count for as much as the
              ore that made them. Purchases are left out.
            </p>
          </>
        )}
      </Block>

      <Block
        title="Milestones"
        aside={
          o.milestones.length === 0
            ? "none yet"
            : `${groupNumber(o.milestones.reduce((n, m) => n + m.xp, 0))} XP toward your rank`
        }
      >
        {o.milestones.length === 0 ? (
          <Empty>
            A skill reaching level 10, a biome opening and a first +10 each pay character XP, once.
          </Empty>
        ) : (
          <Rows
            head={["Milestone", "Paid", "XP"]}
            rows={o.milestones.slice(0, 12).map((m) => [
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
        )}
      </Block>
    </Screen>
  );
}
