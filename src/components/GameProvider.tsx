"use client";

import type { Activity } from "@/lib/game/activity";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  giveUp as giveUpAction,
  pauseSession,
  refreshSnapshot,
  resumeSession,
  startSession,
  submitReport,
} from "@/lib/actions";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/constants";
import { describeLevel } from "@/lib/levels";
import { tierAccent, tierAction } from "@/lib/format";
import { deviceId as readDeviceId, detectRuleset } from "@/lib/client/device";
import { useClientValue } from "@/lib/client/use-client-value";
import { playChime } from "@/lib/client/chime";
import { notifySessionEnd } from "@/lib/client/notify";
import type { LevelChange, SettleEvent, Snapshot,
  ResolutionSummary,
} from "@/lib/game-types";

const CACHE_KEY = "focusrpg:snapshot";

type Cached = Pick<Snapshot, "state" | "active" | "awaitingReport" | "projects">;

type Ctx = {
  snapshot: Snapshot;
  ruleset: "desktop" | "mobile";
  /** Server clock, corrected for this device's drift. Never `Date.now()` alone. */
  serverNow: () => number;
  pending: boolean;
  error: string | null;
  clearError: () => void;
  lastSettled: SettleEvent | null;
  levelChange: LevelChange | null;
  dismissLevelChange: () => void;
  /** What the game paid for the session just logged, until it is dismissed. */
  gameResult: ResolutionSummary | null;
  dismissGameResult: () => void;
  begin: (minutes: number, activity?: Activity, tonicItemId?: string) => void;
  pause: () => void;
  resume: () => void;
  abandon: () => void;
  report: (input: {
    projectId: string | null;
    newProjectName: string | null;
    note: string;
    honest: boolean;
  }) => void;
  refresh: () => void;
};

const GameContext = createContext<Ctx | null>(null);

/**
 * The context when there is one, and null when there is not.
 *
 * Only the timer mounts a provider, because buildSnapshot reconciles sessions
 * and advances the streak — it is a write, and a page has no business doing one
 * to draw itself. So anything that wants to work on the other routes has to
 * cope without it rather than force a provider up the tree.
 */
export function useGameOptional(): Ctx | null {
  return useContext(GameContext);
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider.");
  return ctx;
}

/**
 * The cache is a mirror, never a source of truth. XP is derived from sessions
 * the server timed and validated (§2), so a device can never tell the server
 * what its character is worth — only the other way round.
 */
