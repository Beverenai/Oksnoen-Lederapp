import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isCapacitor } from "./lib/capacitor";
import { initCapacitorPlugins } from "./lib/capacitorInit";
import { registerServiceWorker } from "./lib/registerSW";
import { runStartupDiagnostics } from "./lib/startupDiagnostics";

// Run startup diagnostics for debugging
runStartupDiagnostics();

// Initialize Capacitor plugins if in native context
initCapacitorPlugins().then((result) => {
  if (result.isNative) {
    console.log('[Capacitor] Plugins ready:', result.plugins);
  }
});

// Configure StatusBar for native platforms only (dynamic import)
// Note: Style is set dynamically by useStatusBarTheme hook based on theme
if (isCapacitor()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setBackgroundColor({ color: '#00000000' });
    StatusBar.setStyle({ style: Style.Dark });
    console.log('[Capacitor] StatusBar configured: overlay + transparent + Dark style');
  }).catch((err) => {
    console.warn('[Capacitor] StatusBar not available:', err);
  });
}

// Register service worker for web/PWA only (not in Capacitor native)
registerServiceWorker();

// Tag <body> for standalone/native so CSS can target it
if (window.matchMedia('(display-mode: standalone)').matches || isCapacitor()) {
  document.body.classList.add('standalone-app');
}

createRoot(document.getElementById("root")!).render(<App />);
