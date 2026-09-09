import {
  SESSION_LENGTHS,
  XP_BY_LENGTH,
  ABANDON_XP_PENALTY,
  SLACKED_XP_MULTIPLIER,
  MAX_PAUSES,
  MAX_PAUSED_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_GRACE_MS,
  ABANDON_REASON_LABEL,
} from "@/lib/constants";
import { CHAIN_WINDOW_MS, CHAIN_STEP, MAX_CHAIN_LINKS, chainMultiplier } from "@/lib/chain";
import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE } from "@/lib/game-day";
import {
  FREEZE_CAP,
  FREEZE_STREAK_INTERVAL,
  FREEZE_METER_XP_SHARE,
  FREEZE_METER_TARGET_FP,
  FREEZE_PURCHASE_XP,
  ABANDONS_THAT_BREAK,
  MAX_REST_DAYS,
  MAX_VACATION_DAYS,
} from "@/lib/streak-engine";
import {
  PRESTIGE_LEVEL,
  MAX_STARS,
  XP_BONUS_PER_STAR,
  MAX_XP_BONUS,
  ETERNAL_RECURRENCE,
} from "@/lib/prestige";
import { PROJECT_TIERS } from "@/lib/projects";
import { groupNumber, tierAccent } from "@/lib/format";

/**
 * Every value on this page is imported, never transcribed. A wiki that repeats
 * a number is a wiki that will eventually disagree with the game, and then it
 * is worse than nothing — it is a confident lie about the rules.
 */

function Rule({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-rule py-3 text-[13px] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-dim">{label}</p>
        {note && <p className="mt-1 leading-relaxed text-faint">{note}</p>}
      </div>
      <p className="tnum shrink-0 text-right text-text">{value}</p>
    </div>
  );
}

function Section({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-[15px] text-text">{title}</h2>
        <p className="shrink-0 text-[12px] text-faint">{source}</p>
      </div>
      {children}
    </section>
  );
}

const minutes = (ms: number) => `${ms / 60_000} min`;

