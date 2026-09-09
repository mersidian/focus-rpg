import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { WikiNav } from "@/components/WikiNav";
import { tierAccent } from "@/lib/format";

/**
 * The wiki is the only part of the app that is not about a character, so it is
 * the only part that does not wear a tier colour. It keeps one fixed accent —
 * a document's colour, not a rank's — and reads no game state at all, which is
 * also why it needs no database.
 */
const WIKI_ACCENT = tierAccent(85, 0.35);

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <div style={{ "--tier": WIKI_ACCENT } as CSSProperties}>
      <Nav current="/wiki" />
      <WikiNav />
      {children}
    </div>
  );
}
