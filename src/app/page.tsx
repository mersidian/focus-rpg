import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildSnapshot } from "@/lib/session-service";
import { GameProvider } from "@/components/GameProvider";
import { Chrome } from "@/components/Chrome";
import { Nav } from "@/components/Nav";
import { TimerScreen } from "@/components/TimerScreen";

export const dynamic = "force-dynamic";

export default async function TimerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const snapshot = await buildSnapshot(session.user.id, null, 10);

  return (
    <GameProvider initial={snapshot}>
      <Chrome nav={<Nav current="/" />}>
        <TimerScreen />
      </Chrome>
    </GameProvider>
  );
}
