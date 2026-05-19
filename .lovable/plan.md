Tre endringer:

## 1. Standard lightmode på mobil
- `src/App.tsx`: Endre `<ThemeProvider defaultTheme="system" enableSystem>` → `defaultTheme="light"` og fjern `enableSystem` (eller behold men la "light" være default). next-themes husker valg i localStorage, så Innstillinger-bryteren overstyrer fortsatt.
- Innstillinger-skjermen (`ThemeSwitcher`) er allerede koblet til next-themes — ingen UI-endring nødvendig.

## 2. Bunnmeny skjules ved scroll (som toppmenyen)
- `src/components/layout/AppLayout.tsx`: Bunnmenyen (`<nav className="bottom-nav-fixed">` rundt linje 755) bruker samme `headerVisible`-state som toppmenyen.
- Legg til `style={{ transform: headerVisible ? 'translateY(0)' : 'translateY(calc(100% + var(--safe-bottom,0px)))' }}` og samme `transition-transform duration-300 ease-out will-change-transform`-klasser.
- FAB-knappen (Hajolo midtknapp er allerede inni samme nav, så den følger med automatisk).
- Scroll-thresholden (50px ned/10px delta) er allerede konfigurert — gjenbrukes.

## 3. Litt større skala på iPhone
- `src/index.css`: Legg til en media query som øker root font-size på mobile viewports (≤640px):
  ```css
  @media (max-width: 640px) {
    :root { font-size: 17px; } /* default er 16px → ~6% større */
  }
  ```
- Siden hele appen bruker `rem`-baserte Tailwind-tokens, skalerer dette knapper, tekst, padding og ikoner proporsjonalt uten å bryte layout.
- Touch-targets (44px min på iOS) er allerede over minimum; dette gir bare litt ekstra luft.

## Ikke endret
- Desktop-layout (sidebar) påvirkes ikke av font-size endringen siden den er ≥640px.
- Eksisterende safe-area/100dvh-oppsett beholdes.
- Backend, RLS, sync-funksjonalitet urørt.
