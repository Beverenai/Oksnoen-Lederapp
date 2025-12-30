/**
 * Startup diagnostics for debugging white-screen and loading issues
 * Logs critical information about the app environment on startup
 */

import { isCapacitor, isNativeIOS, isNativeAndroid } from './capacitor';

export const runStartupDiagnostics = (): void => {
  console.group('[Startup Diagnostics]');
  
  // Platform detection
  console.log('Platform:', {
    isCapacitor: isCapacitor(),
    isNativeIOS: isNativeIOS(),
    isNativeAndroid: isNativeAndroid(),
    userAgent: navigator.userAgent,
    standalone: (window.navigator as Navigator & { standalone?: boolean }).standalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
  });

  // Service worker status
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      console.log('Service Worker:', {
        supported: true,
        registered: !!reg,
        scope: reg?.scope,
        state: reg?.active?.state,
        waiting: !!reg?.waiting,
        installing: !!reg?.installing,
      });
    }).catch((err) => {
      console.log('Service Worker: Error checking registration', err);
    });
  } else {
    console.log('Service Worker: Not supported');
  }

  // Cache status
  if ('caches' in window) {
    caches.keys().then((keys) => {
      console.log('Cache Storage:', {
        supported: true,
        caches: keys,
        count: keys.length,
      });
    }).catch((err) => {
      console.log('Cache Storage: Error checking caches', err);
    });
  } else {
    console.log('Cache Storage: Not supported');
  }

  // Network status
  console.log('Network:', {
    online: navigator.onLine,
    connection: (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection?.effectiveType,
  });

  // Storage info
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then((estimate) => {
      console.log('Storage:', {
        quota: `${((estimate.quota || 0) / 1024 / 1024).toFixed(2)} MB`,
        usage: `${((estimate.usage || 0) / 1024 / 1024).toFixed(2)} MB`,
        percent: `${(((estimate.usage || 0) / (estimate.quota || 1)) * 100).toFixed(1)}%`,
      });
    }).catch((err) => {
      console.log('Storage: Error estimating', err);
    });
  }

  // URL info
  console.log('URL:', {
    href: window.location.href,
    pathname: window.location.pathname,
    origin: window.location.origin,
  });

  // Timing
  if (performance && performance.timing) {
    const timing = performance.timing;
    console.log('Timing:', {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      load: timing.loadEventEnd - timing.navigationStart,
    });
  }

  console.groupEnd();
};

/**
 * Log an error with context for debugging
 */
export const logDiagnosticError = (context: string, error: unknown): void => {
  console.error(`[Diagnostic Error] ${context}:`, {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    online: navigator.onLine,
  });
};
