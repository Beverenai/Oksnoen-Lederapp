## Mål

Fjerne den synlige mørke stripa under bunnmenyen på iPhone PWA (iOS 26.x) ved å kompensere for iOS' kjente bug der `position: fixed; bottom: 0` ikke følger `window.innerHeight` korrekt når Safari-chrome animerer.

## Løsning

Bruk `window.visualViewport` til å beregne hvor mye av layout-viewport som er "skjult" under iOS UI, og forskyv `.bottom-nav` med `transform: translate3d(0, -offset, 0)` (GPU-akselerert, omgår fixed-buggen).

## Endringer

Kun én fil: `src/components/layout/AppLayout.tsx`.

Legg til en `useEffect` i `AppLayout`-komponenten (etter eksisterende effekter, før `return`):

```tsx
// iOS 26 PWA fix: compensate for visualViewport offset on .bottom-nav
useEffect(() => {
  const bottomBar = document.querySelector<HTMLElement>('.bottom-nav');
  if (!bottomBar || !window.visualViewport) return;

  const viewport = window.visualViewport;

  const updateBottomBar = () => {
    const offset = Math.max(
      0,
      window.innerHeight - viewport.height - viewport.offsetTop
    );
    bottomBar.style.transform = `translate3d(0, ${-offset}px, 0)`;
  };

  viewport.addEventListener('resize', updateBottomBar);
  viewport.addEventListener('scroll', updateBottomBar);
  updateBottomBar();

  return () => {
    viewport.removeEventListener('resize', updateBottomBar);
    viewport.removeEventListener('scroll', updateBottomBar);
    bottomBar.style.transform = '';
  };
}, []);
```

## Detaljer / vurderinger

- Effekten kjører i alle miljøer; på Capacitor og desktop blir `offset` typisk 0, så `translate3d(0,0,0)` har ingen visuell effekt (bare promoterer laget til GPU — uskadelig).
- `.bottom-nav` er Portal'et til `document.body`, så `document.querySelector('.bottom-nav')` finner det uavhengig av React-treet. Hvis elementet ikke er montert ennå (f.eks. før første render), avbryter effekten — det er trygt fordi nav-en er en del av `AppLayout` og monteres synkront sammen med denne effekten på første frame etter mount.
- Vi rører ikke `src/index.css`. Eksisterende `bottom: 0` + `padding-bottom: calc(4px + env(safe-area-inset-bottom))` beholdes.
- Cleanup nullstiller `transform` slik at vi ikke etterlater inline style hvis komponenten unmountes.

## Verifikasjon

- PWA på iPhone (iOS 26): den mørke stripa under nav-pillen skal forsvinne; nav-en ligger flush med home indicator-området.
- Capacitor iOS: visuelt uendret.
- Desktop (lg): uendret (`.bottom-nav` brukes kun på mobil via `lg:hidden`).
