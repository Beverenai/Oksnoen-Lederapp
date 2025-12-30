/**
 * Syncs Capacitor StatusBar style with the current theme
 */
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { isCapacitor } from '@/lib/capacitor';

export const useStatusBarTheme = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isCapacitor()) return;

    const updateStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        
        // Dark theme = light status bar text (white icons)
        // Light theme = dark status bar text (black icons)
        const style = resolvedTheme === 'dark' ? Style.Dark : Style.Light;
        
        await StatusBar.setStyle({ style });
        console.log('[StatusBar] Style updated for theme:', resolvedTheme, '→', style);
      } catch (err) {
        console.warn('[StatusBar] Failed to update style:', err);
      }
    };

    updateStatusBar();
  }, [resolvedTheme]);
};
