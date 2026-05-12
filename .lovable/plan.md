## Hvorfor scroll er ødelagt

I `src/components/layout/AppLayout.tsx` (linje 399) er root-containeren:

```
min-h-dvh h-full flex-col overflow-hidden
```

`<main>` inni er `flex-1 ... overflow-y-auto`.

For at `flex-1 overflow-y-auto` skal kunne scrolle, må forelderen ha en **fast høyde** lik viewporten. Etter forrige runde der vi byttet fra `height` til `min-height` på `html`, `body`, `#root` (og fjernet `--app-height`), har root-containeren nå bare `min-height: 100dvh` — ingen øvre grense. Når innholdet er høyere enn skjermen, vokser hele app-shellen i stedet for at `<main>` får en intern scroll. Samtidig klipper `overflow-hidden` på root alt som havner under viewporten, så det ser ut som at sidene ikke kan scrolles.

Dette er en ren regresjon fra forrige fix og har ingenting med PWA-bunnen å gjøre.

## Fix

Gi **selve app-shell-wrapperen** i `AppLayout` en fast høyde lik dynamisk viewport, mens `html`/`body`/`#root` får beholde `min-height`-strategien sin (som er det som holder PWA-bunnen riktig).

### Endring i `src/components/layout/AppLayout.tsx` (linje 399)

Bytt fra:
```
className="bg-background flex min-h-dvh h-full flex-col overflow-hidden overflow-x-hidden w-full max-w-full pl-safe pr-safe"
```

til (mobil = fast dvh-høyde, desktop = uendret oppførsel):
```
className="bg-background flex h-[100dvh] lg:h-auto lg:min-h-dvh flex-col overflow-hidden overflow-x-hidden w-full max-w-full pl-safe pr-safe"
```

- `h-[100dvh]` på mobil gir `<main className="flex-1 overflow-y-auto">` en konkret høyde å scrolle innenfor.
- `lg:h-auto lg:min-h-dvh` beholder dagens desktop-oppførsel (sidebaren er `fixed`, og main scroller med dokumentet).
- `overflow-hidden` på root beholdes så ingenting lekker forbi viewporten — men nå har root også en høyde lik viewporten, så `<main>` får faktisk scroll i stedet for å bli klippet bort.

### Hva som IKKE endres

- `html`, `body`, `#root` i `src/index.css` røres ikke. PWA-fyllingen nederst er fortsatt korrekt.
- `--app-height` introduseres ikke på nytt.
- Ingen JavaScript for viewport-høyde.
- `.bottom-nav` og safe-area-paddingen røres ikke.
- Desktop-layouten endres ikke.

## Forventet resultat

- Sidene (inkl. `/nurse`, `/leaders` osv.) kan scrolles igjen på både mobil og desktop.
- Bunnen av iPhone-skjermen brukes fortsatt fullt ut (forrige fix beholdes).
- Pill-menyen ligger fortsatt riktig nederst.

## Filer som endres

- `src/components/layout/AppLayout.tsx` (én linje, klassenavn på root-`div`)
