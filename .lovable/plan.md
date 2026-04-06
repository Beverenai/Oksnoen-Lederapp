

## Fix: iOS PWA Layout + Scroll-ytelse

Tre problemer som fikses: svart stripe nederst, laggy scroll, og innhold utenfor skjermbredden.

### Endringer

**1. `src/index.css`**
- Fjern global `:active` transform-regel (linje 34-40) — denne triggerer GPU-transform på hvert touch under scroll på iOS
- Legg til `overflow-x: hidden; max-width: 100vw;` på `#root`
- Forbedre `.scroll-area` med `overscroll-behavior-y: contain; contain: content;`
- Sikre `html, body, #root` bruker `min-height: 100dvh`

**2. `src/components/layout/AppLayout.tsx`**
- Ytre wrapper (linje 398): allerede bruker `h-dvh` — legg til `overflow-x-hidden w-full`
- Main content (linje 779-781): legg til `pb-[env(safe-area-inset-bottom,0px)]` og `overscroll-behavior-y-contain`

**3. `src/pages/Leaders.tsx`**
- Fjern `active:scale-[0.99]` og `transition-colors` fra Card (linje 502)
- Legg til `overflow-hidden` på Card og grid-container

**4. `tailwind.config.ts`**
- Legg til safe-area og dvh utilities i `extend`

### Hva endres IKKE
- Ingen funksjonalitet endres
- Hamburger-meny og navigasjon forblir som før
- Bottom nav forblir uendret

