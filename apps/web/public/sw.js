// Service Worker for Push Notifications — Isytask

self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: data.icon || "/isytask-icon.svg",
      badge: data.badge || "/isytask-icon.svg",
      data: {
        url: data.url || "/",
      },
      vibrate: [200, 100, 200],
      tag: "isytask-notification",
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Isytask", options)
    );
  } catch (e) {
    console.error("[SW] Error processing push:", e);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // If there's already an Isytask tab open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
