"use client";

export function notificationState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function askForNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (notificationState() === "unsupported") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export function notifySessionEnd(minutes: number, xp: number) {
  if (notificationState() !== "granted") return;
  try {
    new Notification(`${minutes} minutes done`, {
      body: `+${xp} XP banked. Log the session to keep it.`,
      tag: "focus-rpg-session-end",
      requireInteraction: false,
    });
  } catch {
    // Some browsers refuse constructor notifications outside a service worker.
  }
}
