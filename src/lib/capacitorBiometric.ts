/**
 * Face ID / Touch ID wrapper (native iOS/Android only).
 * Stores the leader's phone + PIN in the Keychain, protected by biometrics.
 * Silently no-ops on web.
 */

import { isNative } from './capacitor';

const SERVER = 'oksnoen-lederapp-login';
const OPT_OUT_KEY = 'oksnoen_biometric_optout';

let plugin: any = null;

const getPlugin = async () => {
  if (!isNative()) return null;
  if (plugin) return plugin;
  try {
    const mod = await import('capacitor-native-biometric');
    plugin = mod.NativeBiometric;
    return plugin;
  } catch (e) {
    console.log('[Biometric] plugin not available', e);
    return null;
  }
};

export type BiometricKind = 'faceId' | 'touchId' | 'other';

export const getBiometricInfo = async (): Promise<{ available: boolean; kind: BiometricKind }> => {
  const p = await getPlugin();
  if (!p) return { available: false, kind: 'other' };
  try {
    const res = await p.isAvailable({ useFallback: false });
    if (!res?.isAvailable) return { available: false, kind: 'other' };
    // BiometryType: 1 = touchId, 2 = faceId (iOS)
    const kind: BiometricKind = res.biometryType === 2 ? 'faceId' : res.biometryType === 1 ? 'touchId' : 'other';
    return { available: true, kind };
  } catch {
    return { available: false, kind: 'other' };
  }
};

export const biometricLabel = (kind: BiometricKind) =>
  kind === 'faceId' ? 'Face ID' : kind === 'touchId' ? 'Touch ID' : 'biometri';

export const hasBiometricOptOut = () => localStorage.getItem(OPT_OUT_KEY) === '1';
export const setBiometricOptOut = (value: boolean) => {
  if (value) localStorage.setItem(OPT_OUT_KEY, '1');
  else localStorage.removeItem(OPT_OUT_KEY);
};

/** Saved credentials exist on this device? */
export const hasSavedBiometricLogin = async (): Promise<boolean> => {
  const p = await getPlugin();
  if (!p) return false;
  try {
    const creds = await p.getCredentials({ server: SERVER });
    return !!creds?.username && !!creds?.password;
  } catch {
    return false;
  }
};

/** Store phone + PIN behind biometrics. */
export const saveBiometricLogin = async (phone: string, pin: string): Promise<boolean> => {
  const p = await getPlugin();
  if (!p) return false;
  try {
    await p.setCredentials({ username: phone, password: pin, server: SERVER });
    setBiometricOptOut(false);
    return true;
  } catch (e) {
    console.log('[Biometric] could not save credentials', e);
    return false;
  }
};

export const clearBiometricLogin = async (): Promise<void> => {
  const p = await getPlugin();
  if (!p) return;
  try {
    await p.deleteCredentials({ server: SERVER });
  } catch {
    /* ignore */
  }
};

/**
 * Prompt Face ID and return the stored credentials on success.
 * Returns null if unavailable, cancelled or failed.
 */
export const biometricUnlock = async (
  reason = 'Logg inn i Øksnøen LederApp',
): Promise<{ phone: string; pin: string } | null> => {
  const p = await getPlugin();
  if (!p) return null;
  try {
    await p.verifyIdentity({
      reason,
      title: 'Øksnøen LederApp',
      subtitle: '',
      description: reason,
      useFallback: true,
      negativeButtonText: 'Bruk PIN',
    });
    const creds = await p.getCredentials({ server: SERVER });
    if (!creds?.username || !creds?.password) return null;
    return { phone: creds.username, pin: creds.password };
  } catch (e) {
    console.log('[Biometric] verify failed/cancelled', e);
    return null;
  }
};
