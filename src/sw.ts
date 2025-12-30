/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
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

// Clean up old caches on activation
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Keep workbox precache and our named caches
            const keepCaches = [
              'participant-images-cache',
              'fix-images-cache',
              'js-runtime-cache',
            ];
            return !name.startsWith('workbox-precache') && !keepCaches.includes(name);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
});

// Listen for skipWaiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// === SPA NAVIGATION FALLBACK ===
// This ensures that all navigation requests return index.html for client-side routing
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  // Don't handle API routes or direct file requests
  denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
});
registerRoute(navigationRoute);

// === JS CHUNKS - NETWORK FIRST ===
// Ensure we always get fresh JS chunks after deployments
registerRoute(
  ({ request }) => request.destination === 'script',
  new NetworkFirst({
    cacheName: 'js-runtime-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

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
