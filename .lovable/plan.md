

## Fiks: Standard iOS tab bar (ingen flytende pill)

### Endringer

**1. CSS: `.bottom-nav` i `src/index.css` (linje 370-399)**

Erstatt hele `.bottom-nav` og `.dark .bottom-nav` med standard iOS tab bar-stil:

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: hsla(var(--card), 0.85);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid hsl(var(--border));
  border-radius: 0;
  box-shadow: none;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.dark .bottom-nav {
  background: hsla(var(--card), 0.85);
  border-top: 0.5px solid hsl(var(--border));
  box-shadow: none;
}
```

Nøkkelendringer:
- `bottom: 0` — klistret til bunnen, ingen gap
- `left: 0; right: 0` — full bredde, ingen `16px` innrykk
- `padding-bottom: env(safe-area-inset-bottom)` — bakgrunnen strekker seg under home indicator, innholdet skyves opp
- `border-radius: 0` — ingen pill-avrunding
- Ingen `box-shadow` — ekte tab bars har bare en tynn `border-top`

**2. CSS: `.app-content` padding-bottom (linje 360-368)**

Oppdater padding-bottom for å matche ny tab bar uten ekstra gap:

```css
padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
```

**3. Fjern FAB-stil fra midtknappen i `AppLayout.tsx` (linje 677-761)**

Alle tre center-knappene (Hajolo, Admin, Nurse) har `-mt-6`, en stor `w-14 h-14` sirkel med `border-[3px]` og skygge som stikker opp over tab baren. Endre disse til standard tab-ikoner på lik linje med de andre:

- Fjern `-mt-6`, `w-14 h-14 rounded-full`, `border-[3px]`, `shadow-*`
- Bruk samme layout som de vanlige tab-ikonene (linje 767-793): `w-[22px] h-[22px]` ikon + `text-[10px]` label under
- Behold ikonfargen (primary/active-farge) for å skille dem visuelt

### Filer som endres
- `src/index.css` — `.bottom-nav`, `.dark .bottom-nav`, `.app-content`
- `src/components/layout/AppLayout.tsx` — center-knappene (Hajolo, Admin, Nurse)

### Resultat
- Tab bar ser ut som Safari, Apple Music, Instagram: helt ned til bunnen, ingen gap, ingen pill
- Bakgrunnsfargen fortsetter under home indicator
- Ingen svart stripe
- Midtknappen er et vanlig ikon, ikke en FAB som stikker opp

