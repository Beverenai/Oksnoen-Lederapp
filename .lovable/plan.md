

## Gjenopprett pill-meny med minimal gap + prominent Hajolo-knapp

### Hva endres

**1. `src/index.css` — `.bottom-nav` tilbake til pill med minimal gap**

```css
.bottom-nav {
  position: fixed;
  bottom: calc(4px + env(safe-area-inset-bottom, 0px)); /* Minimal gap — bare 4px over safe area */
  left: 8px;
  right: 8px;
  z-index: 50;
  background: hsla(var(--card), 0.85);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid hsl(var(--border));
  border-radius: 20px;              /* Pill-form tilbake */
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
}
```

Nøkkelforskjell fra før: `bottom: calc(4px + safe-area)` i stedet for `calc(8px + safe-area)` — halvparten av gapet, akkurat nok til å se pill-formen.

**2. `src/components/layout/AppLayout.tsx` — Hajolo/Admin/Nurse tilbake til prominent midtknapp**

Gjenopprett FAB-stilen på midtknappen:
- `w-14 h-14 rounded-full` med bakgrunnsfarge
- `-mt-6` for å stikke litt opp over pill-en
- Rød/grønn farge som viser om meldingen er lest eller ikke
- Hajolo: rød sirkel med puls når ulest, grønn med check når bekreftet
- Admin/Nurse: tilsvarende prominent sirkel

### Filer som endres
- `src/index.css` — pill-stil med minimal gap
- `src/components/layout/AppLayout.tsx` — midtknappen tilbake til FAB

### Resultat
- Pill-meny med så vidt litt plass under (4px + safe area)
- Hajolo-knappen er prominent og viser tydelig lest/ulest-status
- Ingen overdreven svart stripe under menyen

