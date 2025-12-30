/**
 * Capacitor Haptics wrapper
 * Silently no-ops if not in native context or plugin unavailable
 */

import { isCapacitor } from './capacitor';

// Dynamic import to avoid errors when plugin is not installed
let Haptics: any = null;
let ImpactStyle: any = null;
let NotificationType: any = null;

export const initCapacitorHaptics = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  
  try {
    const module = await import('@capacitor/haptics');
    Haptics = module.Haptics;
    ImpactStyle = module.ImpactStyle;
    NotificationType = module.NotificationType;
    console.log('[CapacitorHaptics] Plugin initialized');
    return true;
  } catch (e) {
    console.log('[CapacitorHaptics] Plugin not available:', e);
    return false;
  }
};

export const isHapticsAvailable = (): boolean => {
  return !!Haptics;
};

/**
 * Trigger impact haptic feedback
 * @param style - 'light' | 'medium' | 'heavy' (default: 'medium')
 */
export const hapticImpact = async (style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> => {
  if (!Haptics) return;
  
  try {
    const styleMap: Record<string, any> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styleMap[style] });
  } catch (e) {
    // Silently fail - haptics are not critical
  }
};

/**
 * Trigger success notification haptic
 */
export const hapticSuccess = async (): Promise<void> => {
  if (!Haptics) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger warning notification haptic
 */
export const hapticWarning = async (): Promise<void> => {
  if (!Haptics) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger error notification haptic
 */
export const hapticError = async (): Promise<void> => {
  if (!Haptics) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger selection changed haptic (light tap)
 */
export const hapticSelection = async (): Promise<void> => {
  if (!Haptics) return;
  
  try {
    await Haptics.selectionChanged();
  } catch (e) {
    // Silently fail
  }
};

/**
 * Trigger vibration for specified duration
 * @param duration - milliseconds (default: 300)
 */
export const hapticVibrate = async (duration: number = 300): Promise<void> => {
  if (!Haptics) return;
  
  try {
    await Haptics.vibrate({ duration });
  } catch (e) {
    // Silently fail
  }
};
