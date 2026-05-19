## Problem
Bunnmenyen er for høy fordi den har padding på tre nivåer som legges sammen:

- `.bottom-nav-fixed`: `padding-top: 10px` + `padding-bottom: 10px + safe-area (~34px)` = 14px topp / 44px bunn
- Indre `<div>`: `py-1` = 4px topp + 4px bunn
- Ikoner/labels: ~36–40px innhold

Total høyde i PWA: ~95–100px. Det er ~30px mer enn nødvendig.

## Fiks
Behold safe-area-respekt (det er hele poenget med `box-content`-fiksen), men fjern den ekstra "luft"-padden vi la på sist runde.

### Endring 1 — `src/index.css` (`.bottom-nav-fixed`, linje 400–401)
```css
/* FRA */
padding-top: 10px;
padding-bottom: calc(10px + var(--pwa-safe-bottom, env(safe-area-inset-bottom, 34px)));

/* TIL */
padding-top: 4px;
padding-bottom: calc(4px + var(--pwa-safe-bottom, env(safe-area-inset-bottom, 34px)));
```

### Endring 2 — `src/components/layout/AppLayout.tsx` (linje 779)
```tsx
/* FRA */
<div className="flex items-stretch justify-around px-1 py-1">

/* TIL */
<div className="flex items-stretch justify-around px-1">
```

Fjerner `py-1` (8px ekstra) siden CSS nå håndterer topp/bunn-padding sentralt.

## Resultat
- Topp: 4px
- Bunn: 4px + safe-area (~38px på iPhone med home indicator, 4px ellers)
- Innhold: ikon + label-høyden
- Total høyde: ~70px på iPhone (mot ~100px nå), ~40px på Android/desktop

`box-content` + `ResizeObserver` på `--nav-actual-h` står urørt, så main-content-padding følger automatisk den nye høyden.

## Verifisering
Reinstaller PWA på iPhone og sjekk at:
1. Menyen ikke har stor luft over/under ikonene
2. Home indicator fortsatt har plass under menyen (safe-area)
3. Innhold over menyen ikke dekkes (ResizeObserver oppdaterer main padding)