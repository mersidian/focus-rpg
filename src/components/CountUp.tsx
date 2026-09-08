"use client";

import { useEffect, useRef, useState } from "react";
import { groupNumber } from "@/lib/format";

/**
 * A number that travels to its new value rather than jumping (§8's animated XP
 * gain). The point is legibility, not decoration: seeing 4 570 climb to 4 595
 * tells you a session landed and what it was worth, which a silent replacement
 * does not.
 *
 * Tabular numerals mean the width never changes as digits roll, so nothing
 * beside it shifts. Reduced motion gets the destination immediately.
 */
export function CountUp({
  value,
  durationMs = 650,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }

    const began = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - began) / durationMs);
      // Ease out: quick off the mark, settling rather than stopping dead.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, durationMs]);

  return <span className={className}>{groupNumber(shown)}</span>;
}
