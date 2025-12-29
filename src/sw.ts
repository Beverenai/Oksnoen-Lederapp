/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching - injects manifest at build time
precacheAndRoute(self.__WB_MANIFEST);

// Claim clients immediately
clientsClaim();

// Skip waiting to activate immediately
self.addEventListener('install', () => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Service worker activated');
});

// === IMAGE CACHING ===

// Cache participant images from Supabase Storage for 7 days
registerRoute(
  ({ url }) => 
    url.hostname.includes('supabase.co') && 
    url.pathname.includes('/storage/v1/object/public/participant-images'),
  new CacheFirst({
    cacheName: 'participant-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500, // Max 500 images
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache fix-images as well
registerRoute(
  ({ url }) => 
    url.hostname.includes('supabase.co') && 
    url.pathname.includes('/storage/v1/object/public/fix-images'),
  new CacheFirst({
    cacheName: 'fix-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// === PUSH NOTIFICATION HANDLERS ===

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push received:', event);

  let data: PushData = { title: 'Oksnøen', body: 'Ny melding' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const title = data.title || 'Oksnøen';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: data.tag || 'oksnoen-notification',
  };

  event.waitUntil(self.registration.showNotification(title, options as NotificationOptions));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          (client as WindowClient).focus();
          if (url !== '/') {
            (client as WindowClient).navigate(url);
          }
          return;
        }
      }
      // If no open window, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[SW] Notification closed:', event);
});
