"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "./NavLink";
import type { IconName } from "./Icon";

/**
 * Ten places, in the four groups a visit actually moves through: where you
 * stand, where you go, what you are, and what you hold and make.
 *
 * They were one flat row in the order they were built, so Slaying sat between
 * Farm and Shop and nothing said that Areas and Slaying are the same errand.
 */
const GROUPS: { href: string; label: string; icon: IconName }[][] = [
  [{ href: "/game", label: "Overview", icon: "overview" }],
  [
    { href: "/game/areas", label: "Areas", icon: "areas" },
    { href: "/game/slaying", label: "Slaying", icon: "slaying" },
  ],
  [
    { href: "/game/skills", label: "Skills", icon: "skills" },
    { href: "/game/equipment", label: "Equipment", icon: "equipment" },
  ],
  [
    { href: "/game/crafting", label: "Crafting", icon: "crafting" },
    { href: "/game/farm", label: "Farm", icon: "farm" },
    { href: "/game/bank", label: "Bank", icon: "bank" },
    { href: "/game/shop", label: "Shop", icon: "shop" },
    { href: "/game/collection", label: "Collection", icon: "collection" },
  ],
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
    <nav
      aria-label="Game"
      className="flex flex-wrap items-center gap-x-5 gap-y-0 border-b border-rule px-6 py-1 text-body sm:px-10"
    >
      {GROUPS.map((group, i) => (
        <div
          key={i}
          // The rule between groups is the grouping, and it only exists once
          // the row fits on one line. Below that the group dissolves
          // (`contents`) so the ten links wrap one at a time — as a box, the
          // last group was five links wide and ran off the edge of a phone.
          className={`contents lg:flex lg:items-center lg:gap-x-5 ${
            i > 0 ? "lg:border-l lg:border-rule lg:pl-5" : ""
          }`}
        >
          {group.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              current={path === link.href}
              className="py-2.5"
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
