## Plan

Jeg legger inn en ren diagnosepakke i appen, uten å forsøke flere scroll/safe-area-fikser ennå.

### 1. Midlertidig debugpanel på Hjem
- Lage en liten debug-komponent som bare vises når:
  - appen kjører i development, eller
  - URL har `?debug=1`
- Rendre den på `Hjem`-siden som en `fixed` overlay øverst til venstre.
- Panelet oppdaterer seg ved initial render, `resize`, og `visualViewport.resize` der det finnes.
- Det viser nøyaktig disse feltene i sanntid:
  - `window.innerHeight`
  - `window.innerWidth`
  - `document.documentElement.clientHeight`
  - `document.body.clientHeight`
  - `window.visualViewport?.height`
  - `window.matchMedia('(display-mode: standalone)').matches`
  - `navigator.standalone`
  - `getComputedStyle(document.documentElement).getPropertyValue('--safe-top')`
  - `getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')`
  - `CSS.supports('padding: env(safe-area-inset-bottom)')`
  - beregnet `.bottom-nav` fra `getBoundingClientRect()` (`top`, `bottom`, `height`)
  - innholdet i viewport-meta-taggen
- Visuell stil blir midlertidig: semi-transparent svart bakgrunn, hvit monospace, små bokstaver, kompakt størrelse.

### 2. Midlertidig fargediagnose i globale styles
- Legge inn eksakt de diagnostiske bakgrunnsfargene i `index.css`:
  - `html` = rød
  - `body` = grønn
  - `#root` = blå
  - `.bottom-nav` = gul
  - `.app-content` = magenta
- Markørene blir tydelig midlertidige og enkle å fjerne i én oppryddingsrunde etter at vi har funnet årsaken.

### 3. Ingen nye blinde layout-endringer
- Jeg endrer ikke scroll-arkitekturen, pull-to-refresh eller header-collapse i denne runden.
- Jeg rører ikke manifest/meta/logikk utover det som trengs for å lese og vise diagnostiske verdier.

### 4. Leveranse og neste steg
Etter implementering gjør vi denne diagnostikk-runden:
1. Åpne Hjem med `?debug=1`
2. Slett installert PWA fra hjemskjermen på iPhone
3. Installer på nytt
4. Ta screenshot av dødplassen med fargemarkørene synlige
5. Send screenshot + verdiene fra debugpanelet tilbake

Da kan vi avgjøre presist om problemet kommer fra `html`, `body`, `#root`, `.bottom-nav`, `.app-content`, eller systembakgrunnen.

## Tekniske detaljer
- Filer som sannsynligvis endres:
  - `src/pages/Home.tsx`
  - `src/index.css`
  - eventuelt en ny komponent som `src/components/debug/PwaDebugPanel.tsx`
- Jeg bruker eksisterende `useLocation()` på Hjem-siden for `?debug=1`.
- `bottom-nav` måles via `document.querySelector('.bottom-nav')?.getBoundingClientRect()`.
- `visualViewport` håndteres defensivt så panelet også fungerer der API-et mangler.
- Dette er bevisst midlertidig kode som slettes etter at vi har fått ekte måledata.