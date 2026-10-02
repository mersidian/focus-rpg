import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  Screen,
  Block,
  Rows,
  Gate,
  DepthValue,
  DepthRange,
  KindMark,
} from "@/components/GameUi";
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
import { skillKindHue } from "@/lib/palette";

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
      <BiomeDetail
        key={selected.biome.index}
        biome={selected.biome}
        gates={selected.gates}
        open={selected.open}
        world={world}
      />

      <Block title="All biomes" aside={`${reachable} of ${BIOMES.length} have something open`}>
        {/*
          A list rather than a table: at 375px a table pushed the only column
          that matters — how many areas are open — off the right edge.
        */}
        <ul className="mt-2">
          {summaries.map(({ biome, open, bossesDown }) => {
            const here = selected.biome.index === biome.index;
            return (
              <li key={biome.index} className="border-b border-rule last:border-0">
                <Link
                  href={`/game/areas?b=${biome.index}`}
                  aria-current={here ? "true" : undefined}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-body transition-colors hover:text-text"
                >
                  <span
                    className={`min-w-0 flex-1 ${open > 0 ? "text-dim" : "text-faint"}`}
                    style={here ? { color: "var(--tier)" } : undefined}
                  >
                    {biome.name}
                  </span>
                  <span className="shrink-0 text-body">
                    <DepthRange lo={biome.tierLo} hi={biome.tierHi} steps={MAX_TIER} />
                  </span>
                  <span
                    className="tnum w-16 shrink-0 text-right"
                    style={open > 0 ? { color: "var(--tier)" } : { color: "var(--color-faint)" }}
                  >
                    {open} / 10
                  </span>
                  <span className="w-full text-note text-faint">
                    {biome.affinity.length > 3
                      ? "every gathering skill"
                      : biome.affinity.map(label).join(", ")}
                    {/* The item's name. This printed the key it is stored
                        under — "holds sulphurAndSaltpetre". */}
                    {biome.keyItem && ` · holds ${KEY_NAME[biome.keyItem]}`}
                    {bossesDown > 0 && ` · ${bossesDown} of 2 bosses down`}
                    {world.contract?.biome === biome.index && (
                      <span style={{ color: "var(--tier)" }}> · your contract is here</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Block>
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
    <Block
      title={biome.name}
      aside={`tiers ${biome.tierLo}–${biome.tierHi} · ${open > 0 ? `${open} of 10 areas open` : "all closed"}`}
    >
      <p className="mt-4 max-w-2xl text-body leading-relaxed text-dim">
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

      <ul className="mt-5 border-t border-rule">
        {bosses.map((boss) => (
          <BossRow key={boss.name} boss={boss} world={world} />
        ))}
      </ul>

      {/* The gates, at the grain they differ at. */}
      <ul className="mt-6">
        {grouped(gates).map((group) => (
          <li
            key={group.from}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5 text-body last:border-0"
          >
            <span className="text-dim">
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

      {/*
        One table for the biome, not one per area. Rosters overlap almost
        entirely from one area to the next, so three tables of ten were mostly
        the same ten — the column says where each one is found instead.
      */}
      <Rows
        head={["Monster", "Areas", "Weak to", "Pace", "You land"]}
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
            <span key="p" className="font-sans normal-nums">
              {PACE[variant.species.speed]}
            </span>,
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
      <p className="mt-4 max-w-2xl text-note leading-relaxed text-faint">
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
    </Block>
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
    <li className="flex items-start gap-3 border-b border-rule py-4">
      <KindMark name={styleMark(boss.style)} hue={skillKindHue("combat")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-lead text-text">
            {boss.name}{" "}
            <span className="ml-1 text-body text-faint">
              {boss.role === "lord" ? "biome lord" : "mid-boss"} · tier {boss.tier}
            </span>
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

        {boss.signature && (
          <p className="mt-1 text-body leading-relaxed text-dim">
            {kills > 0 ? "Its first kill gave up " : "Its first kill always gives up "}
            {/* A colon, because the effect is a phrase written to stand alone —
                "+14% yield from woodcutting" does not follow "which". */}
            <span style={{ color: "var(--tier)" }}>{boss.signature.name}</span>:{" "}
            {describeEffect(boss.signature.effect)}.
          </p>
        )}

        <p className="mt-1 text-note leading-relaxed text-faint">
          Weak to {answer}.{" "}
          {!gate.open ? (
            <>Needs {gate.missing.join(", ")}.</>
          ) : fight === null ? (
            <>The gate is open, and you are unarmed.</>
          ) : (
            <>
              In what you are wearing it takes{" "}
              <span className="tnum text-dim">{Math.round(fight.seconds / 60)}</span> minutes to
              wear down, and the finishing blow lands{" "}
              <span className="tnum text-dim">{Math.round(fight.chance * 100)}%</span> of the time.
            </>
          )}{" "}
          {table.length > 1 && (
            <>
              <span className="tnum">{found}</span> of <span className="tnum">{table.length}</span>{" "}
              of its uniques found.
            </>
          )}
        </p>
      </div>
    </li>
  );
}

/** The style to bring, lit when it is the one you are carrying. */
function StyleTag({ style, yours }: { style: Style; yours: Style | null }) {
  const match = style === yours;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-sans normal-nums ${match ? "" : "text-faint"}`}
      style={match ? { color: "var(--tier)" } : undefined}
    >
      <Icon name={styleMark(style)} className="size-3.5 shrink-0" />
      {style}
    </span>
  );
}