function writeCache(snap: Snapshot) {
  try {
    const cached: Cached = {
      state: snap.state,
      active: snap.active,
      awaitingReport: snap.awaitingReport,
      projects: snap.projects,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // A full or disabled localStorage must not stop the timer.
  }
}

export function GameProvider({
  initial,
  children,
}: {
  initial: Snapshot;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [error, setError] = useState<string | null>(null);
  const [levelChange, setLevelChange] = useState<LevelChange | null>(
    initial.levelChange ?? null,
  );
  const [lastSettled, setLastSettled] = useState<SettleEvent | null>(initial.settled);
  /*
   * Held in provider state rather than read off the snapshot, because the
   * snapshot is replaced by every heartbeat and every visibility change — and
   * `buildSnapshot` deliberately sets this to null, so reading it there would
   * make the screen vanish the moment the next ping landed.
   */
  const [gameResult, setGameResult] = useState<ResolutionSummary | null>(
    initial.game ?? null,
  );
  const [pending, startTransition] = useTransition();

  /*
   * A fact about the device, read the same way the notification prompt reads
   * its own: `detectRuleset` already answers "desktop" where there is no
   * window, so that is both the server snapshot and the safe default.
   */
  const ruleset = useClientValue(detectRuleset, "desktop" as const);
  const [mounted, setMounted] = useState(false);
  const device = useRef<string>("server");
  const offset = useRef<number>(0);
  const announced = useRef<Set<string>>(new Set());

  /**
   * Before hydration the clock is the timestamp baked into the HTML, so the
   * server and the first client render agree. After mounting it is this
   * device's clock corrected by the server's, never `Date.now()` alone (§2).
   */
  const stamped = snapshot.serverNow;
  const serverNow = useCallback(
    () => (mounted ? Date.now() + offset.current : stamped),
    [mounted, stamped],
  );

  /* ---------------------------------------------- adopt a server snapshot */

  const adopt = useCallback((snap: Snapshot) => {
    offset.current = snap.serverNow - Date.now();
    setMounted(true);
    setSnapshot(snap);
    writeCache(snap);
    if (snap.levelChange) setLevelChange(snap.levelChange);
    if (snap.game) setGameResult(snap.game);
    if (snap.settled) {
      setLastSettled(snap.settled);
      // Chime and notification fire once per session, wherever the transition
      // was noticed — a countdown running out, a heartbeat, or a page load.
      if (!announced.current.has(snap.settled.sessionId)) {
        announced.current.add(snap.settled.sessionId);
        if (snap.settled.kind === "completed") {
          playChime();
          notifySessionEnd(snap.settled.plannedMinutes, snap.settled.xp);
        }
      }
    }
  }, []);

  const run = useCallback(
    (work: () => Promise<Snapshot>, onError?: () => void) => {
      startTransition(async () => {
        try {
          adopt(await work());
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          onError?.();
        }
      });
    },
    [adopt],
  );

  /* ------------------------------------------------------------- start-up */

  useEffect(() => {
    device.current = readDeviceId();
    offset.current = initial.serverNow - Date.now();
    /*
     * The one setState in an effect this file keeps, and the reason is the
     * clock. `mounted` gates `serverNow` from the timestamp baked into the
     * HTML over to this device's corrected clock, and it may only flip once
     * `offset` above is set — a hydration-safe store would flip it in its own
     * effect, which is not guaranteed to run after this one. Reading a wrong
     * clock for a frame is worse than a second render on start-up.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    writeCache(initial);
    // Intentionally start-up only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------- the accent the user earned */

  /*
   * The root layout already paints the earned accent server-side, so the first
   * frame is correct and this no longer has anything to fix on load. What it
   * still does is move the colour the moment a session grants a rank, without
   * a reload.
   *
   * It writes to the body and not to documentElement because that is where the
   * layout sets them: a custom property inherits, so an inline style on the
   * body would shadow anything written to :root and the accent would stop
   * following the character.
   */
  useEffect(() => {
    const tier = describeLevel(snapshot.state.level);
    const { style } = document.body;
    style.setProperty("--tier", tierAccent(tier.hue, tier.intensity));
    style.setProperty("--tier-deep", tierAccent(tier.hue, tier.intensity, 0.42));
    style.setProperty("--action", tierAction(tier.hue, tier.intensity));
  }, [snapshot.state.level]);

  /* -------------------------------------------------------- desktop pings */

  const activeId = snapshot.active?.id ?? null;
  const activeStatus = snapshot.active?.status ?? null;

  useEffect(() => {
    if (!activeId || ruleset !== "desktop") return;

    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: activeId, deviceId: device.current }),
          keepalive: true,
        });
        if (!res.ok || cancelled) return;
        adopt((await res.json()) as Snapshot);
      } catch {
        // Offline is fine: the grace period is two minutes wide (§3).
      }
    };

    void ping();
    const id = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeId, ruleset, adopt]);

  /* ------------------------------------------------------- phone polling */

  /**
   * Mobile sends no heartbeat, because a frozen background tab would stop
   * pinging and register a false abandon (§3) — but that left a phone with no
   * way to learn that the session had been paused on another device.
   *
   * This reads the state and writes nothing, so it can neither cause an abandon
   * nor prevent one. It needs no visibility check either: a phone that
   * backgrounds this tab suspends its timers, which stops the polling on its
   * own, and `visibilitychange` already refreshes on the way back.
   */
  useEffect(() => {
    if (!activeId || ruleset !== "mobile") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const snap = await refreshSnapshot(device.current);
        if (!cancelled) adopt(snap);
      } catch {
        // A dropped poll costs nothing; the next one is fifteen seconds away.
      }
    };

    const id = setInterval(poll, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeId, ruleset, adopt]);

  /* ------------------------------------ come back from sleep or a new tab */

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      run(() => refreshSnapshot(device.current));
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [run]);

  /* ------------------------------ mobile has no heartbeat, so watch the end */

  useEffect(() => {
    const session = snapshot.active;
    if (!session || session.status !== "active") return;

    const endsAt = session.startedAt + session.plannedMinutes * 60_000 + session.pausedMs;
    const wait = endsAt - serverNow() + 400;
    const id = setTimeout(() => run(() => refreshSnapshot(device.current)), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [snapshot.active, serverNow, run]);

  /* ------------------------------------------------------------- commands */

  const begin = useCallback(
    (minutes: number, activity?: Activity, tonicItemId?: string) => {
      const id = crypto.randomUUID();
      const at = serverNow();
      setLastSettled(null);

      // Optimistic, written before the request leaves (§2 local-first).
      setSnapshot((prev) => {
        const next: Snapshot = {
          ...prev,
          settled: null,
          active: {
            id,
            plannedMinutes: minutes,
            ruleset,
            status: "active",
            startedAt: at,
            pausedAt: null,
            pausedMs: 0,
            pauseCount: 0,
            lastHeartbeatAt: at,
            xpAwarded: 0,
          },
        };
        writeCache(next);
        return next;
      });

      run(
        () =>
          startSession({
            id,
            plannedMinutes: minutes,
            ruleset,
            deviceId: device.current,
            activity,
            tonicItemId,
          }),
        () => {
          /**
           * The optimistic session has to go if the server would not take it.
           * Sessions are validated against the server clock (§2), so one it
           * never recorded is worth nothing — leaving the countdown on screen
           * would run out the user's time against a session that does not
           * exist.
           */
          setSnapshot((prev) => {
            if (prev.active?.id !== id) return prev;
            const reverted: Snapshot = { ...prev, active: null };
            writeCache(reverted);
            return reverted;
          });
        },
      );
    },
    [ruleset, run, serverNow],
  );

  const pause = useCallback(() => {
    const id = snapshot.active?.id;
    if (id) run(() => pauseSession(id, device.current));
  }, [snapshot.active?.id, run]);

  const resume = useCallback(() => {
    const id = snapshot.active?.id;
    if (id) run(() => resumeSession(id, device.current));
  }, [snapshot.active?.id, run]);

  const abandon = useCallback(() => {
    const id = snapshot.active?.id;
    if (id) run(() => giveUpAction(id, device.current));
  }, [snapshot.active?.id, run]);

  const report = useCallback<Ctx["report"]>(
    (input) => {
      const id = snapshot.awaitingReport?.id;
      if (!id) return;
      run(() => submitReport({ ...input, sessionId: id, deviceId: device.current }));
    },
    [snapshot.awaitingReport?.id, run],
  );

  const refresh = useCallback(() => run(() => refreshSnapshot(device.current)), [run]);

  const value = useMemo<Ctx>(
    () => ({
      snapshot,
      ruleset,
      serverNow,
      pending,
      error,
      clearError: () => setError(null),
      lastSettled,
      levelChange,
      dismissLevelChange: () => setLevelChange(null),
      gameResult,
      dismissGameResult: () => setGameResult(null),
      begin,
      pause,
      resume,
      abandon,
      report,
      refresh,
    }),
    [
      snapshot,
      ruleset,
      serverNow,
      pending,
      error,
      lastSettled,
      levelChange,
      gameResult,
      begin,
      pause,
      resume,
      abandon,
      report,
      refresh,
    ],
  );

  // `activeStatus` participates so a pause/resume re-renders consumers promptly.
  void activeStatus;

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
