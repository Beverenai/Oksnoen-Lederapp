## To problemer

### 1) Hajolo-knappen mangler tekst-label for ledere
Vanlige ledere har midt-knappen som rund sirkel uten label. Brukeren vil at "Hajolo" skal stå under sirkelen. Admin har fortsatt sin "Dashboard"-knapp (uberørt).

### 2) Stor tom plass under bunnmenyen i iOS PWA
Rotårsak identifisert i `src/components/layout/AppLayout.tsx`, linjer 335–357:

```ts
const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
document.documentElement.style.setProperty('--vv-bottom-offset', `${offset}px`);
```

Denne logikken ble laget for Safari sin URL-bar. Men i **iOS PWA standalone** ekskluderer `visualViewport.height` home-indicator-området (~34px), så `--vv-bottom-offset` blir ~34px → menyen løftes 34px opp fra layout-bunnen. Sammen med safe-area-padding inni menyen får man dobbel kompensasjon = stort tomrom under nav.

I PWA standalone trengs **ingen** visualViewport-offset — `bottom: 0` + safe-area-padding inni nav er korrekt fordi `viewport-fit=cover` allerede strekker layouten under home indicator.

## Endringer

### A) `src/components/layout/AppLayout.tsx` — Hajolo-label tilbake (linje 783–818)

Endre Hajolo-knappen til vertikal flex med sirkelen på toppen og label "Hajolo" / "Bekreftet" under:

```tsx
<button
  data-active={false}
  onClick={() => { hapticImpact('medium'); handleHajoloClick(); }}
  className="flex flex-col items-center justify-center gap-0.5 flex-1 relative"
  aria-label={hasRead ? 'Bekreftet' : 'Hajolo — trykk for å bekrefte'}
>
  <span className={cn(
    'flex items-center justify-center w-9 h-9 rounded-full shadow-md transition-colors',
    hasRead ? 'bg-green-500 text-white' : 'bg-destructive text-white animate-pulse'
  )}>
    <Check className="w-5 h-5" strokeWidth={3} />
  </span>
  <span className={cn(
    'text-[10px] leading-none font-semibold',
    hasRead ? 'text-green-600' : 'text-destructive'
  )}>
    {hasRead ? 'Bekreftet' : 'Hajolo'}
  </span>
</button>
```

Sirkel reduseres fra 44px → 36px så den passer med tekst under i nav-høyden.

### B) `src/components/layout/AppLayout.tsx` — Skipp vv-offset i standalone (linje 335–357)

Legg til standalone-sjekk øverst i effekten:

```ts
useEffect(() => {
  const isStandalone = (window.navigator as { standalone?: boolean }).standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) {
    // I PWA standalone: ingen URL-bar, ingen offset trengs.
    // Safe-area inni nav håndterer home indicator.
    document.documentElement.style.setProperty('--vv-bottom-offset', '0px');
    return;
  }
  // ... eksisterende vv-logikk for Safari ...
}, []);
```

## Resultat

- Ledere ser rund grønn/rød sirkel med "Hajolo"/"Bekreftet"-tekst under
- Admin/sykepleier uendret (Dashboard / Nurse-knapp)
- Bunnmenyen sitter helt nederst i iOS PWA, kun safe-area (home indicator) under
- Safari (ikke-PWA) beholder eksisterende URL-bar-kompensasjon