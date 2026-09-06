import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { removeSubscription, saveSubscription } from "@/lib/push-service";

export const runtime = "nodejs";

/** Registers this browser to be told when a session ends. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json()) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    deviceId?: string;
  };

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: "Incomplete subscription." }, { status: 400 });
  }

  await saveSubscription(
    userId,
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    body.deviceId ?? null,
  );

  return NextResponse.json({ ok: true });
}

/** Called when a browser unsubscribes, so dead rows do not pile up. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (endpoint) await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
