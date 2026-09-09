import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { WikiNav } from "@/components/WikiNav";
import { tierAccent, tierAction } from "@/lib/format";

/**
 * The wiki is the only part of the app that is not about a character, so it is
 * the only part that does not wear a tier colour. It keeps one fixed accent —
 * a document's colour, not a rank's — and reads no game state at all, which is
 * also why it needs no database.
 */
const WIKI_ACCENT = tierAccent(85, 0.35);
const WIKI_ACTION = tierAction(85, 0.35);

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <div
      style={
        {
          /*
           * Both vars are reset, not just --tier. The root layout paints the
           * earned accent on the body now, so opting out has to be explicit:
           * before, the wiki stood outside the ladder only because nothing had
           * set the colour yet.
           */
          "--tier": WIKI_ACCENT,
          "--action": WIKI_ACTION,
        } as CSSProperties
      }
    >
      <Nav current="/wiki" />
      <WikiNav />
      {children}
    </div>
  );
}
