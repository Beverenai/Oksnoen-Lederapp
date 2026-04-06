

## PWA Standalone-fiks: Manifest og meta-tagger

### Nåværende status

**Det som allerede er riktig:**
- `index.html` har `viewport-fit=cover`, `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `mobile-web-app-capable=yes`
- Manifest i `vite.config.ts` har `display: "standalone"`, `start_url: "/"`, `scope: "/"`
- Service worker-registrering har korrekte iframe/preview-guards

**Det som er feil/mangler:**
1. **Ingen `<link rel="manifest">` i `index.html`** — vite-plugin-pwa skal injisere denne automatisk, men med `injectRegister: null` er det mulig den ikke kommer med. Vi bør legge den til eksplisitt for å være sikre.
2. **`background_color: "#ffffff"`** i manifest — skal matche appens bakgrunn. I dark mode er bakgrunnen `hsl(220, 25%, 8%)` som er ca. `#111827`. I light mode `hsl(220, 20%, 97%)` = `#f5f6f8`. Hvit (`#ffffff`) gir feil splash-farge.
3. **`theme_color: "#16a34a"` (grønn)** i både manifest og meta-tag — dette styrer statusbar-fargen. Med `black-translucent` status bar style bruker iOS egentlig appens bakgrunn, men theme_color bør likevel matche for konsistens.

### Plan

**Fil 1: `index.html`**
- Legg til `<link rel="manifest" href="/manifest.webmanifest" />` i `<head>` (eksplisitt, ikke stol på plugin-injeksjon)
- Endre `theme-color` meta-tag til å matche appens bakgrunn: `#f5f6f8` (light) — dette er det iOS bruker for system-UI

**Fil 2: `vite.config.ts`**
- Endre `background_color` fra `"#ffffff"` til `"#f5f6f8"` (matcher light mode bakgrunn)
- Endre `theme_color` til `"#f5f6f8"` for konsistens med meta-tag

### Viktig for brukeren
Etter endringene MÅ du:
1. Slett den gamle PWA-en fra hjemskjermen
2. Åpne appen i Safari på nytt
3. Trykk Del → Legg til på Hjem-skjerm
4. Åpne fra hjemskjerm-ikonet

iOS cacher PWA-innstillinger ved installasjon — endringer krever re-installasjon.

### Teknisk detalj
Manifest-linken injiseres normalt av vite-plugin-pwa, men med `injectRegister: null` og `strategies: "injectManifest"` kan denne mangle. En eksplisitt `<link rel="manifest">` er trygg — den overskriver ikke plugin-genereringen, den bare sikrer at linken alltid er der.

