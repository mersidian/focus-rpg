"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/game", label: "Overview" },
  { href: "/game/skills", label: "Skills" },
  { href: "/game/areas", label: "Areas" },
  { href: "/game/equipment", label: "Equipment" },
  { href: "/game/bank", label: "Bank" },
  { href: "/game/collection", label: "Collection" },
  { href: "/game/crafting", label: "Crafting" },
  { href: "/game/farm", label: "Farm" },
  { href: "/game/slaying", label: "Slaying" },
  { href: "/game/shop", label: "Shop" },
];

/**
 * A second row under the app's own nav, the same shape `/wiki` uses.
 *
 * Ten game destinations as top-level entries would put seventeen links of equal
 * weight in one row, and would let the game dilute the four screens the app is
 * actually for. One entry with its own row keeps the productivity surface and
 * the game surface apart.
 */
export function GameNav() {
  const path = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-x-4 border-b border-rule px-6 py-2 text-[12px] sm:gap-x-5 sm:px-10">
      {LINKS.map((link) => {
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
