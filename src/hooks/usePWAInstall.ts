import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasDeclined, setHasDeclined] = useState(false);

  const syncDeclinedFromStorage = useCallback(() => {
    setHasDeclined(!!localStorage.getItem('pwa-install-declined'));
  }, []);

  useEffect(() => {
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
  }, [syncDeclinedFromStorage]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

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
  }, [deferredPrompt]);

  const declineInstall = useCallback(() => {
    localStorage.setItem('pwa-install-declined', 'true');
    setHasDeclined(true);
    // Notify other hook instances in the same tab (storage-event doesnt fire in same window)
    window.dispatchEvent(new Event('pwa-install-declined'));
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return {
    isInstallable,
    isInstalled,
    hasDeclined,
    promptInstall,
    declineInstall,
    isIOS,
    isAndroid,
  };
}
