import "server-only";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "./db";
import { focusSessions, pushSubscriptions } from "./db/schema";
import { xpForLength } from "./session-service";

/**
 * Web push (SPEC.md §11, Phase 4).
 *
 * The spec gates this on missed session ends turning out to be a real problem
 * in daily use, which they did: with the app closed, a phone runs nothing of
 * ours, so a push from the server is the only way to reach it.
 */

/** Consecutive failures before a subscription is given up on. */
const MAX_FAILURES = 8;

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:nobody@example.invalid",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** A P-256 point is 65 bytes and the auth secret 16, base64url-encoded. */
export function looksLikeSubscription(sub: Subscription): boolean {
  return (
    /^https:\/\//.test(sub.endpoint) &&
    sub.keys.p256dh.length >= 80 &&
    sub.keys.auth.length >= 16
  );
}

export async function saveSubscription(
  userId: string,
  sub: Subscription,
  deviceId: string | null,
): Promise<void> {
  if (!looksLikeSubscription(sub)) throw new Error("That subscription is malformed.");
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: sub.endpoint,
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      deviceId,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceId, failures: 0 },
    });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

type Payload = { title: string; body: string; url?: string };

/**
 * Sends to every browser this user registered. A subscription the push service
 * has retired comes back 404 or 410; those rows are deleted rather than
 * retried, which is the only way they are ever cleaned up.
 */
export async function pushToUser(userId: string, payload: Payload): Promise<number> {
  if (!configure()) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let delivered = 0;
  const dead: string[] = [];
  const failed: string[] = [];
  const worked: string[] = [];

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 900 },
        );
        delivered += 1;
        worked.push(row.endpoint);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 and 410 are the push service saying the subscription is gone.
        if (status === 404 || status === 410) dead.push(row.endpoint);
        // Anything else — a corrupt key, a refused request, an outage — is
        // counted rather than trusted, and only retired after it keeps failing.
        else if (row.failures + 1 >= MAX_FAILURES) dead.push(row.endpoint);
        else failed.push(row.endpoint);
      }
    }),
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
  }
  if (failed.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ failures: sql`${pushSubscriptions.failures} + 1` })
      .where(inArray(pushSubscriptions.endpoint, failed));
  }
  if (worked.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date(), failures: 0 })
      .where(inArray(pushSubscriptions.endpoint, worked));
  }

  return delivered;
}

/**
 * Anything that ended recently and has not been announced yet.
 *
 * Deliberately not "what this call just settled": if a laptop had the page open
 * it will have settled the session itself, and the phone in your pocket still
 * needs telling. The window keeps a cron outage from firing a backlog at you
 * an hour later.
 */
const RECENT_MINUTES = 30;

export async function announceEndedSessions(): Promise<{
  notified: number;
  delivered: number;
}> {
  const since = new Date(Date.now() - RECENT_MINUTES * 60_000);

  const rows = await db
    .select()
    .from(focusSessions)
    .where(
      and(
        isNull(focusSessions.notifiedAt),
        gt(focusSessions.endedAt, since),
        inArray(focusSessions.status, ["awaiting_report", "abandoned"]),
      ),
    );

  let delivered = 0;

  for (const row of rows) {
    const payload: Payload =
      row.status === "awaiting_report"
        ? {
            title: `${row.plannedMinutes} minutes done`,
            body: `+${xpForLength(row.plannedMinutes)} XP banked. Log it to keep it.`,
            url: "/",
          }
        : {
            title: "Session abandoned",
            body:
              row.abandonReason === "heartbeat_lost"
                ? "The page went away for over two minutes. −30 XP."
                : "−30 XP, and it is in the log.",
            url: "/log",
          };

    delivered += await pushToUser(row.userId, payload);

    await db
      .update(focusSessions)
      .set({ notifiedAt: new Date() })
      .where(eq(focusSessions.id, row.id));
  }

  return { notified: rows.length, delivered };
}

/** Live sessions that may have ended or gone quiet since anyone last looked. */
export async function usersWithLiveSessions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: focusSessions.userId })
    .from(focusSessions)
    .where(inArray(focusSessions.status, ["active", "paused"]));
  return rows.map((r) => r.userId);
}
