"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * A horizontal scroller that starts at the end rather than the beginning.
 *
 * The year heatmap is about 742px wide in a 327px viewport, and it opened on
 * the oldest week — so on a phone the first thing you saw of your year was last
 * January, and today was three screens off the right edge with nothing to say
 * so. Anything scrolled sideways whose newest end matters wants this.
 *
 * It renders its children untouched, so what goes inside stays server-rendered:
 * this is a client component for one line of scroll position, not a boundary
 * the data has to cross.
 */
export function ScrollToEnd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={box} className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}
