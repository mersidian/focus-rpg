import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Rows, Gate, DepthValue, Pips } from "@/components/GameUi";
import { Icon, type IconName } from "@/components/Icon";
import { MAX_TIER } from "@/lib/game/tiers";
import { worldView, type WorldView } from "@/lib/game-view-service";
import { requirementFor } from "@/lib/game/requirements";
import { checkGate, KEY_NAME, type GateResult } from "@/lib/game/gate";
import { BIOMES, type Biome } from "@/lib/game/biomes";
import { areasIn, type Area, type Variant } from "@/lib/game/variants";
import { SKILLS } from "@/lib/game/skills";
import { answerTo, type Style } from "@/lib/game/archetypes";
import {
  MIN_SUCCESS,
  RARITIES,
  spawnPower,
  successChance,
  wheelFactor,
} from "@/lib/game/combat";
import { bossFight, bossMarker, bossTable, bossesIn, type Boss } from "@/lib/game/bosses";
import { describeEffect } from "@/lib/game/effects";
import { hazardOf } from "@/lib/game/potions";

export const dynamic = "force-dynamic";

const LABEL = new Map(SKILLS.map((s) => [s.key, s.label]));
const label = (k: string) => LABEL.get(k) ?? k;

/** A style's mark. Gunfire's skill is called gunplay, and so is its glyph. */
const styleMark = (style: Style): IconName => (style === "gun" ? "gunplay" : style);

const PACE: Record<string, string> = { fast: "quick", medium: "steady", slow: "slow" };

/**
 * Areas that are the same fight, as one row.
 *
 * A biome spans two or three tiers and has ten areas, so most of them repeat:
 * Sunlit Meadow 1 to 5 are one tier with one roster, and listing them as five
 * rows made a table of ten that carried two facts. Grouping by what actually
 * differs — the tier, and so the roster and the gate — shows the two.
 */
function grouped(areas: { area: Area; gate: GateResult }[]) {
  const out: { from: number; to: number; area: Area; gate: GateResult }[] = [];
  for (const row of areas) {
    const last = out[out.length - 1];
    if (last && last.area.tier === row.area.tier && last.gate.open === row.gate.open) {
      last.to = row.area.index;
    } else {
      out.push({ from: row.area.index, to: row.area.index, ...row });
    }
  }
  return out;
}

/** Every monster in the biome once, with the run of areas it turns up in. */
function roster(areas: Area[]) {
  const seen = new Map<string, { variant: Variant; from: number; to: number }>();
  for (const area of areas) {
    for (const variant of area.roster) {
      const row = seen.get(variant.name);
      if (row) row.to = area.index;
      else seen.set(variant.name, { variant, from: area.index, to: area.index });
    }
  }
  return [...seen.values()];
}

