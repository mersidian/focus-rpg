import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildSnapshot, checkIn, reconcile } from "@/lib/session-service";

/**
 * Liveness only — proof the page still exists (§3). No activity is recorded and
 * switching tabs is fine. Desktop pings every 15s; a gap over two minutes
 * means the session lacked focus, and it finishes at half XP.
 *
 * Order matters: the session is settled first, if its time ran out while the
 * page was away, and `checkIn` judges the gap before recording this ping —
 * otherwise reopening the tab after five minutes would erase the evidence.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { sessionId, deviceId } = (await request.json()) as {
    sessionId?: string;
    deviceId?: string;
  };

  await reconcile(userId, deviceId ?? null);
  if (sessionId) await checkIn(userId, sessionId);

  return NextResponse.json(await buildSnapshot(userId, deviceId ?? null, 20));
}
