"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "./NavLink";
import type { IconName } from "./Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/game", label: "Overview", icon: "overview" },
  { href: "/game/skills", label: "Skills", icon: "skills" },
  { href: "/game/areas", label: "Areas", icon: "areas" },
  { href: "/game/equipment", label: "Equipment", icon: "equipment" },
  { href: "/game/bank", label: "Bank", icon: "bank" },
  { href: "/game/collection", label: "Collection", icon: "collection" },
  { href: "/game/crafting", label: "Crafting", icon: "crafting" },
  { href: "/game/farm", label: "Farm", icon: "farm" },
  { href: "/game/slaying", label: "Slaying", icon: "slaying" },
  { href: "/game/shop", label: "Shop", icon: "shop" },
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
    <div className="flex flex-wrap items-center gap-x-4 border-b border-rule px-6 py-1 text-note sm:gap-x-5 sm:px-10">
      {LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          current={path === link.href}
          className="py-2"
        />
      ))}
    </div>
  );
}
