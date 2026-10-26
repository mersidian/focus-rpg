import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusSessions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { buildSnapshot, reconcile } from "@/lib/session-service";

/**
 * Liveness only — proof the page still exists (§3). No activity is recorded and
 * switching tabs is fine. Desktop pings every 15s; a gap over two minutes
 * abandons the session.
 *
 * Order matters: the gap is judged *before* this ping is recorded, otherwise
 * reopening the tab after five minutes away would erase the evidence.
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

  if (sessionId) {
    await db
      .update(focusSessions)
      .set({ lastHeartbeatAt: new Date() })
      .where(
        and(
          eq(focusSessions.id, sessionId),
          eq(focusSessions.userId, userId),
          inArray(focusSessions.status, ["active", "paused"]),
        ),
      );
  }

  return NextResponse.json(await buildSnapshot(userId, deviceId ?? null, 20));
}
