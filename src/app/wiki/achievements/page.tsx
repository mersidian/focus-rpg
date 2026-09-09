import {
  ALL_ACHIEVEMENTS as ACHIEVEMENTS,
  ALL_FAMILIES as FAMILIES,
  ALL_FAMILY_LABEL as FAMILY_LABEL,
  RARITY_LABEL,
  achievementXp,
} from "@/lib/achievements/definitions";
import { groupNumber } from "@/lib/format";

/**
 * Every definition, hidden ones included and labelled as such.
 *
 * The Achievements page in the app conceals them, because there the reader is
 * playing. Here the reader is the person who wrote them, and a reference that
 * hides a third of its subject is not a reference.
 */
export default function WikiAchievementsPage() {
  const totalXp = ACHIEVEMENTS.reduce((n, a) => n + achievementXp(a), 0);
  const titles = ACHIEVEMENTS.filter((a) => a.title).length;
  const freezes = ACHIEVEMENTS.reduce((n, a) => n + (a.freezes ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="text-title font-medium tracking-tight sm:text-hero">Achievements</h1>
      <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
        {ACHIEVEMENTS.length} definitions in {FAMILIES.length} families, worth{" "}
        <span className="tnum text-dim">{groupNumber(totalXp)}</span> XP in total, granting{" "}
        <span className="tnum text-dim">{titles}</span> wearable titles and{" "}
        <span className="tnum text-dim">{freezes}</span> freezes. Hidden ones are shown here and
        marked; the app conceals them, this does not.
      </p>

      {FAMILIES.map((family) => {
        const items = ACHIEVEMENTS.filter((a) => a.family === family);
        return (
          <section key={family} className="mt-14">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
              <h2 className="text-lead text-text">{FAMILY_LABEL[family]}</h2>
              <p className="tnum shrink-0 text-note text-faint">{items.length}</p>
            </div>
            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline gap-4 border-b border-rule py-3 text-body last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-dim">
                      {item.name}
                      {item.hidden && (
                        <span className="ml-2 text-note" style={{ color: "var(--tier)" }}>
                          hidden
                        </span>
                      )}
                      {item.deferred && <span className="ml-2 text-note text-faint">deferred</span>}
                    </p>
                    <p className="mt-1 leading-relaxed text-faint">{item.description}</p>
                    {item.title && (
                      <p className="mt-1 text-faint">
                        Title: <span className="text-dim">{item.title}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-faint">+{groupNumber(achievementXp(item))}</p>
                    <p className="mt-1 text-note text-faint">{RARITY_LABEL[item.rarity]}</p>
                    {item.freezes ? (
                      <p className="mt-1 text-note text-faint">
                        <span className="tnum">{item.freezes}</span> freeze
                        {item.freezes === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
