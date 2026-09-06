"use client";

import { useEffect, useState } from "react";

/** Re-renders on an interval. Used only where a clock is on screen. */
export function useTick(intervalMs = 1000, enabled = true) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
