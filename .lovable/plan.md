

## Diagnose og fiks: Bunnavigasjon + scroll

### DIAGNOSE 1: Bunnavigasjon og safe area

1. **Bunnavigasjonen renderes i `AppLayout.tsx` linje 667-798** — en `<nav className="lg:hidden bottom-nav">` med CSS-klassen `.bottom-nav` definert i `index.css` linje 360-381.

2. **Safe area er allerede håndtert korrekt**: `.bottom-nav` har `bottom: calc(8px + env(safe-area-inset-bottom, 0px))` — den flyter som en iOS-pill OVER safe area. Dette er riktig design.

3. **`html, body, #root` har `max-width: 100%`** (linje 53-55 i index.css), men **mangler `min-height: 100dvh`**. Det er ingen eksplisitt `min-height` eller `height` satt på disse elementene.

4. **`viewport-fit=cover`** er satt i `index.html` linje 5 ✓

5. **Den svarte stripen** under navigasjonen skyldes sannsynligvis at `body` / `#root` ikke fyller hele skjermhøyden. Appen stopper før bunnen av viewport, og den mørke bakgrunnen under body vises.

### DIAGNOSE 2: Scroll som låser seg på Ledere

1. **Scroll-container**: `<main>` med klassen `app-content` (linje 801-804) er den faktiske scroll-containeren. Leaders-innholdet ligger inni den. I tillegg har Leaders-komponenten `pullRef` på sin wrapper-div (linje 349) som registrerer touch-events.

2. **`active:scale`**: Ingen forekomster i hele kodebasen ✓

3. **Global `:active` CSS**: Kun `opacity: 0.85`, ingen transform ✓

4. **`usePullToRefresh` og `preventDefault()`**: Ja — linje 56 kaller `e.preventDefault()` på touchmove. Den sjekker `scrollTop > 0` (linje 34, 45) og `diff > 0` (linje 55), men **problemet er at `pullRef` peker på Leaders' wrapper-div, som IKKE er scroll-containeren**. `element.scrollTop` er alltid 0 fordi det er `<main>` som scroller, ikke pullRef-diven. Dermed kalles `preventDefault()` på ALLE nedover-touches, som kan blokkere scroll-oppover etter bounce.

5. **`position: sticky`**: Ikke inne i Leaders scroll-listen.

6. **`-webkit-overflow-scrolling: touch`**: Satt på `.app-content` ✓

### ROTÅRSAK SCROLL-LOCK
`usePullToRefresh` sjekker `element.scrollTop` på pullRef-elementet, men pullRef er Leaders' indre div — ikke scroll-containeren (`<main>`). Dermed tror hooken alltid at vi er på toppen, og kaller `preventDefault()` på touchmove-events som skulle latt brukeren scrolle opp.

---

### FIKSER

**1. `src/index.css` — Fyll hele viewport-høyden**
Legg til på `html, body, #root`:
```css
html, body, #root {
  min-height: 100dvh;
  min-height: -webkit-fill-available;
}
body {
  background: hsl(var(--background));
}
```
Dette fjerner den svarte stripen ved at body-bakgrunnen matcher appen og hele viewport fylles.

**2. `src/hooks/usePullToRefresh.ts` — Fikse scroll-deteksjon**
Problemet: `pullRef.current.scrollTop` er alltid 0 fordi pullRef ikke er scroll-containeren.

Løsning: La hooken finne nærmeste scrollbare forelder (`<main>`) og sjekke `scrollTop` der i stedet:
```ts
// I handleTouchStart og handleTouchMove:
// Finn scroll-parent (nærmeste element med overflow-y: auto/scroll)
const scrollParent = element.closest('main') || element.closest('[class*="overflow-y"]') || element;
if (scrollParent.scrollTop > 0) return;
```

**3. `src/pages/Leaders.tsx` — Ingen endring nødvendig**
Scroll-containeren er `<main>`, og det er korrekt. Leaders-komponentens `overflow-x-hidden` og `overscrollBehavior: contain` er fine.

### Filer som endres
- `src/index.css` — `min-height: 100dvh` + body bakgrunnsfarge
- `src/hooks/usePullToRefresh.ts` — bruk scroll-parent for scrollTop-sjekk

### Resultat
- Ingen svart stripe under bunnavigasjonen på iPhone
- Scroll på Ledere-siden låser seg ikke lenger
- Pull-to-refresh fungerer fortsatt korrekt (kun fra toppen)
- Ingen visuell endring på desktop

