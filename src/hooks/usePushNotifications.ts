import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  isSyncing: boolean;
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

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function usePushNotifications() {
  const { leader } = useAuth();
  const hasSyncedRef = useRef(false);
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    isLoading: true,
    isSyncing: false,
    permission: 'default',
    error: null,
  });

  // Extract subscription keys robustly (handles iOS/Safari edge cases)
  const extractSubscriptionKeys = useCallback((subscription: PushSubscription): { p256dh: string; auth: string } | null => {
    // Try toJSON() first
    const json = subscription.toJSON();
    if (json.keys?.p256dh && json.keys?.auth) {
      console.log('Keys extracted from toJSON()');
      return { p256dh: json.keys.p256dh, auth: json.keys.auth };
    }

    // Fallback: use getKey() method for iOS/Safari
    console.log('Falling back to getKey() method');
    try {
      const p256dhBuffer = subscription.getKey('p256dh');
      const authBuffer = subscription.getKey('auth');
      
      if (p256dhBuffer && authBuffer) {
        const p256dh = arrayBufferToBase64(p256dhBuffer);
        const auth = arrayBufferToBase64(authBuffer);
        console.log('Keys extracted from getKey()');
        return { p256dh, auth };
      }
    } catch (e) {
      console.error('Error extracting keys with getKey():', e);
    }

    console.error('Could not extract subscription keys');
    return null;
  }, []);

  // Sync existing subscription to backend (auto-resync on mount/leader change)
  const syncExistingSubscription = useCallback(async (): Promise<boolean> => {
    if (!leader?.id) {
      console.log('No leader, skipping sync');
      return false;
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      console.log('Permission not granted, skipping sync');
      return false;
    }

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.log('No service worker registration found');
        setState(prev => ({ ...prev, isSyncing: false }));
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('No existing subscription to sync');
        setState(prev => ({ ...prev, isSyncing: false, isEnabled: false }));
        return false;
      }

      // Extract keys robustly
      const keys = extractSubscriptionKeys(subscription);
      if (!keys) {
        console.error('Failed to extract subscription keys during sync');
        setState(prev => ({ ...prev, isSyncing: false, error: 'Kunne ikke lese varslingsnøkler' }));
        return false;
      }

      console.log('Syncing subscription to backend for leader:', leader.id);

      // Sync to backend
      const { error: syncError } = await supabase.functions.invoke('push-subscribe', {
        body: {
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          leader_id: leader.id,
        },
      });

      if (syncError) {
        console.error('Error syncing subscription:', syncError);
        setState(prev => ({ ...prev, isSyncing: false, error: 'Kunne ikke synkronisere abonnement' }));
        return false;
      }

      console.log('Subscription synced successfully');
      setState(prev => ({ ...prev, isSyncing: false, isEnabled: true, error: null }));
      return true;
    } catch (error) {
      console.error('Error in syncExistingSubscription:', error);
      setState(prev => ({ ...prev, isSyncing: false, error: 'En feil oppstod ved synkronisering' }));
      return false;
    }
  }, [leader?.id, extractSubscriptionKeys]);

  // Check if push notifications are supported and auto-sync
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
          const registration = await navigator.serviceWorker.ready;
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
        isSyncing: false,
        permission,
        error: null,
      });
    };

    checkSupport();
  }, []);

  // Auto-sync when leader becomes available and permission is granted
  useEffect(() => {
    if (
      leader?.id &&
      state.isSupported &&
      !state.isLoading &&
      state.permission === 'granted' &&
      !hasSyncedRef.current
    ) {
      hasSyncedRef.current = true;
      syncExistingSubscription();
    }
  }, [leader?.id, state.isSupported, state.isLoading, state.permission, syncExistingSubscription]);

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (!leader) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Du må være logget inn for å aktivere varsler',
      }));
      return false;
    }

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

      // Use the VitePWA-registered service worker
      const registration = await navigator.serviceWorker.ready;

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

      // Extract keys robustly (handles iOS/Safari)
      const keys = extractSubscriptionKeys(subscription);
      if (!keys) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Kunne ikke lese varslingsnøkler fra nettleseren',
        }));
        return false;
      }

      // Send subscription to backend with leader_id
      const { error: subscribeError } = await supabase.functions.invoke('push-subscribe', {
        body: {
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          leader_id: leader.id,
        },
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
  }, [leader, extractSubscriptionKeys]);

  // Re-sync function for retry button
  const retrySync = useCallback(async (): Promise<boolean> => {
    hasSyncedRef.current = false;
    return syncExistingSubscription();
  }, [syncExistingSubscription]);

  return {
    ...state,
    enablePushNotifications,
    retrySync,
    syncExistingSubscription,
  };
}
