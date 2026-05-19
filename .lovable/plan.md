# Fiks bunnmenyen i iOS PWA

## Diagnose

Du har helt rett i analysen. To ting er allerede på plass:

- `viewport-fit=cover` ✅ (linje 5 i `index.html`)
- `.bottom-nav-fixed` har `padding-bottom: calc(8px + var(--pwa-safe-bottom, env(safe-area-inset-bottom, 34px)))` ✅
- JS-probe i `AppLayout.tsx` setter `--pwa-safe-bottom` dynamisk for iOS 26-bugen ✅

**Det som mangler — og som forklarer "menyen skjules under skjermkanten":**

`index.html` peker på `<link rel="manifest" href="/manifest.webmanifest" />`, men **filen finnes ikke** i `public/`. Resultat:

- iOS PWA installeres uten manifest-`background_color` → faller tilbake til hvit/transparent
- Området under bunnmenyen (safe-area) viser PWA-vinduets bakgrunn — ikke menyen din
- Det ser ut som menyen er klippet av, men det er egentlig en hvit/lys stripe under menyens mørke flate

Dette stemmer 100% med rådet ditt: *"the gap is actually the background of the PWA window showing through"*.

## Endringer

### 1. Ny fil: `public/manifest.webmanifest`

Lager manifest med:
- `name`, `short_name`: "Øksnøen Leder", "Øksnøen"
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `orientation`: `portrait`
- `background_color`: `#0a0f1c` (matcher `<meta name="theme-color">` og mørk bakgrunn — ingen synlig stripe)
- `theme_color`: `#0a0f1c`
- `icons`: alle eksisterende `pwa-*.png` (72→512) + `app-icon-1024.png` som `maskable`

### 2. `index.html` (mindre justering)

Bekrefte at `<meta name="theme-color">` er `#0a0f1c` (allerede tilfellet). Ingen kode-endring nødvendig der.

### 3. Ingenting i `src/index.css` eller `AppLayout.tsx`

Eksisterende safe-area-logikk er korrekt. Problemet er ikke i CSS-en — det er PWA-vinduets background_color som lekker gjennom.

## Viktig for deg etter deploy

iOS cacher manifest **ved installasjon**. Eksisterende installerte PWA-er fortsetter å vise hvit stripe selv etter ny deploy. For at fiksen skal vises må du:

1. Slett appen fra hjemskjermen
2. Åpne `app.oksnoen.com` i Safari på nytt
3. Del → "Legg til på Hjem-skjerm"

Etter reinstall blir safe-area-området under menyen mørkt og menyen ser sammenhengende ut.

## Teknisk note

Vi bruker `.webmanifest`-endelsen fordi `index.html` allerede refererer til den. Alternativt kunne vi byttet både filnavn og lenke til `manifest.json`, men det er unødvendig — `.webmanifest` er den offisielle MIME-typen (`application/manifest+json`).
