"use client";

import { useEffect, useRef, useState } from "react";
import { groupNumber } from "@/lib/format";
import { useClientValue } from "@/lib/client/use-client-value";

/**
 * A number that travels to its new value rather than jumping (§8's animated XP
 * gain). The point is legibility, not decoration: seeing 4 570 climb to 4 595
 * tells you a session landed and what it was worth, which a silent replacement
 * does not.
 *
 * Tabular numerals mean the width never changes as digits roll, so nothing
 * beside it shifts. Reduced motion skips the animation and renders the
 * destination, which is not a state this component has to hold.
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
  /*
   * Asked once, at the first render rather than in an effect. Under reduced
   * motion this component has no work to do at all — it renders `value` — so
   * the old shape, which mounted, ran an effect and set state back to the
   * value it was already given, was two renders to arrive where it started.
   */
  const reduced = useClientValue(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    false,
  );
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) return;
    const start = from.current;
    if (start === value) return;

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
  }, [value, durationMs, reduced]);

  return <span className={className}>{groupNumber(reduced ? value : shown)}</span>;
}
