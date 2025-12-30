import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isCapacitor } from "./lib/capacitor";

// Disable PWA service worker registration in Capacitor native context
// The native app handles offline/caching differently
if (!isCapacitor() && 'serviceWorker' in navigator) {
  // Service worker will be registered by VitePWA plugin for web only
  console.log('[PWA] Web context detected, service worker enabled');
} else if (isCapacitor()) {
  console.log('[Capacitor] Native context detected, skipping service worker');
}

createRoot(document.getElementById("root")!).render(<App />);
