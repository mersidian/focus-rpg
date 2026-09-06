/**
 * Focus RPG service worker.
 *
 * It deliberately does not cache anything. Every page here is server-rendered
 * and time-sensitive — a cached timer or a cached streak would be a lie — so
 * this exists purely to own notifications, which on iOS can only be shown from
 * an installed app's worker.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** A session ending, pushed from the server. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title ?? "Session finished";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "Log it to keep the XP.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "focus-rpg-session-end",
      renotify: true,
      data: { url: payload.url ?? "/" },
    }),
  );
});

/** Tapping the notification opens the app rather than a new copy of it. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
