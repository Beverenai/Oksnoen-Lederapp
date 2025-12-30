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

export const registerNativePush = async (): Promise<string | null> => {
  if (!PushNotifications) return null;
  
  try {
    await PushNotifications.register();
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[CapacitorPush] Registration timeout');
        resolve(null);
      }, 10000);
      
      PushNotifications.addListener('registration', (token: { value: string }) => {
        clearTimeout(timeout);
        console.log('[CapacitorPush] Registered with token:', token.value.substring(0, 20) + '...');
        resolve(token.value);
      });
      
      PushNotifications.addListener('registrationError', (error: any) => {
        clearTimeout(timeout);
        console.error('[CapacitorPush] Registration error:', error);
        resolve(null);
      });
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
