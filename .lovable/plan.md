

## Fiks: Dødplass på høyre side, scroll på Ledere, og bytt Profil → Fix

### Problem 1: Dødplass på høyre side
Skjermbildet viser at innholdet ikke fyller hele bredden — det er en stripe med dødplass til høyre. Sannsynlig årsak: den globale CSS-regelen `max-width: 100%` på alle `div`-elementer (index.css linje 53-55) kan kollidere med menypanelet som ligger i DOM-en med `w-[80vw]`. Eller så er det `overflow: hidden` på `#root` som klipper feil.

**Endring i `index.css` (linje 53-55):**
- Fjern `div` fra den globale `max-width: 100%`-regelen (behold `html, body, #root, main, section, article, form`)
- `div` er for generisk og kan påvirke layout-beregninger uventet

**Endring i `AppLayout.tsx` (linje 800-804):**
- Legg til `w-full` på `<main>` for å sikre at den fyller hele tilgjengelig bredde
- Verifiser at `p-4` paddingen ikke skaper visuelt "dødplass"

### Problem 2: Scrolling fungerer ikke på Ledere
Leaders.tsx (linje 349) har `overflow-y-auto` på inner div, men `#root` har `overflow: hidden` og `<main>` i AppLayout har `overflow-x-hidden` uten eksplisitt `overflow-y-auto` for mobil.

**Endring i `AppLayout.tsx` (linje 803):**
- Legg til `overflow-y-auto` på `<main>` for mobil (den er allerede der for `lg:overflow-y-auto`)
- Fjern `overflow-y-auto` fra Leaders.tsx inner div (den skal arve scroll fra main)

**Endring i `Leaders.tsx` (linje 349):**
- Fjern `overflow-y-auto` fra den ytre div-en — scroll skal håndteres av `<main>` i AppLayout

### Problem 3: Bytt "Profil" → "Fix" i bunnav
Brukeren vil at Profil-fanen erstattes med Fix, siden Profil allerede er tilgjengelig via sidemenyen.

**Endring i `AppLayout.tsx` (linje 92-118):**
- I alle tre `getBottomNavItems`-variantene: bytt siste element fra `{ to: '/profile', icon: User, label: 'Profil' }` til `{ to: '/fix', icon: Wrench, label: 'Fix' }`
- `Wrench`-ikonet er allerede importert

### Filer som endres
- `src/components/layout/AppLayout.tsx` — bunnav Fix, main overflow-y-auto, w-full
- `src/index.css` — fjern `div` fra global max-width-regel
- `src/pages/Leaders.tsx` — fjern overflow-y-auto fra inner div

