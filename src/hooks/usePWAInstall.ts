import { useState, useEffect, useCallback } from 'react';
import { isCapacitor, isNativeIOS, isNativeAndroid } from '@/lib/capacitor';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  // Early return for Capacitor native context - app IS installed
  const inCapacitor = isCapacitor();
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(inCapacitor);
  const [hasDeclined, setHasDeclined] = useState(false);

  const syncDeclinedFromStorage = useCallback(() => {
    setHasDeclined(!!localStorage.getItem('pwa-install-declined'));
  }, []);

  useEffect(() => {
    // Skip all PWA install logic in Capacitor native context
    if (inCapacitor) {
      return;
    }

    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);
    };

    checkInstalled();
    syncDeclinedFromStorage();

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    // Keep hook instances in sync (Install page + App router use the hook separately)
    const handleDeclinedEvent = () => {
      syncDeclinedFromStorage();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pwa-install-declined') {
        syncDeclinedFromStorage();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-install-declined', handleDeclinedEvent);
    window.addEventListener('storage', handleStorage);

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-install-declined', handleDeclinedEvent);
      window.removeEventListener('storage', handleStorage);
      mediaQuery.removeEventListener('change', checkInstalled);
    };
  }, [syncDeclinedFromStorage, inCapacitor]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || inCapacitor) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
      }

      setDeferredPrompt(null);
      setIsInstallable(false);

      return outcome === 'accepted';
    } catch (error) {
      console.error('Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt, inCapacitor]);

  const declineInstall = useCallback(() => {
    if (inCapacitor) return;
    localStorage.setItem('pwa-install-declined', 'true');
    setHasDeclined(true);
    // Notify other hook instances in the same tab (storage-event doesnt fire in same window)
    window.dispatchEvent(new Event('pwa-install-declined'));
  }, [inCapacitor]);

  const isIOS = inCapacitor ? isNativeIOS() : /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = inCapacitor ? isNativeAndroid() : /Android/.test(navigator.userAgent);

  return {
    isInstallable: inCapacitor ? false : isInstallable,
    isInstalled,
    hasDeclined: inCapacitor ? false : hasDeclined,
    promptInstall,
    declineInstall,
    isIOS,
    isAndroid,
  };
}
