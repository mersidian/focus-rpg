import { NavLink } from "./NavLink";
import type { IconName } from "./Icon";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Timer", icon: "timer" },
  { href: "/character", label: "Character", icon: "character" },
  { href: "/streak", label: "Streak", icon: "streak" },
  { href: "/achievements", label: "Achievements", icon: "achievements" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/log", label: "Log", icon: "log" },
  { href: "/game", label: "Game", icon: "game" },
  { href: "/wiki", label: "Wiki", icon: "wiki" },
];

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
 * It used to buy that back by dropping this row to four links, which deleted
 * Streak, Achievements, Projects, Dashboard and Log from the one section
 * where nothing else reaches them — the app looked like it had lost five
 * pages. It now condenses instead of deleting: below `sm` the words go and
 * the marks stay, which is nine destinations on one line instead of four on
 * one line and five nowhere. That is what the icons are for. Above `sm`
 * there is room for both, so both show.
 */
export function Nav({ current, compact = false }: { current: string; compact?: boolean }) {
  return (
    <nav className="safe-top flex flex-wrap items-center gap-x-5 border-b border-rule px-6 pb-2 text-body sm:gap-x-6 sm:px-10 sm:pb-3">
      {links.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          current={link.href === current}
          // Padding rather than margin, so the tap target is comfortably
          // bigger than the text without opening gaps in the row.
          className="py-3"
          labelClass={compact ? "sr-only sm:not-sr-only" : ""}
        />
      ))}
    </nav>
  );
}
