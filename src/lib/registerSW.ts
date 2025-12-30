/**
 * Service Worker Registration for Web/PWA
 * Handles SW registration with update detection and user notification
 */

import { isCapacitor } from './capacitor';

let registration: ServiceWorkerRegistration | null = null;

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

    // Check for updates on registration
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      
      if (newWorker) {
        console.log('[SW] New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('[SW] New version available');
            showUpdateNotification();
          }
        });
      }
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
const showUpdateNotification = (): void => {
  // Check if we already have an update banner
  if (document.getElementById('sw-update-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 90vw;
  `;

  banner.innerHTML = `
    <span>Ny versjon tilgjengelig!</span>
    <button id="sw-update-btn" style="
      background: hsl(var(--primary-foreground));
      color: hsl(var(--primary));
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
    ">Oppdater</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    applyUpdate();
    banner.remove();
  });
};

/**
 * Apply pending service worker update
 */
const applyUpdate = (): void => {
  if (registration?.waiting) {
    // Tell waiting SW to skip waiting and take over
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    // Fallback: just reload
    window.location.reload();
  }
};

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
