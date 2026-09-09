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
import { SessionResultScreen } from "./SessionResultScreen";

export function TimerScreen() {
  const game = useGame();
  const { snapshot, ruleset, serverNow, gameResult } = game;
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
  const [tonic, setTonic] = useState<string | null>(null);
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

  /*
   * The result comes after the report, not instead of it.
   *
   * `resolveActivity` runs inside the report handler, after the session is
   * marked complete — nothing is credited before a session is logged — so the
   * card cannot show a result it precedes, and resolving earlier would pay for
   * a session the user has not yet accounted for. A "just focus" session
   * resolves to null, so this branch never fires and the fork lands on Idle
   * exactly as it always did.
   */
  if (gameResult) {
    return (
      <>
        <SessionResultScreen result={gameResult} />
        <LevelUpOverlay />
        <UnlockToast />
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
          tonic={tonic}
          onTonic={setTonic}
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
  tonic,
  onTonic,
}: {
  choice: number;
  onChoose: (n: number) => void;
  activity: Activity | null;
  onActivity: (a: Activity | null) => void;
  tonic: string | null;
  onTonic: (t: string | null) => void;
}) {
  const { snapshot, ruleset, begin, pending, error, clearError, lastSettled } = useGame();
  const { state } = snapshot;
  const info = describeLevel(state.level);
  const ratio = completionRatio(state.sessionsCompleted, state.sessionsAbandoned);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-10 sm:px-10">
      {/*
        Who you are, on one line, and then the thing the page is for.

        This screen used to open with eight retrospective blocks — rank, level,
        rail, four lifetime stats, a freeze note, an abandon note — and put the
        session length, the activity and the Start button ninth, tenth and
        eleventh of fourteen. Measured at 375px with none of the optional blocks
        present, the top of the Start button sat around 861px down: a viewport
        and a bit below the fold on the app's primary screen. The stats are
        still here, one scroll down, which is where a page about starting a
        session should keep the record of sessions already finished.
      */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="earned text-head leading-[0.95] sm:text-hero" style={{ color: "var(--tier)" }}>
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
        <p className="text-note text-faint">
          Level <span className="tnum text-dim">{state.level}</span> of 100
          {snapshot.prestige.bonusPercent > 0 && (
            <>
              {" — "}
              <span className="tnum text-dim">+{snapshot.prestige.bonusPercent}%</span> XP
            </>
          )}
        </p>
      </header>

      <div className="mt-4">
        <XpRail xp={state.xp} level={state.level} />
      </div>

      <ChainOffer />

      <section className="mt-8">
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
                  className="tnum block text-title leading-none transition-colors"
                  style={{ color: selected ? "var(--action)" : undefined }}
                >
                  {minutes}
                </span>
                <span className="mt-2 block text-body text-faint">minutes</span>
                <span className="mt-1 block text-body text-faint">
                  <span className="tnum text-dim">
                    +
                    {Math.round(
                      XP_BY_LENGTH[minutes] *
                        xpMultiplier(snapshot.prestige.stars) *
                        (snapshot.chain.multiplierByLength[minutes] ?? snapshot.chain.multiplier),
                    )}
                  </span>{" "}
                  XP
                  {/* The bonus note wraps the slab onto a second line on a
                      phone, where the figure already tells the story. */}
                  {minutes === 50 && <span className="hidden sm:inline"> (+20%)</span>}
                  {/* The chain is worth more spent on a longer session, so each
                      slab says what the chain is worth on IT rather than
                      quoting one figure for all three. */}
                  {snapshot.chain.links > 0 && (
                    <span className="tnum block" style={{ color: "var(--tier)" }}>
                      ×{(snapshot.chain.multiplierByLength[minutes] ?? 1).toFixed(2)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <ActivityPicker value={activity} onChange={onActivity} tonic={tonic} onTonic={onTonic} />

        <button
          type="button"
          onClick={() => begin(choice, activity ?? undefined, tonic ?? undefined)}
          disabled={pending}
          className="mt-5 w-full rounded-sm px-6 py-5 text-commit font-medium text-ground transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--action)" }}
        >
          {/* `pending` covers any in-flight action, including a background
              refresh, so it disables the button without claiming a session is
              starting. A real start swaps this whole view out immediately. */}
          Start {choice} minutes
        </button>

      </section>

      {/* The error belongs with the press that caused it, not at the far end
          of the page. */}
      {error && (
        <p className="mt-5 text-body" style={{ color: "var(--color-warn)" }}>
          {error}{" "}
          <button type="button" onClick={clearError} className="underline underline-offset-2">
            Dismiss
          </button>
        </p>
      )}

      <RulesetNote ruleset={ruleset} align="left" />

      <dl className="mt-12 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t border-rule pt-6 text-body">
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
          className="mt-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--color-ice)" }}
        >
          {snapshot.streak.frozeDays.length === 1
            ? "Freeze used — streak intact, "
            : `${snapshot.streak.frozeDays.length} freezes used — streak intact, `}
          <span className="tnum">{snapshot.streak.freezes}</span> left.
        </p>
      )}

      {lastSettled?.kind === "abandoned" && (
        <p
          className="mt-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--color-warn)" }}
        >
          Last session was abandoned —{" "}
          {ABANDON_REASON_LABEL[lastSettled.reason].toLowerCase()}.{" "}
          <span className="tnum">−30</span> XP, and it is in the log.
        </p>
      )}

      {snapshot.prestige.offerAvailable && (
        <p className="mt-8 text-body">
          <a
            href="/character"
            className="underline underline-offset-4"
            style={{ color: "var(--tier)" }}
          >
            You have reached level 50. There is a choice waiting.
          </a>
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
      <p className="text-lead">
        <span className="tnum" style={{ color: "var(--tier)" }}>
          ×{(chain.multiplierByLength[50] ?? chain.multiplier).toFixed(2)}
        </span>{" "}
        <span className="text-dim">
          on a fifty — {chain.links} in a row
          {chain.atCap && ", as long as the chain goes"}
        </span>
      </p>
      <p className="mt-2 text-body text-faint">
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
      <dd className="tnum text-stat text-text">{value}</dd>
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

      <p className="mt-6 text-body text-faint">
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
            className="rounded-sm px-6 py-3 text-lead font-medium text-ground disabled:opacity-50"
            style={{ backgroundColor: "var(--tier)" }}
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            disabled={pending || pausesLeft <= 0 || pauseLeft <= 0}
            className="rounded-sm border border-rule px-6 py-3 text-lead text-dim transition-colors hover:text-text disabled:opacity-40"
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
          className="rounded-sm px-6 py-3 text-lead text-faint transition-colors hover:text-warn disabled:opacity-40"
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
      className={`mt-6 text-note leading-relaxed text-faint ${
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
      <p className="mt-10 border-t border-rule pt-6 text-body leading-relaxed text-faint">
        To be told when a session ends, add this to your home screen — Share, then Add to
        Home Screen. iPhone only allows notifications to an installed app.
      </p>
    );
  }

  if (state !== "default") return null;

  return (
    <p className="mt-10 border-t border-rule pt-6 text-body text-faint">
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
