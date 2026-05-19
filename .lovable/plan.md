## Problem
Bunnmenyen viser et synlig gap under nav-pillen i PWA (skjermbilder 18:32 og 18:48). Selv om `.bottom-nav-fixed` allerede setter `box-sizing: content-box` i `src/index.css`, blir denne i praksis overstyrt/inkonsistent (Tailwind preflight + `*` universal-regel + inline transform-styling kan skape containing-block-issues hvor `padding-bottom: env(safe-area-inset-bottom)` ikke ekspanderer bakgrunnen som forventet).

Kjent fix (samme som daisyUI-issue #1732): tving `box-sizing: content-box` direkte på nav-elementet via Tailwind-klassen `box-content`.

## Endring

**`src/components/layout/AppLayout.tsx`** (linje 757):
Legg til `box-content` i className-listen på `<nav>`:

```tsx
className="lg:hidden bottom-nav-fixed bottom-nav box-content transition-transform duration-300 ease-out will-change-transform"
```

Dette sikrer at `padding-bottom` (som inneholder safe-area-inset) legger seg utenpå nav-høyden i stedet for å bli klemt inn, så bakgrunnen til pillen strekker seg helt ned til skjermkanten under home-indikatoren.

## Ikke endret
- CSS-tokens, safe-area-variabler, scroll-hide-logikk, FAB, backend.
- `.bottom-nav-fixed`-regelen i `index.css` beholdes (defense in depth).