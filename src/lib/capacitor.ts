/**
 * Capacitor detection utilities
 * Used to detect if the app is running in a native Capacitor shell
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

/**
 * Check if the app is running inside a Capacitor native shell
 */
export const isCapacitor = (): boolean => {
  return !!window.Capacitor?.isNativePlatform?.();
};

/**
 * Check if running as a native iOS app
 */
export const isNativeIOS = (): boolean => {
  return isCapacitor() && window.Capacitor?.getPlatform?.() === 'ios';
};

/**
 * Check if running as a native Android app
 */
export const isNativeAndroid = (): boolean => {
  return isCapacitor() && window.Capacitor?.getPlatform?.() === 'android';
};

/**
 * Check if running in any native context (iOS or Android)
 */
export const isNative = (): boolean => {
  return isCapacitor();
};
