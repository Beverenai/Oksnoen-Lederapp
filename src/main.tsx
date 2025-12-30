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
if (isCapacitor()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setStyle({ style: Style.Light });
    console.log('[Capacitor] StatusBar configured');
  }).catch((err) => {
    console.warn('[Capacitor] StatusBar not available:', err);
  });
}

// Register service worker for web/PWA only (not in Capacitor native)
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
