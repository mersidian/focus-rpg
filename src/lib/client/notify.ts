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

/**
 * Registers this browser for push, so a session can be announced even with the
 * app closed. Without this the notification only fires while something of ours
 * is still running (§11, Phase 4).
 */
export async function subscribeToPush(deviceId: string): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return false;

  const registration = await registerServiceWorker();
  if (!registration || !("pushManager" in registration)) return false;

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), deviceId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** VAPID keys travel as base64url; the subscribe call wants raw bytes. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function askForNotifications(deviceId: string): Promise<NotifyState> {
  if (notificationState() === "unsupported") return "unsupported";

  const result =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (result === "granted") await subscribeToPush(deviceId);
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
