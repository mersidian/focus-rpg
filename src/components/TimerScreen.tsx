"use client";

import { useEffect, useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { ReportCard } from "./ReportCard";
import { LevelUpOverlay } from "./LevelUpOverlay";
import { UnlockToast } from "./UnlockToast";
import { XpRail } from "./XpRail";
import { useTick } from "@/lib/client/use-tick";
import {
  askForNotifications,
  needsInstallFirst,
  notificationState,
  registerServiceWorker,
} from "@/lib/client/notify";
import {
  ABANDON_REASON_LABEL,
  MAX_PAUSES,
  SESSION_LENGTHS,
  XP_BY_LENGTH,
} from "@/lib/constants";
import { evaluate, pauseBudgetLeftMs, type EngineSession } from "@/lib/session-engine";
import { describeLevel } from "@/lib/levels";
import { xpMultiplier } from "@/lib/prestige";
import { CHAIN_WINDOW_MS, MAX_CHAIN_LINKS } from "@/lib/chain";
import { clock, completionRatio, groupNumber, hours } from "@/lib/format";
import { ActivityPicker } from "./ActivityPicker";
import type { Activity } from "@/lib/game/activity";

export function TimerScreen() {
  const game = useGame();
  const { snapshot, ruleset, serverNow } = game;
  const session = snapshot.active;

  useTick(1000, Boolean(session));

  const [choice, setChoice] = useState<number>(25);
  /**
   * The activity survives a report and a settle, because a player who is mining
   * iron this afternoon is probably still mining iron in twenty minutes. It is
   * still chosen before every session — this only spares you re-picking the same
   * thing, and the gate is re-checked server-side each time regardless.
   */
  const [activity, setActivity] = useState<Activity | null>(null);
  const now = serverNow();

  const verdict = useMemo(() => {
    if (!session) return null;
    const engine: EngineSession = { ...session };
    return evaluate(engine, now);
    // `now` changes every tick, which is the point.
  }, [session, now]);

  const remainingMs =
    verdict && (verdict.kind === "running" || verdict.kind === "paused")
      ? verdict.remainingMs
      : null;

  /* -------------------------------------------- live countdown in the tab */

  useEffect(() => {
    if (remainingMs === null) {
      document.title = "Focus RPG";
      return;
    }
    const paused = verdict?.kind === "paused";
    document.title = `${paused ? "|| " : ""}${clock(remainingMs)} — Focus RPG`;
    return () => {
      document.title = "Focus RPG";
    };
  }, [remainingMs, verdict?.kind]);

  if (snapshot.awaitingReport) {
    return (
      <>
        <ReportCard />
        <LevelUpOverlay />
      </>
    );
  }

  return (
    <>
      {session && remainingMs !== null ? (
        <Running remainingMs={remainingMs} paused={verdict?.kind === "paused"} now={now} />
      ) : (
        <Idle
          choice={choice}
          onChoose={setChoice}
          activity={activity}
          onActivity={setActivity}
        />
      )}
      <LevelUpOverlay />
      <UnlockToast />
    </>
  );
}

/* ------------------------------------------------------------------ idle */

function Idle({
  choice,
  onChoose,
  activity,
  onActivity,
}: {
  choice: number;
  onChoose: (n: number) => void;
  activity: Activity | null;
  onActivity: (a: Activity | null) => void;
}) {
  const { snapshot, ruleset, begin, pending, error, clearError, lastSettled } = useGame();
  const { state } = snapshot;
  const info = describeLevel(state.level);
  const ratio = completionRatio(state.sessionsCompleted, state.sessionsAbandoned);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16 sm:px-10">
      <header>
        <h1 className="display text-5xl leading-[0.95] sm:text-7xl" style={{ color: "var(--tier)" }}>
          {snapshot.prestige.stars > 0 && (
            <span className="tnum mr-3 align-middle text-[0.5em]">
              ★{snapshot.prestige.stars}
            </span>
          )}
          {info.title}{" "}
          <span className="opacity-70" style={{ fontVariationSettings: '"WONK" 1' }}>
            {info.rank}
          </span>
        </h1>
        <p className="mt-3 text-[13px] text-faint">
          Level <span className="tnum text-dim">{state.level}</span> of 100
          {snapshot.prestige.bonusPercent > 0 && (
            <>
              {" — "}
              <span className="tnum text-dim">+{snapshot.prestige.bonusPercent}%</span> XP
            </>
          )}
        </p>
        {snapshot.prestige.offerAvailable && (
          <p className="mt-4 text-[13px]">
            <a
              href="/character"
              className="underline underline-offset-4"
              style={{ color: "var(--tier)" }}
            >
              You have reached level 50. There is a choice waiting.
            </a>
          </p>
        )}
      </header>

      <div className="mt-10">
        <XpRail xp={state.xp} level={state.level} />
      </div>

      <dl className="mt-8 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t border-rule pt-6 text-[13px]">
        <Stat label="focused" value={hours(state.lifetimeFocusedMs)} />
        <Stat label="sessions finished" value={groupNumber(state.sessionsCompleted)} />
        <Stat
          label="finished what you started"
          value={ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
        />
        <Stat
          label={
            snapshot.streak.activeToday
              ? "day streak, today banked"
              : "day streak, today still open"
          }
          value={groupNumber(snapshot.streak.streak)}
        />
      </dl>

      {snapshot.streak.frozeDays.length > 0 && (
        <p
          className="mt-6 border-l-2 pl-4 text-[13px] leading-relaxed text-dim"
          style={{ borderColor: "oklch(0.86 0.04 232)" }}
        >
          {snapshot.streak.frozeDays.length === 1
            ? "Freeze used — streak intact, "
            : `${snapshot.streak.frozeDays.length} freezes used — streak intact, `}
          <span className="tnum">{snapshot.streak.freezes}</span> left.
        </p>
      )}

      {lastSettled?.kind === "abandoned" && (
        <p
          className="mt-6 border-l-2 pl-4 text-[13px] leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          Last session was abandoned —{" "}
          {ABANDON_REASON_LABEL[lastSettled.reason].toLowerCase()}.{" "}
          <span className="tnum">−30</span> XP, and it is in the log.
        </p>
      )}

      <ChainOffer />

      <section className="mt-14">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-rule">
          {SESSION_LENGTHS.map((minutes) => {
            const selected = choice === minutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => onChoose(minutes)}
                aria-pressed={selected}
                className="group bg-ground px-4 py-6 text-left transition-colors"
                style={selected ? { backgroundColor: "var(--color-lift)" } : undefined}
              >
                <span
                  className="tnum block text-4xl leading-none transition-colors"
                  style={{ color: selected ? "var(--tier)" : undefined }}
                >
                  {minutes}
                </span>
                <span className="mt-2 block text-[13px] text-faint">minutes</span>
                <span className="mt-1 block text-[13px] text-faint">
                  <span className="tnum text-dim">
                    +
                    {Math.round(
                      XP_BY_LENGTH[minutes] *
                        xpMultiplier(snapshot.prestige.stars) *
                        snapshot.chain.multiplier,
                    )}
                  </span>{" "}
                  XP
                  {/* The bonus note wraps the slab onto a second line on a
                      phone, where the figure already tells the story. */}
                  {minutes === 50 && <span className="hidden sm:inline"> (+20%)</span>}
                </span>
              </button>
            );
          })}
        </div>

        <ActivityPicker value={activity} onChange={onActivity} />

        <button
          type="button"
          onClick={() => begin(choice, activity ?? undefined)}
          disabled={pending}
          className="mt-6 w-full rounded-sm px-6 py-4 text-[15px] font-medium text-ground transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--tier)" }}
        >
          {/* `pending` covers any in-flight action, including a background
              refresh, so it disables the button without claiming a session is
              starting. A real start swaps this whole view out immediately. */}
          Start {choice} minutes
        </button>

        <RulesetNote ruleset={ruleset} align="left" />
      </section>

      {error && (
        <p className="mt-6 text-[13px]" style={{ color: "var(--color-warn)" }}>
          {error}{" "}
          <button type="button" onClick={clearError} className="underline underline-offset-2">
            Dismiss
          </button>
        </p>
      )}

      <NotificationPrompt />
    </main>
  );
}

