/**
 * Service Worker diagnostics helper
 * Call from console: await window.logSwDiagnostics()
 */
export async function logSwDiagnostics(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW Diagnostics] Service Worker not supported');
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  console.log('[SW Diagnostics] Number of registrations:', registrations.length);

  registrations.forEach((reg, index) => {
    console.log(`[SW Diagnostics] Registration ${index}:`, {
      scope: reg.scope,
      active: reg.active?.scriptURL,
      installing: reg.installing?.scriptURL,
      waiting: reg.waiting?.scriptURL,
    });
  });

  // Check for push subscription
  if (registrations.length > 0) {
    try {
      const subscription = await registrations[0].pushManager.getSubscription();
      console.log('[SW Diagnostics] Push subscription:', subscription ? 'Active' : 'None');
      if (subscription) {
        console.log('[SW Diagnostics] Subscription endpoint:', subscription.endpoint);
      }
    } catch (e) {
      console.log('[SW Diagnostics] Could not check push subscription:', e);
    }
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as unknown as { logSwDiagnostics: typeof logSwDiagnostics }).logSwDiagnostics = logSwDiagnostics;
}
