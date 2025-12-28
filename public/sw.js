// Service Worker for Push Notifications - Oksnøen Leder App

// Handle push events
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = { title: "Oksnøen", body: "Ny melding" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.body = event.data.text();
    }
  }

  const title = data.title || "Oksnøen";
  const options = {
    body: data.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: {
      url: data.url || "/",
    },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: data.tag || "oksnoen-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if (url !== "/") {
            client.navigate(url);
          }
          return;
        }
      }
      // If no open window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event);
});

// Log activation
self.addEventListener("activate", (event) => {
  console.log("[SW] Service worker activated");
});

// Log installation
self.addEventListener("install", (event) => {
  console.log("[SW] Service worker installed");
  self.skipWaiting();
});
