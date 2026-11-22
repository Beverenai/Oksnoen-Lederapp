/**
 * iPhones innebygde QR-leser (AVFoundation) i stedet for JavaScript-leseren.
 * Kameraet vises bak nettsiden, som gjøres gjennomsiktig mens skanneren er åpen (klassen `native-scan` på <html>).
 * Kan slås av uten ny app-versjon: app_config «native_qr_scanner» = «false».
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeIOS } from './capacitor';
import { supabase } from '@/integrations/supabase/client';

interface NativeScannerPlugin {
  start(): Promise<{ torch: boolean }>;
  stop(): Promise<void>;
  setTorch(options: { on: boolean }): Promise<void>;
  addListener(event: 'code', handler: (data: { value: string }) => void): Promise<PluginListenerHandle>;
}

let plugin: NativeScannerPlugin | null = null;
let enabled: boolean | null = null;

const get = (): NativeScannerPlugin | null => {
  if (!isNativeIOS()) return null;
  if (!plugin) {
    try {
      plugin = registerPlugin<NativeScannerPlugin>('NativeScanner');
    } catch {
      plugin = null;
    }
  }
  return plugin;
};

/** Sant når appen kjører på iPhone, plugin-en finnes og bryteren ikke er slått av. */
export async function nativeScannerAvailable(): Promise<boolean> {
  // Finnes ikke plugin-en i denne app-versjonen, feiler start() og skanneren bruker web-kameraet.
  if (!isNativeIOS()) return false;
  if (enabled === null) {
    try {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'native_qr_scanner').maybeSingle();
      enabled = data?.value !== 'false';
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export async function startNativeScanner(onCode: (value: string) => void): Promise<{ torch: boolean; stop: () => Promise<void> }> {
  const p = get();
  if (!p) throw new Error('NativeScanner mangler');
  const handle = await p.addListener('code', (d) => onCode(d.value));
  try {
    const res = await p.start();
    document.documentElement.classList.add('native-scan');
    return {
      torch: !!res.torch,
      stop: async () => {
        document.documentElement.classList.remove('native-scan');
        await handle.remove().catch(() => undefined);
        await p.stop().catch(() => undefined);
      },
    };
  } catch (e) {
    await handle.remove().catch(() => undefined);
    document.documentElement.classList.remove('native-scan');
    throw e;
  }
}

export async function setNativeTorch(on: boolean): Promise<void> {
  await get()?.setTorch({ on });
}
