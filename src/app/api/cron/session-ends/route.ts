import { NextResponse } from "next/server";
import { reconcile } from "@/lib/session-service";
import { announceEndedSessions, usersWithLiveSessions } from "@/lib/push-service";

/**
 * Hit every minute by an external scheduler.
 *
 * Nothing of ours runs on a closed phone, and nothing on the server wakes by
 * itself, so this is what notices that a session's time is up. It does two
 * things: settles any live session against the server clock — the same work a
 * page load does — and then pushes for anything that ended and has not been
 * announced.
 *
 * Guarded by a shared secret rather than a session, because the caller is a
 * machine. It is safe to call as often as you like: settling is idempotent and
 * each session is announced once.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  const offered =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (offered !== expected) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const users = await usersWithLiveSessions();
  for (const userId of users) {
    await reconcile(userId, null);
  }

  const result = await announceEndedSessions();

  return NextResponse.json({
    ok: true,
    reconciled: users.length,
    ...result,
    at: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
