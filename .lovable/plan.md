

## Rombytte: Visuell "fra → til" med beboerliste

### Konsept
Når admin velger et mål-rom i dropdown, vises en kompakt beboerliste under valget som viser hvem som allerede bor der. I tillegg får ventende og godkjente rombytter en visuell "fra-til"-visning med to mini-kort side om side.

### Endringer i `src/components/stats/RoomSwapTab.tsx`

**A. Beboerliste ved valgt mål-rom (ny seksjon under rom-dropdown):**
- Når `targetCabinId` er satt, filtrer `participants` som bor i det rommet
- Vis en liten liste: "Nåværende beboere (X):" med navnene
- Gir admin full oversikt over hvem som allerede er der

**B. Visuell "fra → til" kort for ventende/godkjente rombytter:**
- Erstatt den enkle tekst-linjen med to mini-kort side om side:
  - Venstre kort (rød/rosa bakgrunn): Fra-hytte + rom + liste over andre som bor der
  - Pil i midten
  - Høyre kort (grønn bakgrunn): Til-hytte + rom + liste over nåværende beboere
- For ventende bytter: vis deltagerens navn over kortene
- Hvis to deltakere bytter rom med hverandre (A→B og B→A), grupper dem visuelt

**C. Grupper "swap-par":**
- Detect om to ventende swaps er "motsatte" (A flytter til B's rom, B flytter til A's rom)
- Vis disse som ett visuelt bytte-kort med dobbel-pil (⇄) i stedet for to separate rader

### Filer som endres
- `src/components/stats/RoomSwapTab.tsx` — eneste fil

### Resultat
- Admin ser hvem som bor på et rom før de legger til byttet
- Ventende/godkjente bytter vises visuelt med fra/til-kort
- Gjensidig rombytter (A↔B) grupperes automatisk

