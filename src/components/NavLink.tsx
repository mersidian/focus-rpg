"use client";

import Link, { useLinkStatus } from "next/link";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

/**
 * The icon slot, which becomes a spinner while this link's page is on its way.
 *
 * `useLinkStatus` only reports for the `<Link>` it sits inside, so the mark
 * that spins is the one the user actually pressed. That matters more than a
 * bar across the top would: the complaint was not "I cannot see that
 * something is loading", it was not knowing whether the tap had registered at
 * all, and the answer to that belongs on the thing that was tapped.
 *
 * A route-level `loading.tsx` covers the same wait from the other side. This
 * one starts sooner — it fires on the click, before the server has said
 * anything — and it is the only feedback for a navigation to a page that
 * resolves before its boundary ever shows.
 */
function Mark({ name }: { name: IconName }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Spinner className="size-4 shrink-0" />
  ) : (
    <Icon name={name} className="size-4 shrink-0" />
  );
}

export function NavLink({
  href,
  label,
  icon,
  current,
  className = "",
  labelClass = "",
}: {
  href: string;
  label: string;
  icon: IconName;
  current: boolean;
  className?: string;
  /**
   * For hiding the word and keeping the mark. `sr-only` rather than `hidden`,
   * so a condensed row is still a list of nine named places to anything that
   * is not looking at it.
   */
  labelClass?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-1.5 ${className} ${
        current ? "" : "text-faint transition-colors hover:text-dim"
      }`}
      style={current ? { color: "var(--tier)" } : undefined}
    >
      <Mark name={icon} />
      <span className={labelClass}>{label}</span>
    </Link>
  );
}
