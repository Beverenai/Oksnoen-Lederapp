/**
 * Capacitor Push Notifications wrapper
 * Falls back to web push if not in native context
 */

import { isCapacitor } from './capacitor';

// Dynamic import to avoid errors when plugin is not installed
let PushNotifications: any = null;

export const initCapacitorPush = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  
  try {
    const module = await import('@capacitor/push-notifications');
    PushNotifications = module.PushNotifications;
    console.log('[CapacitorPush] Plugin initialized');
    return true;
  } catch (e) {
    console.log('[CapacitorPush] Plugin not available:', e);
    return false;
  }
};

export const isNativePushAvailable = (): boolean => {
  return !!PushNotifications;
};

export const requestNativePushPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (!PushNotifications) return 'default';
  
  try {
    const result = await PushNotifications.requestPermissions();
    return result.receive === 'granted' ? 'granted' : 'denied';
  } catch (e) {
    console.error('[CapacitorPush] Permission request failed:', e);
    return 'denied';
  }
};

export const checkNativePushPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (!PushNotifications) return 'default';

  try {
    const result = await PushNotifications.checkPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'default';
  } catch (e) {
    console.error('[CapacitorPush] Permission check failed:', e);
    return 'default';
  }
};

export const registerNativePush = async (): Promise<string | null> => {
  if (!PushNotifications) return null;
  
  try {
    return new Promise((resolve) => {
      let didResolve = false;
      let registrationHandle: { remove?: () => Promise<void> } | null = null;
      let errorHandle: { remove?: () => Promise<void> } | null = null;

      const finish = async (token: string | null) => {
        if (didResolve) return;
        didResolve = true;
        clearTimeout(timeout);
        await registrationHandle?.remove?.();
        await errorHandle?.remove?.();
        resolve(token);
      };

      const timeout = setTimeout(() => {
        console.log('[CapacitorPush] Registration timeout');
        void finish(null);
      }, 20000);
      
      PushNotifications.addListener('registration', (token: { value: string }) => {
        console.log('[CapacitorPush] Registered with token:', token.value.substring(0, 20) + '...');
        void finish(token.value);
      }).then((handle: { remove?: () => Promise<void> }) => {
        registrationHandle = handle;
      }).catch((error: unknown) => {
        console.error('[CapacitorPush] Could not attach registration listener:', error);
        void finish(null);
      });
      
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[CapacitorPush] Registration error:', error);
        void finish(null);
      }).then((handle: { remove?: () => Promise<void> }) => {
        errorHandle = handle;
      }).catch((error: unknown) => {
        console.error('[CapacitorPush] Could not attach registration error listener:', error);
        void finish(null);
      });

      setTimeout(() => {
        if (!didResolve) {
          PushNotifications.register().catch((error: unknown) => {
            console.error('[CapacitorPush] Registration failed:', error);
            void finish(null);
          });
        }
      }, 0);
    });
  } catch (e) {
    console.error('[CapacitorPush] Registration failed:', e);
    return null;
  }
};

export const addNativePushListeners = (
  onNotification: (notification: any) => void,
  onAction: (action: any) => void
) => {
  if (!PushNotifications) return;
  
  PushNotifications.addListener('pushNotificationReceived', onNotification);
  PushNotifications.addListener('pushNotificationActionPerformed', onAction);
};

export const removeAllNativePushListeners = async () => {
  if (!PushNotifications) return;
  await PushNotifications.removeAllListeners();
};
