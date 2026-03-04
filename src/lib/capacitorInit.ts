/**
 * Capacitor plugin initialization
 * Initializes all Capacitor plugins with graceful fallbacks
 */

import { isCapacitor } from './capacitor';
import { initCapacitorPush } from './capacitorPush';
import { initCapacitorCamera } from './capacitorCamera';
import { initCapacitorHaptics } from './capacitorHaptics';
import { initWidgetBridge } from './capacitorWidget';

interface CapacitorInitResult {
  isNative: boolean;
  plugins: {
    push: boolean;
    camera: boolean;
    haptics: boolean;
    splashScreen: boolean;
    widget: boolean;
  };
}

let initResult: CapacitorInitResult | null = null;

/**
 * Initialize all Capacitor plugins
 * Safe to call multiple times - will only initialize once
 */
export const initCapacitorPlugins = async (): Promise<CapacitorInitResult> => {
  // Return cached result if already initialized
  if (initResult) {
    return initResult;
  }
  
  // Not in Capacitor context - skip initialization
  if (!isCapacitor()) {
    console.log('[Capacitor] Web context - skipping native plugin initialization');
    initResult = {
      isNative: false,
      plugins: {
        push: false,
        camera: false,
        haptics: false,
        splashScreen: false,
        widget: false,
      },
    };
    return initResult;
  }
  
  console.log('[Capacitor] Native context detected - initializing plugins...');
  
  // Hide native splash screen quickly to let React splash take over
  let splashScreen = false;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
    splashScreen = true;
    console.log('[Capacitor] Native SplashScreen hidden - React splash taking over');
  } catch (error) {
    console.log('[Capacitor] SplashScreen not available:', error);
  }
  
  // Initialize all plugins in parallel
  const [push, camera, haptics, widget] = await Promise.all([
    initCapacitorPush(),
    initCapacitorCamera(),
    initCapacitorHaptics(),
    initWidgetBridge(),
  ]);
  
  initResult = {
    isNative: true,
    plugins: {
      push,
      camera,
      haptics,
      splashScreen,
      widget,
    },
  };
  
  console.log('[Capacitor] Plugin initialization complete:', initResult.plugins);
  
  return initResult;
};

/**
 * Get current initialization status
 */
export const getCapacitorStatus = (): CapacitorInitResult | null => {
  return initResult;
};
