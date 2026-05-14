## Mål

Gjøre Excel-vaktplanen mer oversiktlig ved å slå sammen sammenhengende kolonner per team-rad når innholdet er likt, og oppdatere team-fargene til de presise hex-verdiene du oppga.

## Endringer

Kun én fil: `src/lib/exportShiftScheduleXlsx.ts`

### 1. Nye farger

Erstatt `TEAM_FILL` med dine hex-verdier (i ExcelJS ARGB-format, FF + RRGGBB):

```text
team1  (rød)    → #ff0300  → 'FFFF0300'
team2  (oransje)→ #ffc001  → 'FFFFC001'
team1f (gul)    → #fffe01  → 'FFFFFE01'
team2f (blå)    → #0070c0  → 'FF0070C0'
```

Tekstfarge: gul (`team1f`) får svart tekst som før; de tre andre får hvit tekst.

### 2. Sammenslåing av sammenhengende celler

I dag får hver `(dag × team-rad × vakt)` sin egen celle. Når samme team er på flere vakter på rad (f.eks. Bings morgen + Personalmøte + Økt 1), blir det fire–fem like celler ved siden av hverandre.

Ny logikk per team-rad:

1. Bygg en liste `cells[]` med `{ text, filled }` for alle vaktene i raden (samme funksjon som i dag, `teamCellForShift`).
2. Iterer venstre→høyre og finn «runs» av sammenhengende celler hvor `filled === true` og `text` er identisk.
3. For hver run: skriv verdi/farge/border kun i første celle, og kall `ws.mergeCells(r, startCol, r, endCol)` for å slå dem sammen.
4. Tomme/ulike celler skrives som før (ingen merge).

Borders bevares: ytre kanter på den sammenslåtte cellen får samme `thin`/`topDivider`-styling som før, slik at dag-skiller fortsatt vises tydelig.

Samme logikk brukes i `writeSpecialBlock` for ankomst- og avreise-blokkene.

### 3. Uendret

- App-visningen (`ShiftPlanner.tsx` grid) berøres ikke.
- Edge-funksjonens generering, datamodell og PDF/Excel-struktur for øvrig forblir lik.
- Min vakt-siden berøres ikke.

## Resultat

Eksempel — én team-rad i én dag før/etter:

```text
Før:  | Team1 | Team1 | Team1 | Team1 |   –   |   –   |
Etter:|         Team1 (merget)         |   –   |   –   |
```

Fargene oppdateres samtidig til dine eksakte hex-verdier i alle blokker (normaldag, ankomst, avreise).
