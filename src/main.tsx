import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { isCapacitor } from "./lib/capacitor";
import { initCapacitorPlugins } from "./lib/capacitorInit";

// Initialize Capacitor plugins if in native context
initCapacitorPlugins().then((result) => {
  if (result.isNative) {
    console.log('[Capacitor] Plugins ready:', result.plugins);
  }
});

// Configure StatusBar for native platforms only
if (Capacitor.isNativePlatform()) {
import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setStyle({ style: Style.Light });
    console.log('[Capacitor] StatusBar configured');
  }).catch((err) => {
    console.warn('[Capacitor] StatusBar not available:', err);
  });
}

// Disable PWA service worker registration in Capacitor native context
// The native app handles offline/caching differently
if (!isCapacitor() && 'serviceWorker' in navigator) {
  // Service worker will be registered by VitePWA plugin for web only
  console.log('[PWA] Web context detected, service worker enabled');
} else if (isCapacitor()) {
  console.log('[Capacitor] Native context detected, skipping service worker');
}

createRoot(document.getElementById("root")!).render(<App />);
