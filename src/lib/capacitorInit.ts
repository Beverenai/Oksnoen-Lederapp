/**
 * Capacitor plugin initialization
 * Initializes all Capacitor plugins with graceful fallbacks
 */

import { isCapacitor } from './capacitor';
import { initCapacitorPush } from './capacitorPush';
import { initCapacitorCamera } from './capacitorCamera';
import { initCapacitorHaptics } from './capacitorHaptics';

interface CapacitorInitResult {
  isNative: boolean;
  plugins: {
    push: boolean;
    camera: boolean;
    haptics: boolean;
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
      },
    };
    return initResult;
  }
  
  console.log('[Capacitor] Native context detected - initializing plugins...');
  
  // Initialize all plugins in parallel
  const [push, camera, haptics] = await Promise.all([
    initCapacitorPush(),
    initCapacitorCamera(),
    initCapacitorHaptics(),
  ]);
  
  initResult = {
    isNative: true,
    plugins: {
      push,
      camera,
      haptics,
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
