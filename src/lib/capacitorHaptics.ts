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

// To varsler rett etter hverandre (f.eks. en popup og en eksplisitt haptikk for
// samme handling) skal kjennes som ett. Varsel-haptikk innen 350 ms slås sammen.
let lastNotificationAt = 0;
const notificationAllowed = (): boolean => {
  const now = Date.now();
  if (now - lastNotificationAt < 350) return false;
  lastNotificationAt = now;
  return true;
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
  if (!Haptics || !notificationAllowed()) return;
  
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
  if (!Haptics || !notificationAllowed()) return;
  
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
  if (!Haptics || !notificationAllowed()) return;
  
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

/**
 * Gir haptikk på alle toast-meldinger (sonner) uten at hver side må huske det.
 * Kalles én gang ved oppstart.
 */
let toastPatched = false;
export const patchToastHaptics = async (): Promise<void> => {
  if (toastPatched) return;
  toastPatched = true;
  const { toast } = await import('sonner');
  const wrap = (key: 'success' | 'error' | 'warning', fire: () => Promise<void>) => {
    const original = toast[key].bind(toast);
    (toast as unknown as Record<string, unknown>)[key] = (...args: Parameters<typeof original>) => {
      void fire();
      return original(...args);
    };
  };
  wrap('success', hapticSuccess);
  wrap('error', hapticError);
  wrap('warning', hapticWarning);
};
