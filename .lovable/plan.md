

## Fix: Global overflow-containment, fullscreen-fill og pull-to-refresh

### Problem
Forrige runde la til mange av de rette reglene, men overflow lekker fortsatt fra barn-elementer (tabeller, flex-rader, lange tekster). Enkeltfiks per komponent skalerer ikke — vi trenger aggressivere globale regler.

### Endringer

| Fil | Endring |
|-----|--------|
| `src/index.css` | Legg til globale overflow-containment-regler som fanger ALT innhold |

### Konkrete CSS-endringer i `src/index.css`

**1. Global overflow-clipping for alle elementer (legg til etter box-sizing-regelen linje 44-46):**
```css
/* Prevent ANY element from causing horizontal overflow */
html, body, #root, main, section, article, div, form {
  max-width: 100%;
}

/* Force flex/grid children to respect parent bounds */
* {
  min-width: 0;
}
```

Denne `min-width: 0` er den viktigste endringen — den overskriver nettlesernes standard `min-width: auto` på flex/grid-barn, som er den vanligste årsaken til at innhold strekker seg utenfor skjermen.

**2. Oppdater `html, body`-regelen (linje 210-216) for å inkludere `100dvh`:**
```css
html, body {
  height: 100%;
  min-height: 100dvh;
  min-height: -webkit-fill-available;
  margin: 0;
  padding: 0;
  overflow: hidden;
  overflow-x: hidden;
  touch-action: manipulation;
  width: 100%;
  max-width: 100vw;
}
```

**3. Sikre tabeller scroller innenfor sin container — legg til i utilities:**
```css
table {
  max-width: 100%;
}
```

### Hva dette fikser
- `min-width: 0` på alle elementer → flex/grid-barn kan ikke tvinge forelder bredere enn skjermen
- `max-width: 100%` på container-elementer → ingen container kan strekke seg ut
- `100dvh` + `-webkit-fill-available` på html/body → eliminerer svart stripe nederst på iOS
- Pull-to-refresh og PullIndicator er allerede fikset fra forrige runde (timeout + smooth collapse)

### Hva endres IKKE
- Ingen komponent-filer endres
- Pull-to-refresh er allerede fikset
- Bunnnavigasjon, layout-struktur forblir som før

