/**
 * Capacitor Widget Bridge
 * Writes leader content to shared UserDefaults for WidgetKit
 * and triggers widget timeline reload
 */

import { registerPlugin } from '@capacitor/core';
import { isCapacitor } from './capacitor';

interface WidgetBridgePlugin {
  updateWidgetData(options: {
    currentActivity: string | null;
    extraActivity: string | null;
    obsMessage: string | null;
  }): Promise<void>;
  reloadWidgets(): Promise<void>;
}

let WidgetBridge: WidgetBridgePlugin | null = null;

export const initWidgetBridge = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;

  try {
    WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
    console.log('[WidgetBridge] Plugin initialized');
    return true;
  } catch (e) {
    console.log('[WidgetBridge] Plugin not available:', e);
    return false;
  }
};

export const updateWidgetData = async (data: {
  currentActivity: string | null;
  extraActivity: string | null;
  obsMessage: string | null;
}): Promise<void> => {
  if (!WidgetBridge) return;
  try {
    await WidgetBridge.updateWidgetData(data);
  } catch (e) {
    console.error('[WidgetBridge] Failed to update widget data:', e);
  }
};

export const reloadWidgets = async (): Promise<void> => {
  if (!WidgetBridge) return;
  try {
    await WidgetBridge.reloadWidgets();
  } catch (e) {
    console.error('[WidgetBridge] Failed to reload widgets:', e);
  }
};
