/**
 * Service Worker Registration for Web/PWA
 * Handles SW registration with update detection and user notification
 */

import { isCapacitor } from './capacitor';

let registration: ServiceWorkerRegistration | null = null;

const applyPendingUpdate = (): void => {
  if (registration?.waiting) {
    console.log('[SW] Applying waiting update immediately');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
};

/**
 * Register the service worker for web/PWA context only
 * Skips registration in Capacitor native context
 */
export const registerServiceWorker = async (): Promise<void> => {
  // Skip SW registration in Capacitor native context
  if (isCapacitor()) {
    console.log('[SW] Native context detected, skipping service worker registration');
    return;
  }

  // Skip in iframes (Lovable preview)
  try {
    if (window.self !== window.top) {
      console.log('[SW] Iframe detected, skipping service worker registration');
      // Unregister any existing SW in iframe context
      navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      return;
    }
  } catch { /* cross-origin — assume iframe */ return; }

  // Skip on preview hosts
  if (window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com')) {
    console.log('[SW] Preview host detected, skipping service worker registration');
    navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    return;
  }

  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return;
  }

  try {
    console.log('[SW] Registering service worker...');
    
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Service worker registered successfully');
    await registration.update();
    applyPendingUpdate();

    // Check for updates on registration
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      
      if (newWorker) {
        console.log('[SW] New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('[SW] New version available');
            applyPendingUpdate();
          }
        });
      }
    });

    window.addEventListener('focus', () => {
      registration?.update().catch((error) => {
        console.warn('[SW] Focus update check failed:', error);
      });
    });

    // Handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed, reloading page');
      window.location.reload();
    });

  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
};

/**
 * Show update notification to user
 */
/**
 * Check for service worker updates manually
 */
export const checkForUpdates = async (): Promise<boolean> => {
  if (!registration) {
    return false;
  }

  try {
    await registration.update();
    return !!registration.waiting;
  } catch (error) {
    console.error('[SW] Update check failed:', error);
    return false;
  }
};

/**
 * Get current service worker status
 */
export const getServiceWorkerStatus = (): {
  isSupported: boolean;
  isRegistered: boolean;
  hasUpdate: boolean;
  state: string | null;
} => {
  return {
    isSupported: 'serviceWorker' in navigator,
    isRegistered: !!registration,
    hasUpdate: !!registration?.waiting,
    state: registration?.active?.state ?? null,
  };
};
