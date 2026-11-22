/**
 * Bro til iOS: widgeter, live-visning på låseskjermen og tallmerket på app-ikonet.
 * Alt er trygt å kalle på web; der skjer ingenting.
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { isCapacitor } from './capacitor';

/** Det widgetene og live-visningen viser. Holdes lite: bare det lederen trenger på et blikk. */
export interface WidgetSnapshot {
  leaderName: string | null;
  /** «2. økt» eller null når ingen økt er aktiv. */
  sessionLabel: string | null;
  currentActivity: string | null;
  extraActivity: string | null;
  obsMessage: string | null;
  /** Felles påminnelse for økta fra leirsjefen. */
  sessionReminder: string | null;
  cabins: string[];
  tasks: { kind: 'fix' | 'tau' | 'deltaker'; title: string }[];
  unread: number;
  /** Sant når oppdraget er ferskt nok til å vises som live-visning på låseskjermen. */
  live: boolean;
}

interface WidgetBridgePlugin {
  updateWidgetData(data: {
    currentActivity: string | null;
    extraActivity: string | null;
    obsMessage: string | null;
  }): Promise<void>;
  setSnapshot(data: { json: string }): Promise<void>;
  setBadge(data: { count: number }): Promise<void>;
  syncLiveActivity(data: {
    activity: string;
    sessionLabel: string;
    extra: string;
    obs: string;
    leaderName: string;
  }): Promise<{ active: boolean }>;
  endLiveActivity(): Promise<void>;
  reloadWidgets(): Promise<void>;
  addListener(event: 'liveActivityToken', fn: (data: { token: string }) => void): Promise<PluginListenerHandle>;
}

// Push-nøkkelen til live-visningen lagres på serveren, så den kan oppdateres når appen er lukket.
let tokenListener: Promise<PluginListenerHandle> | null = null;
let lastToken: string | null = null;
const saveLiveActivityToken = async (token: string | null) => {
  if (token && token === lastToken) return;
  lastToken = token;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('set_live_activity_token', { _token: token ?? '' });
  if (error) console.log('[WidgetBridge] kunne ikke lagre nøkkel for live-visning:', error.message);
};
const listenForLiveActivityToken = (b: WidgetBridgePlugin) => {
  if (tokenListener) return;
  tokenListener = b.addListener('liveActivityToken', ({ token }) => void saveLiveActivityToken(token));
};

let WidgetBridge: WidgetBridgePlugin | null = null;

export const initWidgetBridge = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  try {
    WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
    listenForLiveActivityToken(WidgetBridge);
    return true;
  } catch (e) {
    console.log('[WidgetBridge] Plugin not available:', e);
    return false;
  }
};

const bridge = (): WidgetBridgePlugin | null => {
  if (WidgetBridge) return WidgetBridge;
  if (!isCapacitor()) return null;
  try {
    WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
  } catch {
    WidgetBridge = null;
  }
  return WidgetBridge;
};

/** Eldre kall, beholdt for bakoverkompatibilitet. */
export const updateWidgetData = async (data: {
  currentActivity: string | null;
  extraActivity: string | null;
  obsMessage: string | null;
}): Promise<void> => {
  try {
    await bridge()?.updateWidgetData(data);
  } catch (e) {
    console.error('[WidgetBridge] updateWidgetData feilet:', e);
  }
};

/** Sender hele øyeblikksbildet til widgetene og holder live-visningen i takt. */
export const syncNativeSurfaces = async (snapshot: WidgetSnapshot): Promise<void> => {
  const b = bridge();
  if (!b) return;
  listenForLiveActivityToken(b);
  try {
    await b.setSnapshot({ json: JSON.stringify(snapshot) });
  } catch (e) {
    console.error('[WidgetBridge] setSnapshot feilet:', e);
  }
  try {
    const activity = (snapshot.currentActivity ?? '').trim();
    if (activity && snapshot.live) {
      await b.syncLiveActivity({
        activity,
        sessionLabel: snapshot.sessionLabel ?? '',
        extra: snapshot.extraActivity ?? '',
        obs: snapshot.obsMessage ?? snapshot.sessionReminder ?? '',
        leaderName: snapshot.leaderName ?? '',
      });
    } else {
      await b.endLiveActivity();
    }
  } catch (e) {
    // Live-visning kan være slått av i Innstillinger. Det er ikke en feil.
    console.log('[WidgetBridge] live-visning ikke oppdatert:', e);
  }
};

/** Tømmer widgetene og avslutter live-visningen (brukes ved utlogging). */
export const clearNativeSurfaces = async (): Promise<void> => {
  const b = bridge();
  if (!b) return;
  await saveLiveActivityToken(null).catch(() => undefined);
  try {
    await b.setSnapshot({ json: '' });
    await b.endLiveActivity();
    await b.setBadge({ count: 0 });
  } catch {
    // ignorer
  }
};

export const setNativeBadge = async (count: number): Promise<void> => {
  try {
    await bridge()?.setBadge({ count: Math.max(0, Math.floor(count)) });
  } catch {
    // ignorer
  }
};

export const reloadWidgets = async (): Promise<void> => {
  try {
    await bridge()?.reloadWidgets();
  } catch (e) {
    console.error('[WidgetBridge] reloadWidgets feilet:', e);
  }
};
