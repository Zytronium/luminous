// public/sw.js: Luminous Web Push service worker
// Receives push events from the server and shows notifications when the app
// is backgrounded or closed. Handles notification clicks to focus/navigate.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    console.error("[SW] Failed to parse push payload", event.data.text());
    return;
  }

  const { title, body, channelId, messageId } = payload;

  // If any app window is currently visible and focused, suppress the SW
  // notification, the in-app notification (sound + badge) is sufficient.
  // This also covers the case where Electron is open: Electron registers as
  // a client, so a focused Electron window will suppress the browser SW notif.
  const showNotification = clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      const appIsVisible = windowClients.some((c) => c.focused);
      if (appIsVisible) return; // app is open and focused: skip

      return self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",  // update path to match your actual icon
        badge: "/icons/badge-72.png", // update path to match your actual badge
        data: { channelId, messageId },
        // Keep the notification alive until the user interacts with it
        requireInteraction: false,
      });
    });

  event.waitUntil(showNotification);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { channelId, messageId } = event.notification.data ?? {};
  const url = `/chat?channel=${channelId}&message=${messageId}`;

  const focusOrOpen = clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      // If a tab is already open, focus it and navigate.
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.focus().then((c) => c.navigate(url));
        }
      }
      // No tab open: open a new one.
      return clients.openWindow(url);
    });

  event.waitUntil(focusOrOpen);
});
