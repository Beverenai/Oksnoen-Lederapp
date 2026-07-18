## Mål
Gjøre det mulig å printe lappene dobbeltsidig — navnet står på forsiden, det hemmelige ordet på baksiden. Så deltakerne får utdelt lappen sin uten å avsløre ordet før de bretter/snur den.

## Endringer i `SecretWordsTab.tsx` → `printPerCabin`

**Ny layout — 6 kort per A4-side (2 kolonner × 3 rader):**

- **Side 1 (forside):** For hver deltaker et kort som viser
  - Fullt navn (stort)
  - "Velkommen til De Ti Stammene"
  - Lag-badge (nummer, navn, farge)
  - En liten instruksjon: "Snu lappen for å se ditt hemmelige ord"
- **Side 2 (bakside):** Speilvendt rekkefølge (høyre-til-venstre per rad) så kortene matcher forsiden når arket snus langs kortsiden. Viser
  - Stort hemmelig ord
  - Kort forklaring: "Finn en annen deltaker med ordet som hører sammen med ditt …"

**Utskrifts-strategi:**
- Hver hytte starter på nytt ark (som i dag).
- Innen en hytte grupperes 6 og 6 deltakere. For hver gruppe genereres først forside-side, deretter bakside-side (`page-break-after: always`).
- Bakside-rutene fylles i speilvendt rekkefølge slik at posisjon 1 (topp venstre) på forsiden ↔ posisjon 1 (topp høyre) på baksiden.
- Skrivetips over utskriften i UI: "Skriv ut dobbeltsidig, vend langs kortsiden (short-edge)".

**Beholdes:**
- CSV-eksport, tildeling, matcher-liste — uendret.

## Teknisk

- Ingen DB-endringer.
- Kun ren HTML/CSS-generering i `printPerCabin`-funksjonen.
- Bruker `grid-template-columns: 1fr 1fr` og `grid-template-rows: repeat(3, 1fr)` per side, høyde satt så 6 kort fyller én A4.
- Legger til en liten tekst-hint over "Skriv ut per hytte"-knappen i UI'et for å minne om short-edge duplex.
