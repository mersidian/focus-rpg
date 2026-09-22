import Link from "next/link";
import { ARCHETYPES, STYLES, STYLE_FAMILY } from "@/lib/game/archetypes";
import { BIOMES } from "@/lib/game/biomes";
import { catalogueBreakdown } from "@/lib/game/items";
import { referenceLoadout, MAX_REFINE, SLOTS, SLOT_BASE, affinity } from "@/lib/game/power";
import { QUALITIES } from "@/lib/game/quality";
import { SKILLS } from "@/lib/game/skills";
import { SPECIES } from "@/lib/game/species";
import { GUN_ENTRY_TIER, MAX_TIER, TIERS } from "@/lib/game/tiers";
import { allVariants, areasIn } from "@/lib/game/variants";
import {
  RARITIES,
  SPAWN_BASE,
  spawnPower,
  successChance,
  wheelFactor,
  rationsPerFailure,
} from "@/lib/game/combat";
import { SKILL_XP, tierSkillRequirement } from "@/lib/game/skills";
import { refineTotal, bankSlotsTotalCost, tierValue, AMMO_COST } from "@/lib/game/economy";
import { groupNumber, tierAccent } from "@/lib/format";

/**
 * V2's content, read out of the modules that generate it.
 *
 * At eight and a half thousand items this page is not a nicety — it is the only
 * way the author can see their own game. Nothing here is transcribed; if a
 * number on this page is wrong, the game is wrong.
 */

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Section({
  id,
  title,
  source,
  lead,
  shown,
  children,
}: {
  id: string;
  title: string;
  source: string;
  lead?: string;
  /** Whether this is the section being read. */
  shown: (id: string) => boolean;
  children: React.ReactNode;
}) {
  if (!shown(id)) return null;
  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-lead text-text">{title}</h2>
        <p className="shrink-0 text-note text-faint">{source}</p>
      </div>
      {lead && <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">{lead}</p>}
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={`border-b border-rule pb-2 pr-4 font-medium text-faint last:pr-0 ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`border-b border-rule py-2 pr-4 align-top last:pr-0 ${
                    i === 0 ? "text-dim" : "tnum text-right text-faint"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What each section holds, counted from the modules rather than typed here.
 *
 * The page is a reference and it had grown to ten sections, a hundred and
 * thirty-four table rows and about six thousand pixels — one shape repeated ten
 * times, with no way to tell from the top whether the thing you came for was on
 * it. An index that says how big each table is answers that before you scroll.
 */
function contents(breakdown: Record<string, number>) {
  return [
    { key: "catalogue", title: "The catalogue", source: "items.ts", rows: Object.keys(breakdown).length },
    { key: "spine", title: "The material spine", source: "tiers.ts", rows: TIERS.length },
    { key: "wheel", title: "The style wheel", source: "archetypes.ts", rows: STYLES.length },
    { key: "set", title: "A full set, and what it converts", source: "combat.ts", rows: 3 * 5 },
    { key: "rarity", title: "Rarity", source: "combat.ts", rows: RARITIES.length },
    { key: "axes", title: "The four item axes", source: "power.ts", rows: SLOTS.length + QUALITIES.length },
    { key: "world", title: "The world", source: "biomes.ts", rows: BIOMES.length },
    { key: "archetypes", title: "The weapon archetypes", source: "archetypes.ts", rows: ARCHETYPES.length },
    { key: "skills", title: "Skills", source: "skills.ts", rows: SKILLS.length },
    { key: "sinks", title: "The sinks", source: "economy.ts", rows: 6 },
  ];
}

export default async function WikiGamePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const breakdown = catalogueBreakdown();
  const total = Object.values(breakdown).reduce((n, v) => n + v, 0);
  const variants = allVariants();
  const sample = [1, 6, 12, 18, 24];

  /*
   * One section at a time, chosen in the URL.
   *
   * The same answer `/achievements` and `/game/areas` already give to the same
   * problem: server-rendered links, no JavaScript, and a section you can send
   * someone. `<details>` would have hidden the scroll and still shipped every
   * row. `?s=all` keeps the whole page one click away, which is what a
   * reference page needs when you would rather search it than navigate it.
   */
  const { s } = await searchParams;
  const index = contents(breakdown);
  const all = s === "all";
  const one = !all && s && index.some((x) => x.key === s) ? s : null;
  const shown = (key: string) => all || one === key;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="text-title font-medium tracking-tight sm:text-hero">The game</h1>
      <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
        V2's rules and content, generated from{" "}
        <code className="rounded bg-lift px-1">src/lib/game</code> and read here rather than
        transcribed. The rules are built and tested; the database, the services and the screens
        are not. If a number on this page looks wrong, it is the game that is wrong.
      </p>

      {/* The way back, above the section rather than buried under it. */}
      {(all || one) && (
        <p className="mt-6 text-body text-faint">
          <Link href="/wiki/game" className="underline underline-offset-4">
            All sections
          </Link>
        </p>
      )}

      {!all && !one && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <h2 className="text-lead text-text">Sections</h2>
            <p className="shrink-0 text-note text-faint">
              <span className="tnum">{index.reduce((n, x) => n + x.rows, 0)}</span> rows in all
            </p>
          </div>
          <ul>
            {index.map((entry) => (
              <li key={entry.key} className="border-b border-rule last:border-0">
                <Link
                  href={`/wiki/game?s=${entry.key}`}
                  className="flex items-baseline gap-4 py-3 text-body transition-colors hover:text-text"
                >
                  <span className="min-w-0 flex-1 text-dim">{entry.title}</span>
                  <span className="hidden shrink-0 text-note text-faint sm:block">
                    {entry.source}
                  </span>
                  <span className="tnum w-16 shrink-0 text-right text-faint">{entry.rows}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-body text-faint">
            <Link href="/wiki/game?s=all" className="underline underline-offset-4">
              Show every section at once
            </Link>{" "}
            — about six thousand pixels of it, which is what this index exists to spare you.
          </p>
        </section>
      )}

      <Section
        id="catalogue"
        shown={shown}
        title="The catalogue"
        source="items.ts"
        lead={`${groupNumber(total)} items, every id and every name unique, all of it from axes rather than rows. Nine slots against one weapon is why armour is the bulk of it.`}
      >
        <Table
          head={["Class", "Items"]}
          rows={Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([cls, n]) => [cls, groupNumber(n)])}
        />
      </Section>

      <Section
        id="spine"
        shown={shown}
        title="The material spine"
        source="tiers.ts"
        lead={`One ${MAX_TIER}-tier ladder worn four ways, pinned to V1's own hours: tier 1 at 0 h and tier ${MAX_TIER} at 10,000 h, where Mythic V also lands. Firearms have no material below tier ${GUN_ENTRY_TIER}.`}
      >
        <Table
          head={["Tier", "Metal / Hide / Cloth / Composite", "Opens", "Power", "Skill", "Value"]}
          rows={TIERS.map((t) => [
            <span key="t" style={{ color: tierAccent(250 - t.tier * 9, Math.min(1, t.tier / 20)) }}>
              {t.tier}
            </span>,
            <span key="n" className="text-dim">
              {[t.metal, t.hide, t.cloth, t.composite ?? "—"].join(" / ")}
            </span>,
            `${groupNumber(t.gateHours)} h`,
            `×${t.power}`,
            tierSkillRequirement(t.tier),
            groupNumber(tierValue(t.tier)),
          ])}
        />
      </Section>

      <Section
        id="wheel"
        shown={shown}
        title="The style wheel"
        source="archetypes.ts, power.ts"
        lead="Melee closes on ranged, ranged interrupts magic, magic wards off gunfire, gunfire pierces plate. Four styles in a cycle, so none of them is merely safe — and the affinities carry the upkeep ladder into the numbers rather than leaving it as prose."
      >
        <Table
          head={["Style", "Wears", "Weapon", "Body", "Ammo per shot"]}
          rows={STYLES.map((s) => [
            s,
            <span key="f" className="text-faint">
              {STYLE_FAMILY[s]}
            </span>,
            `×${affinity(s, "weapon").toFixed(2)}`,
            `×${affinity(s, "body").toFixed(2)}`,
            AMMO_COST[s] === 0 ? "—" : AMMO_COST[s].toFixed(2),
          ])}
        />
      </Section>

      <Section
        id="set"
        shown={shown}
        title="A full set, and what it converts"
        source="combat.ts"
        lead={`Offence decides kill speed and conversion; defence decides what a failure costs. A same-tier Plain set sits near a Common spawn of that tier, which is the balance point everything hangs off — SPAWN_BASE is ${SPAWN_BASE}, and it was moved from 55 when the audit caught a same-tier set converting only a quarter of its own tier.`}
      >
        <Table
          head={["Tier", "Common spawn", ...STYLES.map((s) => `${s} off/def`)]}
          rows={sample.map((t) => [
            String(t),
            groupNumber(Math.round(spawnPower(t, RARITIES[0]))),
            ...STYLES.map((s) => {
              if (s === "gun" && t < GUN_ENTRY_TIER) return "—";
              const p = referenceLoadout(s, t).power;
              return `${Math.round(p.offence)}/${Math.round(p.defence)}`;
            }),
          ])}
        />
        <p className="mt-6 text-body text-dim">Conversion at your own tier</p>
        <Table
          head={["Style", ...RARITIES.map((r) => r.label), "Rations per failure"]}
          rows={STYLES.map((s) => {
            const p = referenceLoadout(s, 12).power;
            return [
              s,
              ...RARITIES.map((r) => pct(successChance(p.offence, spawnPower(12, r)))),
              String(rationsPerFailure(spawnPower(12, RARITIES[0]), p.defence)),
            ];
          })}
        />
        <p className="mt-6 text-body text-dim">
          The wheel, against a tier-12 Rare with a tier-12 melee set
        </p>
        <Table
          head={["Matchup", "Multiplier", "Conversion"]}
          rows={(
            [
              ["right style", wheelFactor("melee", "ranged")],
              ["neutral", 1],
              ["wrong style", wheelFactor("melee", "gun")],
            ] as const
          ).map(([label, f]) => [
            label,
            `×${f.toFixed(2)}`,
            pct(successChance(referenceLoadout("melee", 12).power.offence * f, spawnPower(12, RARITIES[3]))),
          ])}
        />
        <p className="mt-6 text-body text-dim">Going deeper than your gear</p>
        <Table
          head={["Tier-12 gear against", "Conversion"]}
          rows={[12, 14, 16, 18, 20].map((t) => [
            `a tier-${t} common`,
            pct(successChance(referenceLoadout("melee", 12).power.offence, spawnPower(t, RARITIES[0]))),
          ])}
        />
      </Section>

      <Section
        id="rarity"
        shown={shown}
        title="Rarity"
        source="combat.ts"
        lead="Rarity sets both the spawn's power and its loot, so the thing worth killing is also the thing that might get away. Deeper biomes tilt the table, which is how depth pays in kind as well as in degree."
      >
        <Table
          head={["Rarity", "Weight at tier 1", "Weight at tier 24", "Power", "Loot"]}
          rows={RARITIES.map((r) => [
            r.label,
            groupNumber(Math.round(r.weight)),
            groupNumber(Math.round(r.weight * (1 + r.depthBias * 23))),
            `×${r.power}`,
            `×${r.loot}`,
          ])}
        />
      </Section>

      <Section
        id="axes"
        shown={shown}
        title="The four item axes"
        source="power.ts, quality.ts"
        lead={`Tier, quality window, the rolled band, and refinement up to +${MAX_REFINE}. They are kept apart so an item card can say "51 damage (42–58, 64%)" and have both halves mean something on their own.`}
      >
        <Table
          head={["Quality", "Window", "Drop weight"]}
          rows={QUALITIES.map((q) => [q.label, `×${q.window}`, `${q.weight}`])}
        />
        <p className="mt-6 text-body text-dim">
          Slot weights — body and weapon carry a loadout, boots and rings are the trim
        </p>
        <Table
          head={["Slot", "Base"]}
          rows={SLOTS.map((s) => [s, SLOT_BASE[s].toFixed(2)])}
        />
      </Section>

      <Section
        id="world"
        shown={shown}
        title="The world"
        source="biomes.ts, species.ts, variants.ts"
        lead={`${BIOMES.length} biomes of 10 areas, and ${SPECIES.length} species archetypes crossed with the biomes whose tiers suit them — ${groupNumber(variants.length)} monsters from ninety designs. Every biome past the tutorial has all four styles as the right answer somewhere, which is asserted by a test.`}
      >
        <Table
          head={["#", "Biome", "Tiers", "Affinity", "Monsters", "Key item"]}
          rows={BIOMES.map((b) => {
            const roster = new Set(areasIn(b).flatMap((a) => a.roster.map((v) => v.name)));
            return [
              String(b.index),
              <span key="n" className="text-dim">
                {b.name}
                <span className="text-faint"> · {b.prefix}</span>
              </span>,
              `${b.tierLo}–${b.tierHi}`,
              <span key="a" className="text-faint">
                {b.affinity.length > 3 ? "all" : b.affinity.join(", ")}
              </span>,
              String(roster.size),
              <span key="k" style={b.keyItem ? { color: "var(--tier)" } : undefined}>
                {b.keyItem ? "yes" : "—"}
              </span>,
            ];
          })}
        />
      </Section>

      <Section
        id="archetypes"
        shown={shown}
        title="The weapon archetypes"
        source="archetypes.ts"
        lead="The family noun in “{material} {archetype}”. Damage is a coefficient, and the band moves opposite to it — a fast shallow weapon rolls wide, a slow final one rolls tight. Two-handed forgoes the offhand and takes throughput back."
      >
        <Table
          head={["Archetype", "Style", "Damage", "Band", "Hands"]}
          rows={ARCHETYPES.map((a) => [
            a.name,
            <span key="s" className="text-faint">
              {a.style}
            </span>,
            a.damage.toFixed(2),
            `±${a.bandPct}%`,
            String(a.hands),
          ])}
        />
      </Section>

      <Section
        id="skills"
        shown={shown}
        title="Skills"
        source="skills.ts"
        lead={`${SKILLS.length} skills, each 1–99. Level 99 costs ${groupNumber(SKILL_XP[98])} XP, which is ${Math.round(SKILL_XP[98] / 60)} focused hours on that one skill — so twenty-two of them is thirteen thousand hours, and nobody maxes everything. That is deliberate, and it is why there is no achievement for it.`}
      >
        <Table
          head={["Skill", "Kind", "What it does"]}
          rows={SKILLS.map((s) => [
            s.label,
            <span key="k" className="text-faint">
              {s.kind}
            </span>,
            <span key="n" className="text-faint">
              {s.note}
            </span>,
          ])}
        />
      </Section>

      <Section
        id="sinks"
        shown={shown}
        title="The sinks"
        source="economy.ts"
        lead="Everything is priced off one curve, V(T) = 10 × 1.20^(T−1), so value and strength climb at one rate. Refinement never fails, which means the cost curve carries the whole axis on its own."
      >
        <Table
          head={["To +10 at tier", "Stones", "Coins"]}
          rows={[6, 12, 18, 24].map((t) => {
            const r = refineTotal(t);
            return [String(t), groupNumber(r.stones), groupNumber(r.coins)];
          })}
        />
        <p className="mt-4 text-body leading-relaxed text-faint">
          Bank slots are the largest sink in the game: 60 to 1,500 costs{" "}
          <span className="tnum text-dim">{groupNumber(bankSlotsTotalCost())}</span> coins. An
          earlier curve compounded at 11% a block and priced the same walk at twelve billion,
          which is not a goal but a wall with a number painted on it.
        </p>
      </Section>
    </main>
  );
}
