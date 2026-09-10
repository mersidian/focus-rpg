import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { GameNav } from "@/components/GameNav";

/**
 * The game wears the character's tier colour, because it belongs to the
 * character — unlike `/wiki`, which is about the ladder and so stands outside
 * it and resets both accent variables to say so.
 *
 * It gets that colour from the body. This layout used to work it out again for
 * itself — `loadState`, `describeLevel`, `tierAccent` into a local — from back
 * when seven pages each set `--tier` in their own wrapper. The root layout
 * paints it on the body now, and that refactor left the whole computation here
 * with nothing reading it: a database round-trip on every game page, for a
 * value that was assigned and dropped. Wearing the colour is now the same as
 * not opting out of it.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <>
      <Nav current="/game" compact />
      <GameNav />
      {children}
    </>
  );
}
