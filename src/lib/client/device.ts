"use client";

const DEVICE_KEY = "focusrpg:device";

/** Stable per-browser id, used for the sync device column (§2). */
export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * Mobile browsers freeze background tabs, so the heartbeat would register a
 * false abandon. Sessions started here run under the mobile ruleset (§3).
 */
export function detectRuleset(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const touch = navigator.maxTouchPoints > 1;
  return coarse && (narrow || touch) ? "mobile" : "desktop";
}
