"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIKI_DOCS } from "@/lib/wiki/docs";

const SECTIONS = [
  { href: "/wiki", label: "Overview" },
  { href: "/wiki/rules", label: "Rules" },
  { href: "/wiki/game", label: "The game" },
  { href: "/wiki/levels", label: "Levels" },
  { href: "/wiki/achievements", label: "Achievements" },
];

/**
 * A second row under the app's own nav. The wiki is one destination in the app
 * and several inside itself, and collapsing those two levels into one row of
 * eleven links would read as eleven equal places.
 */
export function WikiNav() {
  const path = usePathname();
  const links = [
    ...SECTIONS,
    ...WIKI_DOCS.map((d) => ({ href: `/wiki/doc/${d.slug}`, label: d.title })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 border-b border-rule px-6 py-2 text-note sm:gap-x-5 sm:px-10">
      {links.map((link) => {
        const current = path === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`py-1 ${current ? "" : "text-faint transition-colors hover:text-dim"}`}
            style={current ? { color: "var(--tier)" } : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
