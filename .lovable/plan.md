## Mål
Erstatt Hajolo-knappen i bunnmenyen med en sirkulær knapp (grønn for sett, rød for usett) — som i en tidligere versjon.

## Endring — `src/components/layout/AppLayout.tsx`, linjene 783–817

Bytt ut nåværende layout (Check-ikon + tekst stablet + animerende prikk) med én rund knapp.

```tsx
<button
  data-active={false}
  onClick={() => { hapticImpact('medium'); handleHajoloClick(); }}
  className="flex flex-col items-center justify-center flex-1 relative"
  aria-label={hasRead ? 'Bekreftet' : 'Hajolo — trykk for å bekrefte'}
>
  <span
    className={cn(
      'flex items-center justify-center w-11 h-11 rounded-full shadow-md transition-colors',
      hasRead
        ? 'bg-green-500 text-white'
        : 'bg-destructive text-white animate-pulse'
    )}
  >
    <Check className="w-6 h-6" strokeWidth={3} />
  </span>
</button>
```

### Detaljer
- Sirkelen er 44×44px (`w-11 h-11`) — passer komfortabelt i den nye slimme bunnmenyen
- Grønn (`bg-green-500`) når `hasRead = true`, rød (`bg-destructive`) når ikke
- Hvit hake inni — tydelig visuell bekreftelse
- `animate-pulse` kun når usett, for å trekke oppmerksomhet
- Ingen tekst-label (sirkelen er selvforklarende, og frigjør plass)
- Beholder `Popover` med forklarings-tooltip uendret
- Beholder `data-active`, `hapticImpact`, `handleHajoloClick` uendret

## Resultat
Midt-knappen blir en distinkt rund "status-knapp" som visuelt skiller seg fra de andre nav-ikonene, slik den var i tidlig versjon. Grønn = bekreftet, rød (pulserende) = ny info.