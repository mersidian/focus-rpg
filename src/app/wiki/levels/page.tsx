import { RANKS, TIERS, MAX_LEVEL, describeLevel } from "@/lib/levels";
import { groupNumber, tierAccent } from "@/lib/format";

/**
 * The ladder as the game computes it, not as the spec tabulates it. The spec
 * pins rank I and rank V of each tier; the three between are derived, and this
 * is the only place you can read what they actually came out as.
 */
export default function WikiLevelsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="text-title font-medium tracking-tight sm:text-hero">Levels</h1>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-faint">
        {MAX_LEVEL} levels across {TIERS.length} named tiers of {RANKS.length} ranks. XP is one
        per focused minute, so the hours column is the real cost. Levels ratchet: XP can fall,
        the title cannot.
      </p>

      {TIERS.map((tier, tierIndex) => {
        const accent = tierAccent(tier.hue, tier.intensity);
        const levels = RANKS.map((_, r) => describeLevel(tierIndex * RANKS.length + r + 1));
        return (
          <section key={tier.title} className="mt-12">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
              <h2 className="flex items-baseline gap-3 text-[15px]">
                <span
                  aria-hidden
                  className="h-3 w-[3px] shrink-0 self-center"
                  style={{ backgroundColor: accent }}
                />
                <span style={{ color: accent }}>{tier.title}</span>
                <span className="tnum text-[12px] text-faint">
                  {levels[0].level}–{levels[levels.length - 1].level}
                </span>
              </h2>
              <p className="tnum shrink-0 text-[12px] text-faint">
                {groupNumber(tier.enterHours)} h → {groupNumber(tier.doneHours)} h
              </p>
            </div>

            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-rule py-2 pr-4 text-left font-medium text-faint">
                    Level
                  </th>
                  <th className="border-b border-rule py-2 pr-4 text-left font-medium text-faint">
                    Title
                  </th>
                  <th className="border-b border-rule py-2 pr-4 text-right font-medium text-faint">
                    XP
                  </th>
                  <th className="border-b border-rule py-2 text-right font-medium text-faint">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {levels.map((info) => (
                  <tr key={info.level}>
                    <td className="tnum border-b border-rule py-2 pr-4 text-faint">
                      {info.level}
                    </td>
                    <td className="border-b border-rule py-2 pr-4 text-dim">{info.fullTitle}</td>
                    <td className="tnum border-b border-rule py-2 pr-4 text-right text-faint">
                      {groupNumber(info.floorXp)}
                    </td>
                    <td className="tnum border-b border-rule py-2 text-right text-faint">
                      {(info.floorXp / 60).toFixed(info.floorXp < 6000 ? 1 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
