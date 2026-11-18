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
 * Which kind of device a session was started on, recorded on the row. It used
 * to choose whether a heartbeat was enforced; there is none now, and both
 * kinds of session follow the same rule.
 */
export function detectRuleset(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const touch = navigator.maxTouchPoints > 1;
  return coarse && (narrow || touch) ? "mobile" : "desktop";
}
