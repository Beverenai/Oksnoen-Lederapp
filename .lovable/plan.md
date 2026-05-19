## Status
Header skjules **allerede** på scroll i `src/components/layout/AppLayout.tsx` (linje 310–333). Den deler dessverre `headerVisible`-state med bunnmenyen, så begge forsvinner samtidig. Det er sannsynligvis grunnen til at brukeren føler det "ikke fungerer som Instagram/X" — der forsvinner bare den øverste linja, mens bunnmenyen blir stående.

## Endringer i `src/components/layout/AppLayout.tsx`

### 1) Decouple bunnmenyen fra header
Linje 784 (bottom nav transform): fjern `headerVisible`-avhengighet. Bunnmenyen skal alltid være synlig.

```tsx
// FRA
transform: headerVisible ? 'translateY(0)' : 'translateY(calc(100% + var(--safe-bottom, 0px)))',

// TIL  (fjern style.transform helt)
```

### 2) Behold header auto-hide men gjør den mer Instagram-aktig
Linjer 310–333: behold scroll-deteksjon men:
- Vis alltid header når scrollY < 50px (allerede gjort)
- Mindre delta-terskel for raskere respons: `delta > 5` / `delta < -5` (istedenfor 10)
- Lytt på `{ passive: true, capture: false }` (allerede gjort)

### 3) Spacer-trigger
Behold spacer-div (linje 877–880) som er — den reserverer plass for header også når den er skjult, så innholdet ikke hopper.

## Resultat
- Toppmeny på iPhone skjules glatt når man scroller ned, vises igjen når man scroller opp (akkurat som Instagram/X)
- Bunnmenyen blir alltid stående — alltid tilgjengelig for navigering
- Innhold over bunnmenyen får fortsatt riktig padding via `--nav-actual-h`