/**
 * The one place the app asks for a decision rather than handing out a reward
 * (§10). The clock is the point: the offer is worth most exactly when you are
 * least likely to finish another session.
 */
function ChainOffer() {
  const { snapshot, serverNow } = useGame();
  const { chain } = snapshot;
  useTick(1000, chain.windowMs !== null);

  if (chain.windowMs === null || chain.links === 0) return null;

  // Recomputed from the snapshot's own clock so the countdown does not drift.
  const left = chain.windowMs - (serverNow() - snapshot.serverNow);
  if (left <= 0) return null;

  const pct = Math.max(0, Math.min(1, left / CHAIN_WINDOW_MS));

  return (
    <section className="mt-12 border-l-2 pl-4" style={{ borderColor: "var(--tier)" }}>
      <p className="text-[15px]">
        <span className="tnum" style={{ color: "var(--tier)" }}>
          ×{chain.multiplier.toFixed(1)}
        </span>{" "}
        <span className="text-dim">
          on your next session — {chain.links} in a row
          {chain.atCap && ", as long as the chain goes"}
        </span>
      </p>
      <p className="mt-2 text-[13px] text-faint">
        Start within <span className="tnum text-dim">{clock(left)}</span> to keep it. Give up
        or run out of time and it is back to the plain rate.
      </p>
      <div className="mt-3 h-px w-full max-w-xs bg-rule">
        <div
          className="h-px transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct * 100}%`, backgroundColor: "var(--tier)" }}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="tnum text-xl text-text">{value}</dd>
      <dt className="mt-1 text-faint">{label}</dt>
    </div>
  );
}

