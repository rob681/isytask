// Service Worker for Push Notifications — Isytask
// v2: unique tags per task, action buttons, full URL navigation

self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const taskId = data.taskId || null;

    const options = {
      body: data.body || "",
      icon: data.icon || "/isytask-icon.svg",
      badge: data.badge || "/isytask-icon.svg",
      data: {
        url: data.url || "/",
        taskId,
      },
      vibrate: [200, 100, 200],
      // Unique tag per task so notifications stack; falls back to generic tag
      tag: taskId ? `isytask-task-${taskId}` : "isytask-notification",
      renotify: true,
      actions: [
        { action: "view", title: "Ver tarea" },
        { action: "dismiss", title: "Cerrar" },
      ],
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

  // Dismiss action — just close
  if (event.action === "dismiss") return;

  const notifData = event.notification.data || {};
  const path = notifData.url || "/";
  // Build absolute URL so clients.openWindow works correctly
  const fullUrl = path.startsWith("http") ? path : self.location.origin + path;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Reuse an existing Isytask tab if one is open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(fullUrl);
            return;
          }
        }
        // No open tab — open a new one
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