export default function WikiRulesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <h1 className="text-title font-medium tracking-tight sm:text-hero">Rules</h1>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-faint">
        The numbers the game runs on, read out of the modules that own them. The right-hand
        label on each block is where the value lives, so a rule you want to argue with is one
        file away.
      </p>

      <Section title="The session" source="lib/constants.ts">
        <Rule
          label="Session lengths"
          value={SESSION_LENGTHS.join(" / ")}
          note="Chosen per session, before it starts."
        />
        {SESSION_LENGTHS.map((len) => (
          <Rule
            key={len}
            label={`XP for a ${len}-minute session`}
            value={groupNumber(XP_BY_LENGTH[len])}
            note={
              XP_BY_LENGTH[len] > len
                ? `One per focused minute, plus the ${Math.round(
                    (XP_BY_LENGTH[len] / len - 1) * 100,
                  )}% bonus the longest session earns.`
                : "One XP per focused minute."
            }
          />
        ))}
        <Rule
          label="A slacked admission pays"
          value={`${SLACKED_XP_MULTIPLIER * 100}%`}
          note="Self-reported. Reduces the session's XP and carries no other penalty."
        />
      </Section>

      <Section title="Pausing and presence" source="lib/constants.ts">
        <Rule label="Pauses allowed per session" value={String(MAX_PAUSES)} />
        <Rule
          label="Total paused time allowed"
          value={minutes(MAX_PAUSED_MS)}
          note="Exceeding either the count or the total abandons the session. Paused time earns no XP."
        />
        <Rule
          label="Heartbeat interval"
          value={`${HEARTBEAT_INTERVAL_MS / 1000}s`}
          note="A liveness ping only. Other tabs do not matter; research freely."
        />
        <Rule
          label="Grace before the page counts as gone"
          value={minutes(HEARTBEAT_GRACE_MS)}
          note="Desktop only. Mobile browsers freeze background tabs, so phone sessions have no heartbeat."
        />
      </Section>

      <Section title="Abandoning" source="lib/constants.ts">
        <Rule
          label="XP penalty"
          value={`−${ABANDON_XP_PENALTY}`}
          note="Applied immediately. Levels ratchet, so this can delay a rank but never take one."
        />
        <Rule
          label="Abandons in a day that break the streak"
          value={String(ABANDONS_THAT_BREAK)}
          note="One slip does not cost the streak."
        />
        <div className="mt-4">
          <p className="text-[13px] text-dim">The ways a session ends badly</p>
          <ul className="mt-2 space-y-1 text-[13px] text-faint">
            {Object.entries(ABANDON_REASON_LABEL).map(([reason, label]) => (
              <li key={reason} className="flex gap-3">
                <code className="shrink-0 rounded bg-lift px-1 text-[12px]">{reason}</code>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="The chain" source="lib/chain.ts">
        <Rule
          label="Window after a session ends"
          value={minutes(CHAIN_WINDOW_MS)}
          note="Start another session inside it and the next one pays more. Not in either spec — it answers V1 §10's own recorded risk."
        />
        <Rule label="Each link past the first adds" value={`+${Math.round(CHAIN_STEP * 100)}%`} />
        <Rule label="Links before it tops out" value={String(MAX_CHAIN_LINKS)} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-rule pb-2 pr-4 text-left font-medium text-dim">
                  Links behind
                </th>
                <th className="border-b border-rule pb-2 text-right font-medium text-dim">
                  Multiplier
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_CHAIN_LINKS + 1 }, (_, links) => (
                <tr key={links}>
                  <td className="tnum border-b border-rule py-2 pr-4 text-faint">{links}</td>
                  <td className="tnum border-b border-rule py-2 text-right text-faint">
                    ×{chainMultiplier(links).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="The game day" source="lib/game-day.ts">
        <Rule
          label="Day rolls over at"
          value={`${String(DAY_ROLLOVER_HOUR).padStart(2, "0")}:00`}
          note="So a session at 1am still counts toward the day you think you are in."
        />
        <Rule label="Default timezone" value={DEFAULT_TIMEZONE} />
      </Section>

      <Section title="Streaks and freezes" source="lib/streak-engine.ts">
        <Rule
          label="Any completed session"
          value="keeps the streak"
          note="There is no daily minutes goal to miss."
        />
        <Rule label="Freezes held at most" value={String(FREEZE_CAP)} />
        <Rule
          label="One freeze per consecutive days"
          value={String(FREEZE_STREAK_INTERVAL)}
          note="One of four sources; achievements, the meter and purchase are the others."
        />
        <Rule
          label="Share of earned XP entering the meter"
          value={`${Math.round(FREEZE_METER_XP_SHARE * 100)}%`}
        />
        <Rule label="Meter target for one freeze" value={`${groupNumber(FREEZE_METER_TARGET_FP)} FP`} />
        <Rule
          label="Buying a freeze costs"
          value={`${groupNumber(FREEZE_PURCHASE_XP)} XP`}
          note="V2 moves this cost to coins, so that XP is never spent at all."
        />
        <Rule label="Scheduled rest days a week" value={String(MAX_REST_DAYS)} />
        <Rule
          label="Vacation days per quarter"
          value={String(MAX_VACATION_DAYS)}
          note="Declared in advance. Streak frozen, no freezes spent."
        />
      </Section>

      <Section title="Prestige" source="lib/prestige.ts">
        <Rule
          label="Unlocks at level"
          value={String(PRESTIGE_LEVEL)}
          note="Not at 100 — a ten-thousand-hour gate would never be seen."
        />
        <Rule label="Stars stack to" value={`★${MAX_STARS}`} />
        <Rule label="XP bonus per star" value={`+${Math.round(XP_BONUS_PER_STAR * 100)}%`} />
        <Rule label="XP bonus caps at" value={`+${Math.round(MAX_XP_BONUS * 100)}%`} />
        <Rule
          label={`Title at ★${MAX_STARS}`}
          value={ETERNAL_RECURRENCE}
          note="Granted by nothing else."
        />
      </Section>

      <Section title="The project ladder" source="lib/projects.ts">
        {PROJECT_TIERS.map((tier) => (
          <div
            key={tier.title}
            className="flex items-baseline gap-4 border-b border-rule py-3 text-[13px] last:border-0"
          >
            <span
              aria-hidden
              className="mt-1 h-3 w-[3px] shrink-0 self-start"
              style={{ backgroundColor: tierAccent(tier.hue, 0.5) }}
            />
            <p className="flex-1 text-dim">{tier.title}</p>
            <p className="tnum shrink-0 text-text">{groupNumber(tier.hours)} h</p>
          </div>
        ))}
      </Section>
    </main>
  );
}
