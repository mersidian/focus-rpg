"use client";

/**
 * Session-end notifications (§3).
 *
 * Shown through the service worker registration rather than `new
 * Notification()`. On Android the constructor form is unreliable once the page
 * is backgrounded, and on iOS it does not exist at all outside an installed
 * app — the worker is the only route that works on a phone.
 */

export type NotifyState = NotificationPermission | "unsupported";

export function notificationState(): NotifyState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** True once the app is running from the home screen rather than a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS only offers notifications to an installed app, so the UI must say so. */
export function needsInstallFirst(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios && !isInstalled();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function askForNotifications(): Promise<NotifyState> {
  if (notificationState() === "unsupported") return "unsupported";

  const result =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (result === "granted") await registerServiceWorker();
  return result;
}

export async function notifySessionEnd(minutes: number, xp: number): Promise<void> {
  if (notificationState() !== "granted") return;

  const body = `+${xp} XP banked. Log the session to keep it.`;
  const options: NotificationOptions = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "focus-rpg-session-end",
  };

  try {
    const registration =
      (await navigator.serviceWorker?.getRegistration()) ?? (await registerServiceWorker());
    if (registration) {
      await registration.showNotification(`${minutes} minutes done`, options);
      return;
    }
  } catch {
    // Fall through to the constructor form below.
  }

  try {
    new Notification(`${minutes} minutes done`, options);
  } catch {
    // Some browsers refuse the constructor entirely; the chime still plays.
  }
}
