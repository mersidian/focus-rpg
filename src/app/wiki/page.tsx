import Link from "next/link";
import { WIKI_DOCS, STANDING_LABEL } from "@/lib/wiki/docs";
import { ACHIEVEMENTS, FAMILIES } from "@/lib/achievements/definitions";
import { MAX_LEVEL, TIERS } from "@/lib/levels";
import { PROJECT_TIERS } from "@/lib/projects";
import { v2Figures } from "@/lib/wiki/v2";
import { groupNumber } from "@/lib/format";

/**
 * The index counts what exists by asking the modules, not by being told. If a
 * tier or an achievement is added, this page says so without being edited —
 * which is the whole reason the wiki is generated rather than written.
 */
const REFERENCES = [
  {
    href: "/wiki/rules",
    title: "Rules",
    blurb:
      "Every number the game actually runs on — session lengths, the pause budget, the heartbeat, the chain, freezes, prestige — read from the modules that own them.",
    count: "the live constants",
  },
  {
    href: "/wiki/levels",
    title: "Levels",
    blurb: `All ${MAX_LEVEL} levels across ${TIERS.length} named tiers, with the XP and hours each one costs.`,
    count: `${MAX_LEVEL} levels`,
  },
  {
    href: "/wiki/game",
    title: "The game",
    blurb:
      "V2's generated content: the 24-tier spine, the 24 weapon archetypes, 90 species, 20 biomes, and the numbers combat actually resolves against.",
    count: "8,568 items",
  },
  {
    href: "/wiki/achievements",
    title: "Achievements",
    blurb: `Every definition in ${FAMILIES.length} families, including the hidden ones, with rarity, XP, wearable titles and freezes.`,
    count: `${ACHIEVEMENTS.length} achievements`,
  },
];

export default function WikiIndex() {
  const v2 = v2Figures();
  const withTitles = ACHIEVEMENTS.filter((a) => a.title).length;
  const hidden = ACHIEVEMENTS.filter((a) => a.hidden).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="text-title font-medium tracking-tight sm:text-hero">Wiki</h1>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-faint">
        Everything this project is, in one place. The reference pages are generated from the
        modules the game runs on, so they cannot drift from it; the documents are rendered
        straight out of the repository, so they cannot fall behind the files people edit.
      </p>

      <section className="mt-14">
        <h2 className="border-b border-rule pb-2 text-[15px] text-text">Reference</h2>
        <ul>
          {REFERENCES.map((r) => (
            <li key={r.href} className="border-b border-rule last:border-0">
              <Link href={r.href} className="group block py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[14px] text-dim transition-colors group-hover:text-text">
                    {r.title}
                  </p>
                  <p className="tnum shrink-0 text-[12px] text-faint">{r.count}</p>
                </div>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-faint">{r.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="border-b border-rule pb-2 text-[15px] text-text">Documents</h2>
        <ul>
          {WIKI_DOCS.map((d) => (
            <li key={d.slug} className="border-b border-rule last:border-0">
              <Link href={`/wiki/doc/${d.slug}`} className="group block py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[14px] text-dim transition-colors group-hover:text-text">
                    {d.title}
                  </p>
                  <p
                    className="shrink-0 text-[12px] text-faint"
                    style={d.standing === "designed" ? { color: "var(--tier)" } : undefined}
                  >
                    {STANDING_LABEL[d.standing]}
                  </p>
                </div>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-faint">{d.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="border-b border-rule pb-2 text-[15px] text-text">By the numbers</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-3">
          {[
            ["Levels", groupNumber(MAX_LEVEL)],
            ["Named tiers", String(TIERS.length)],
            ["Hours to the last level", groupNumber(TIERS[TIERS.length - 1].doneHours)],
            ["Achievements", String(ACHIEVEMENTS.length)],
            ["Wearable titles", String(withTitles)],
            ["Hidden achievements", String(hidden)],
            ["Achievement families", String(FAMILIES.length)],
            ["Project titles", String(PROJECT_TIERS.length)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-faint">{label}</dt>
              <dd className="tnum mt-1 text-[18px] text-dim">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
          <h2 className="text-[15px] text-text">The game</h2>
          <p className="shrink-0 text-[12px]" style={{ color: "var(--tier)" }}>
            V2
          </p>
        </div>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-faint">
          Built, tested and wired into the timer. Every count here is <em>computed from the
          modules</em> rather than typed — a catalogue this size is generated, so the page cannot
          disagree with the game.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-3">
          {[
            ["Skills", groupNumber(v2.skills)],
            ["Items generated", groupNumber(v2.items)],
            ["Species archetypes", groupNumber(v2.speciesArchetypes)],
            ["Monster variants", groupNumber(v2.monsters)],
            ["Monster parts", groupNumber(v2.parts)],
            ["Areas", groupNumber(v2.areas)],
            ["Biomes", groupNumber(v2.biomes)],
            ["Combat styles", groupNumber(v2.styles)],
            ["Weapon archetypes", groupNumber(v2.weaponArchetypes)],
            ["Material tiers", groupNumber(v2.materialTiers)],
            ["Equipment slots", groupNumber(v2.equipmentSlots)],
            ["Qualities", groupNumber(v2.qualities)],
            ["Refinement", `+${v2.refinementMax}`],
            ["Bosses", groupNumber(v2.bosses)],
            ["Uniques", groupNumber(v2.uniquesNamed)],
            ["New achievements", groupNumber(v2.achievementsV2)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-faint">{label}</dt>
              <dd className="tnum mt-1 text-[18px] text-dim">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
