import Link from "next/link";
import { signOut } from "@/lib/auth";

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

/**
 * Nine destinations do not fit across a phone, so the row wraps rather than
 * running off the edge. Hiding half the app behind a sideways scroll nobody
 * would think to try is worse than a second line.
 */
export function Nav({ current }: { current: string }) {
  return (
    <nav className="safe-top flex flex-wrap items-center gap-x-5 border-b border-rule px-6 pb-2 text-[13px] sm:gap-x-6 sm:px-10 sm:pb-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
          // Padding rather than margin, so the tap target is comfortably
          // bigger than the text without opening gaps in the row.
          className={`py-2 ${
            link.href === current
              ? "text-text"
              : "text-faint transition-colors hover:text-dim"
          }`}
          style={link.href === current ? { color: "var(--tier)" } : undefined}
        >
          {link.label}
        </Link>
      ))}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
        className="ml-auto"
      >
        <button
          type="submit"
          className="py-2 text-faint transition-colors hover:text-dim"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
