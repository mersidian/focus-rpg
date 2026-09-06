/**
 * Focus RPG service worker.
 *
 * It deliberately does not cache anything. Every page here is server-rendered
 * and time-sensitive — a cached timer or a cached streak would be a lie — so
 * this exists purely to own notifications, which on iOS can only be shown from
 * an installed app's worker.
 *
 * There is no push handler: nothing on the server wakes to send one. A session
 * end is announced by the page itself, while it is still alive.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
