import Link from "next/link";

const links = [
  { href: "/", label: "Timer" },
  { href: "/character", label: "Character" },
  { href: "/streak", label: "Streak" },
  { href: "/achievements", label: "Achievements" },
  { href: "/projects", label: "Projects" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log" },
  { href: "/game", label: "Game" },
  { href: "/wiki", label: "Wiki" },
];

/** Inside the game, the app row shrinks to the four ways out of it. */
const COMPACT = new Set(["/", "/character", "/game", "/wiki"]);

/**
 * Nine destinations do not fit across a phone, so the row wraps rather than
 * running off the edge. Hiding half the app behind a sideways scroll nobody
 * would think to try is worse than a second line.
 *
 * Sign out used to live here, pushed right with `ml-auto`. On a wrapped row
 * that put it wherever the wrap happened to leave it, and it was the tenth
 * item in a bar where the other nine are places to go — so it now sits on
 * `/character`, with the rest of the account. That took the phone row from
 * three lines to two, which paid for the tap targets: `py-3` is 42px against
 * the 34px they were, and the row still ends up shorter than it started.
 *
 * `compact` is for `/game`, which stacks this row above its own ten-link one.
 * Two full navigations meant 184px of chrome before any game screen began.
 */
export function Nav({ current, compact = false }: { current: string; compact?: boolean }) {
  const shown = compact ? links.filter((l) => COMPACT.has(l.href)) : links;

  return (
    <nav className="safe-top flex flex-wrap items-center gap-x-5 border-b border-rule px-6 pb-2 text-body sm:gap-x-6 sm:px-10 sm:pb-3">
      {shown.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
          // Padding rather than margin, so the tap target is comfortably
          // bigger than the text without opening gaps in the row.
          className={`py-3 ${
            link.href === current ? "" : "text-faint transition-colors hover:text-dim"
          }`}
          style={link.href === current ? { color: "var(--tier)" } : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
