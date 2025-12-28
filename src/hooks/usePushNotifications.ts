import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
  error: string | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    isLoading: true,
    permission: 'default',
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!isSupported) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
        }));
        return;
      }

      const permission = Notification.permission;

      // Check if there's an active subscription
      let isEnabled = false;
      if (permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.getRegistration('/sw.js');
          if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            isEnabled = !!subscription;
          }
        } catch (e) {
          console.error('Error checking subscription:', e);
        }
      }

      setState({
        isSupported: true,
        isEnabled,
        isLoading: false,
        permission,
        error: null,
      });
    };

    checkSupport();
  }, []);

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Varslingstillatelse ble avslått',
        }));
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
        'push-vapid-key'
      );

      if (vapidError || !vapidData?.publicKey) {
        console.error('Error getting VAPID key:', vapidError);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: vapidData?.configured === false 
            ? 'Push-varsler er ikke konfigurert ennå' 
            : 'Kunne ikke hente VAPID-nøkkel',
        }));
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to backend
      const { error: subscribeError } = await supabase.functions.invoke('push-subscribe', {
        body: subscription.toJSON(),
      });

      if (subscribeError) {
        console.error('Error saving subscription:', subscribeError);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Kunne ikke lagre abonnement',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isEnabled: true,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'En feil oppstod ved aktivering av varsler',
      }));
      return false;
    }
  }, []);

  const disablePushNotifications = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        setState((prev) => ({ ...prev, isLoading: false, isEnabled: false }));
        return true;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState((prev) => ({ ...prev, isLoading: false, isEnabled: false }));
        return true;
      }

      // Unsubscribe from push
      await subscription.unsubscribe();

      // Remove subscription from backend
      await supabase.functions.invoke('push-unsubscribe', {
        body: { endpoint: subscription.endpoint },
      });

      setState((prev) => ({
        ...prev,
        isEnabled: false,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'En feil oppstod ved deaktivering av varsler',
      }));
      return false;
    }
  }, []);

  const togglePushNotifications = useCallback(async (): Promise<boolean> => {
    if (state.isEnabled) {
      return disablePushNotifications();
    } else {
      return enablePushNotifications();
    }
  }, [state.isEnabled, enablePushNotifications, disablePushNotifications]);

  return {
    ...state,
    enablePushNotifications,
    disablePushNotifications,
    togglePushNotifications,
  };
}