/* --------------------------------------------------------------- running */

function Running({
  remainingMs,
  paused,
  now,
}: {
  remainingMs: number;
  paused: boolean;
  now: number;
}) {
  const { snapshot, pause, resume, abandon, pending, ruleset } = useGame();
  const session = snapshot.active!;
  const total = session.plannedMinutes * 60_000;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / total));
  const pauseLeft = pauseBudgetLeftMs({ ...session }, now);
  const pausesLeft = MAX_PAUSES - session.pauseCount;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {/* The room filling up. Full-bleed, readable from across the desk. */}
      <div className="safe-offset-top fixed inset-x-0 h-[3px] bg-rule">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: paused ? "var(--tier-deep)" : "var(--tier)",
          }}
        />
      </div>

      <p
        className="tnum text-[19vw] leading-none tracking-tight sm:text-[9rem]"
        style={{ color: paused ? "var(--color-faint)" : "var(--tier)" }}
      >
        {clock(remainingMs)}
      </p>

      <p className="mt-6 text-[13px] text-faint">
        {paused ? (
          <>
            Paused. <span className="tnum text-dim">{clock(pauseLeft)}</span> of pause time
            left, {pausesLeft === 0 ? "no pauses" : `${pausesLeft} pause${pausesLeft === 1 ? "" : "s"}`} remaining.
          </>
        ) : (
          <>
            <span className="tnum text-dim">{session.plannedMinutes}</span> minute session,
            worth{" "}
            <span className="tnum text-dim">
              {Math.round(
                (XP_BY_LENGTH[session.plannedMinutes as 15 | 25 | 50] ??
                  session.plannedMinutes) *
                  xpMultiplier(snapshot.prestige.stars) *
                  snapshot.chain.multiplier,
              )}
            </span>{" "}
            XP.
          </>
        )}
      </p>

      <div className="mt-10 flex items-center gap-3">
        {paused ? (
          <button
            type="button"
            onClick={resume}
            disabled={pending}
            className="rounded-sm px-6 py-3 text-[15px] font-medium text-ground disabled:opacity-50"
            style={{ backgroundColor: "var(--tier)" }}
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            disabled={pending || pausesLeft <= 0 || pauseLeft <= 0}
            className="rounded-sm border border-rule px-6 py-3 text-[15px] text-dim transition-colors hover:text-text disabled:opacity-40"
          >
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm("Give up? That costs 30 XP and goes in the log.")) abandon();
          }}
          disabled={pending}
          className="rounded-sm px-6 py-3 text-[15px] text-faint transition-colors hover:text-warn disabled:opacity-40"
        >
          Give up
        </button>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 px-6">
        <RulesetNote ruleset={ruleset} />
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- chrome */

/** The two rulesets must never feel arbitrary, so the active one is on screen (§3). */
function RulesetNote({
  ruleset,
  align = "center",
}: {
  ruleset: "desktop" | "mobile";
  align?: "left" | "center";
}) {
  return (
    <p
      className={`mt-6 text-[12px] leading-relaxed text-faint ${
        align === "left" ? "text-left" : "text-center"
      }`}
    >
      {ruleset === "desktop" ? (
        <>
          Desktop rules: keep this page open. Other tabs are fine — close it for more than{" "}
          <span className="tnum">2</span> minutes and the session is abandoned.
        </>
      ) : (
        <>
          Phone rules: no presence check, because mobile browsers freeze background tabs. This
          session ends only when it finishes, you give up, or you run out of pause.
        </>
      )}
    </p>
  );
}

function NotificationPrompt() {
  const [state, setState] = useState<NotificationPermission | "unsupported" | null>(null);
  const [installFirst, setInstallFirst] = useState(false);

  useEffect(() => {
    setState(notificationState());
    setInstallFirst(needsInstallFirst());
    // Registering early means the worker is ready before a session ends.
    if (notificationState() === "granted") void registerServiceWorker();
  }, []);

  /**
   * iOS has no Notification API in a browser tab at all, so there is nothing to
   * ask for until the app is on the home screen. Saying that is more use than
   * a button that would do nothing.
   */
  if (installFirst) {
    return (
      <p className="mt-10 border-t border-rule pt-6 text-[13px] leading-relaxed text-faint">
        To be told when a session ends, add this to your home screen — Share, then Add to
        Home Screen. iPhone only allows notifications to an installed app.
      </p>
    );
  }

  if (state !== "default") return null;

  return (
    <p className="mt-10 border-t border-rule pt-6 text-[13px] text-faint">
      Sessions end quietly unless you allow notifications.{" "}
      <button
        type="button"
        onClick={() => void askForNotifications().then(setState)}
        className="text-dim underline underline-offset-4 hover:text-text"
      >
        Allow notifications
      </button>
    </p>
  );
}
