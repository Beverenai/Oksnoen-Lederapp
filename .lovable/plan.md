## Mål

Hver dag i vaktplanen skal vises med **5 rader** i Excel, slik at man enkelt kan følge sitt team vannrett bortover:

```
Lørdag   | Single navn  | (alle individuelle ledere stables her)
         | Team 1       | farget rad – "Team 1" der teamet jobber
         | Team 1F      | farget rad – "Team 1F"
         | Team 2       | farget rad – "Team 2"
         | Team 2F      | farget rad – "Team 2F"
```

Dagsnavn (f.eks. "Lørdag") skrives i kolonne A og merges loddrett over alle 5 radene.

## Endringer i `src/lib/exportShiftScheduleXlsx.ts`

### Normal-dag-blokken (rader fra row 7 og nedover)
- Bytt fra **1 rad per dag** til **5 rader per dag**:
  - Rad 1: `Single navn` – alle assignments med `assignment_type = 'leader'` for denne vakten, stablet med linjeskift i samme celle (slik som i dag, bare uten team-tekst).
  - Rad 2–5: én rad per team i rekkefølgen `team1`, `team1f`, `team2`, `team2f`.
- For team-radene: hvis teamet er tildelt vakten, fyll cellen med team-fargen og skriv `Team 1` / `Team 1F` osv. (med evt. note som `*`, `**` etter labelen). Hvis ikke tildelt: tom celle.
- Tekstfarge: hvit på rød/blå/oransje, svart på gul (team2f). Bold, size 9, sentrert.
- Kolonne A: skriv dagsnavn i første rad (Single-rad) og `mergeCells` loddrett over alle 5 rader. Vertikal sentrering, bold.
- Tynne grå borders rundt hver celle som i dag. Radhøyde ~18 (mindre enn dagens 60, siden hver rad er én linje – Single-raden får auto-høyde via `wrapText`).
- Legg horisontal "skille-border" (medium grå) på topp av Single-raden for hver ny dag, så dagene er visuelt adskilt.

### Hjelpefunksjoner
- Behold `shortName()`, `timeRange()`, `TEAM_FILL`, `TEAM_LABEL`.
- Erstatt `cellLines()` med to nye:
  - `singleNamesForShift(dayAss, st, leaderById) → string` (sammenslått tekst med `\n`)
  - `teamNoteForShift(dayAss, st, team) → string | null` (returnerer f.eks. `"Team 1*"` eller `null`)

### Ankomst/avreise-blokken
- Allerede strukturert med én rad per team — la stå som det er, men bytt fargefyll-cellene til også å vise team-label (`Team 1`, …) for konsistens.

## Tekniske detaljer

- ExcelJS støtter `ws.mergeCells(startRow, 1, startRow+4, 1)` for loddrett merge av dag-cellen.
- Ingen DB- eller edge-function-endringer nødvendig — kun front-end formattering.
- Excel-arket blir ~5x lengre vertikalt (5 rader × 7 dager = 35 rader pluss header), men hver rad er kort, så total høyde er omtrent samme som i dag.
- Single-rad har `wrapText: true`; team-radene får fast høyde 18.

## Hva endres ikke

- Logikken som genererer vaktene (edge function).
- Database-skjema.
- Fotnoter, ankomst-, avreise-blokker (utover label-tilføyelsen nevnt over).
