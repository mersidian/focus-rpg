import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { GameNav } from "@/components/GameNav";
import { loadState } from "@/lib/game-state";
import { describeLevel } from "@/lib/levels";
import { tierAccent } from "@/lib/format";

/**
 * The game wears the character's tier colour, because it belongs to the
 * character — unlike `/wiki`, which is about the ladder and so stands outside it.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  let accent = tierAccent(250, 0.1);
  try {
    const state = await loadState(session.user.id);
    const info = describeLevel(state.level);
    accent = tierAccent(info.hue, info.intensity);
  } catch {
    // Decoration must never take a page down.
  }

  return (
    <>
      <Nav current="/game" />
      <GameNav />
      {children}
    </>
  );
}
