# Bunnmeny: fit-content høyde med padding + safe-area

## Diagnose

I dag:
- `src/index.css` line 20: `--nav-h: 49px` (hardkodet)
- `AppLayout.tsx` line 763: indre `<div>` har `h-[var(--nav-h)]` → tvinger fast høyde
- `.bottom-nav-fixed` (index.css line 400) har bare `padding-bottom: calc(8px + safe-area)` — ingen top-padding
- `main` (line 836) reserverer plass med `var(--nav-h) + env(safe-area-inset-bottom) + 12px`

Resultat: ikoner/labels klippes hvis innholdet er høyere enn 49px, og det er ingen luftig topp-padding.

## Endringer

### 1. `src/components/layout/AppLayout.tsx` (line 763)
Fjern `h-[var(--nav-h)]` på indre `<div>` → la innholdet definere høyden:
```
<div className="flex items-stretch justify-around px-1">
```

### 2. `src/index.css` (`.bottom-nav-fixed`, ca. line 385-403)
Legg til symmetrisk top-padding så menyen får luft over ikonene:
```css
padding-top: 10px;
padding-bottom: calc(10px + var(--pwa-safe-bottom, env(safe-area-inset-bottom, 34px)));
```
(Bytter 8px → 10px begge veier for symmetri.)

### 3. `src/components/layout/AppLayout.tsx` (line 836, `main` paddingBottom)
`--nav-h` er ikke lenger korrekt — bunnmenyen kan variere. Erstatt med en `ResizeObserver` på `tabBarRef` som setter en CSS-var `--nav-actual-h` på `documentElement`, og bruk den her:
```ts
paddingBottom: 'calc(var(--nav-actual-h, 64px) + 12px)'
```
(Safe-area er allerede inkludert i menyens egen høyde via dens padding, så vi skal ikke dobbelttelle.)

### 4. `src/index.css` (line 20)
Behold `--nav-h: 49px` som fallback (brukes ikke aktivt etter dette, men noen debug-komponenter refererer det implisitt — trygt å la stå).

## Teknisk note

ResizeObserver-tilnærmingen sikrer at hovedinnhold alltid reserverer riktig plass uavhengig av faktisk menyhøyde (forskjellig font-rendering, dynamiske badges, fremtidige endringer). Initial verdi `64px` er trygt estimat før observer kjører.