/** The chance a fight with a common one of these lands, wearing what is worn. */
function odds(variant: Variant, world: WorldView): number {
  const wheel = world.style ? wheelFactor(world.style, variant.style) : 1;
  return successChance(world.power.offence * wheel, spawnPower(variant.tier, RARITIES[0]));
}

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const world = await worldView(session.user.id);
  const { b } = await searchParams;

  const summaries = BIOMES.map((biome) => {
    const gates = areasIn(biome).map((area) => ({
      area,
      gate: checkGate(
        requirementFor({ kind: "combat", biome: biome.index, area: area.index }),
        world.gate,
        label,
      ),
    }));
    const bosses = bossesIn(biome.index);
    return {
      biome,
      gates,
      open: gates.filter((g) => g.gate.open).length,
      bossesDown: bosses.filter((boss) => world.markers.has(bossMarker(boss))).length,
    };
  });

  /*
   * The page opens on a biome rather than on an instruction to pick one. The
   * contract's, when there is one — it is the place the game has already told
   * you to go — and otherwise the deepest biome with anything open, which is
   * where the next session will be.
   */
  const deepestOpen = [...summaries].reverse().find((s) => s.open > 0);
  const selected =
    summaries.find((s) => s.biome.index === Number(b)) ??
    summaries.find((s) => s.biome.index === world.contract?.biome) ??
    deepestOpen ??
    summaries[0];
  const reachable = summaries.filter((s) => s.open > 0).length;

  return (
    <Screen
      title="Areas"
      lead="Go anywhere your gear can meet the gate. A closed area says exactly what it wants."
    >
      {/*
        The twenty biomes as a rail beside the one being read, once there is
        room. Stacked, the list sat under a table of thirty monsters and
        choosing another biome was a scroll, a click and a scroll back.
      */}
      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav
          aria-label="Biomes"
          className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto"
        >
          <p className="border-b border-rule pb-2 text-note text-faint">
            <span className="tnum text-dim">{reachable}</span> of{" "}
            <span className="tnum">{BIOMES.length}</span> biomes have an area open
          </p>
          <ul>
            {summaries.map(({ biome, open, bossesDown }) => {
              const here = selected.biome.index === biome.index;
              return (
                <li key={biome.index}>
                  <Link
                    href={`/game/areas?b=${biome.index}`}
                    aria-current={here ? "true" : undefined}
                    className={`-mx-3 block rounded-md px-3 py-2.5 transition-colors ${
                      here ? "bg-lift" : "hover:bg-lift/60"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={`named text-lead ${open > 0 || here ? "text-text" : "text-faint"}`}
                      >
                        {biome.name}
                      </span>
                      <span className="tnum shrink-0 text-note text-faint">
                        {biome.tierLo}–{biome.tierHi}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-3">
                      <Pips lit={open} label={`${open} of 10 areas open`} />
                      <span className="text-note text-faint">
                        {world.contract?.biome === biome.index ? (
                          <span style={{ color: "var(--tier)" }}>your contract</span>
                        ) : bossesDown > 0 ? (
                          <>
                            <span className="tnum">{bossesDown}</span> of 2 bosses down
                          </>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="order-1 min-w-0 lg:order-2">
          <BiomeDetail
            key={selected.biome.index}
            biome={selected.biome}
            gates={selected.gates}
            open={selected.open}
            world={world}
          />
        </div>
      </div>
    </Screen>
  );
}

/**
 * One biome: what lives there, what it is weak to, and what guards it.
 *
 * This was a table of "Area, Tier, Monsters, Gate" in which Monsters was a
 * count. Seven hundred variants, each with a name, a pace and a style that
 * shifts from biome to biome, and forty bosses each guarding a named unique —
 * and the only screen about the world printed "6". The wheel is the puzzle
 * preparation exists for, and it could not be read anywhere before a session.
 */
function BiomeDetail({
  biome,
  gates,
  open,
  world,
}: {
  biome: Biome;
  gates: { area: Area; gate: GateResult }[];
  open: number;
  world: WorldView;
}) {
  const hazard = hazardOf(biome);
  const bosses = bossesIn(biome.index);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="named text-title leading-tight text-text">{biome.name}</h2>
        <p className="text-body text-faint">
          tiers <span className="tnum text-dim">{biome.tierLo}–{biome.tierHi}</span>,{" "}
          {open > 0 ? (
            <>
              <span className="tnum" style={{ color: "var(--tier)" }}>
                {open}
              </span>{" "}
              of 10 areas open
            </>
          ) : (
            "all closed"
          )}
        </p>
      </div>
      <p className="mt-3 max-w-[62ch] text-body text-dim">
        Everything here can drop {biome.materials[0]}, {biome.materials[1]} and{" "}
        {biome.materials[2]}.
        {hazard && (
          <>
            {" "}
            Its {hazard.hazard} costs{" "}
            <span className="tnum">{hazard.qty}</span> {hazard.ward}{" "}
            {hazard.qty === 1 ? "potion" : "potions"} at the gate.
          </>
        )}
        {biome.keyItem && (
          <>
            {" "}
            Its lord holds <span style={{ color: "var(--tier)" }}>{KEY_NAME[biome.keyItem]}</span>.
          </>
        )}
      </p>

      <ul className="mt-8 grid gap-x-10 gap-y-8 border-t border-rule pt-6 md:grid-cols-2">
        {bosses.map((boss) => (
          <BossRow key={boss.name} boss={boss} world={world} />
        ))}
      </ul>

      <h3 className="mt-10 border-b border-rule pb-2 text-lead font-medium text-text">Areas</h3>
      {/* The gates, at the grain they differ at. */}
      <ul>
        {grouped(gates).map((group) => (
          <li
            key={group.from}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3 text-body"
          >
            <span className="text-text">
              {group.from === group.to ? `Area ${group.from}` : `Areas ${group.from}–${group.to}`}
              <span className="ml-3">
                <DepthValue
                  step={group.area.tier}
                  steps={MAX_TIER}
                  label={`tier ${group.area.tier}`}
                />
              </span>
            </span>
            <Gate open={group.gate.open} missing={group.gate.missing} />
          </li>
        ))}
      </ul>

      <h3 className="mt-10 text-lead font-medium text-text">What lives here</h3>
      {/*
        One table for the biome, not one per area. Rosters overlap almost
        entirely from one area to the next, so three tables of ten were mostly
        the same ten — the column says where each one is found instead.
      */}
      <Rows
        head={["Monster", "Areas", "Weak to", "Pace", "You land"]}
        words={[2, 3]}
        rows={roster(gates.map((g) => g.area)).map(({ variant, from, to }) => {
          const chance = odds(variant, world);
          const target = world.contract?.variantName === variant.name;
          return [
            <span key="n" style={target ? { color: "var(--tier)" } : undefined}>
              {variant.name}
              {target && world.contract && (
                <span className="tnum text-note">
                  {" "}
                  · contract {world.contract.killed}/{world.contract.required}
                </span>
              )}
            </span>,
            from === to ? String(from) : `${from}–${to}`,
            <StyleTag key="w" style={answerTo(variant.style)} yours={world.style} />,
            PACE[variant.species.speed],
            <span
              key="c"
              style={{
                color:
                  chance >= 0.75 ? "var(--tier)" : chance <= 0.1 ? "var(--color-warn)" : undefined,
              }}
            >
              {Math.round(chance * 100)}%
            </span>,
          ];
        })}
      />
      <p className="mt-4 max-w-[62ch] text-note text-faint">
        {world.style === null ? (
          <>
            Unarmed, so every fight lands one time in{" "}
            <span className="tnum">{Math.round(1 / MIN_SUCCESS)}</span>. The percentages are
            against a common; rarer spawns are harder.
          </>
        ) : (
          <>
            The chance a fight with a common one lands in what you are wearing, the style wheel
            included. Rarer spawns are harder and pay more.
          </>
        )}
      </p>
    </section>
  );
}

function BossRow({ boss, world }: { boss: Boss; world: WorldView }) {
  const kills = world.markers.get(bossMarker(boss)) ?? 0;
  const gate = checkGate(
    requirementFor({ kind: "boss", biome: boss.biome, role: boss.role }),
    world.gate,
    label,
  );
  const table = bossTable(boss);
  const found = table.filter((u) => world.found.has(`unique:${u.name}`)).length;
  const answer = answerTo(boss.style);
  const fight = world.style ? bossFight(boss, world.power.offence, world.style) : null;

  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-note text-faint">
          {boss.role === "lord" ? "Biome lord" : "Mid-boss"}, tier{" "}
          <span className="tnum">{boss.tier}</span>
        </p>
        <p className="shrink-0 text-note">
          {kills > 0 ? (
            <span style={{ color: "var(--tier)" }}>
              down{kills > 1 && <span className="tnum"> ×{kills}</span>}
            </span>
          ) : (
            <span className="text-faint">standing</span>
          )}
        </p>
      </div>
      {/* The serif, because a boss is one of the few things here somebody
          named — and it is the name you will be told you beat. */}
      <p className="named mt-1 text-head leading-tight text-text">{boss.name}</p>

      {boss.signature && (
        <p className="mt-3 text-body text-dim">
          {kills > 0 ? "Its first kill gave up " : "Its first kill always gives up "}
          {/* A colon, because the effect is a phrase written to stand alone —
              "+14% yield from woodcutting" does not follow "which". */}
          <span className="named" style={{ color: "var(--tier)" }}>
            {boss.signature.name}
          </span>
          : {describeEffect(boss.signature.effect)}.
        </p>
      )}

      <p className="mt-2 flex items-center gap-2 text-body text-faint">
        Weak to <StyleTag style={answer} yours={world.style} />
      </p>
      <p className="mt-1 text-body text-faint">
        {!gate.open ? (
          <>Needs {gate.missing.join(", ")}.</>
        ) : fight === null ? (
          <>The gate is open, and you are unarmed.</>
        ) : (
          <>
            In what you are wearing it takes{" "}
            <span className="tnum text-dim">{Math.round(fight.seconds / 60)}</span> minutes to wear
            down, and the finishing blow lands{" "}
            <span className="tnum text-dim">{Math.round(fight.chance * 100)}%</span> of the time.
          </>
        )}
      </p>
      {table.length > 1 && (
        <p className="mt-2 flex items-center gap-2 text-note text-faint">
          <Pips lit={found} of={table.length} label={`${found} of ${table.length} uniques found`} />
          <span>
            <span className="tnum">{found}</span> of <span className="tnum">{table.length}</span>{" "}
            uniques found
          </span>
        </p>
      )}
    </li>
  );
}

/** The style to bring, lit when it is the one you are carrying. */
function StyleTag({ style, yours }: { style: Style; yours: Style | null }) {
  const match = style === yours;
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${match ? "" : "text-dim"}`}
      style={match ? { color: "var(--tier)" } : undefined}
    >
      <Icon name={styleMark(style)} className="size-3.5 shrink-0" />
      {style}
    </span>
  );
}
