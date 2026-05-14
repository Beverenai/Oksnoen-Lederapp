## Mål

Fjern "Single navn"-raden. Hver dag har **4 rader** — én per team — slik at hver leder/team alltid følger sin egen farge vannrett bortover, uansett om hele teamet jobber eller bare én leder fra teamet.

```
Lørdag  | Team 1   | rød celle: "Team 1" hvis hele teamet, ellers navnet på lederen(e) fra Team 1 som jobber den vakten
        | Team 1F  | oransje celle: "Team 1F" eller navn på Team 1F-leder(e)
        | Team 2   | blå celle: "Team 2" eller navn på Team 2-leder(e)
        | Team 2F  | gul celle: "Team 2F" eller navn på Team 2F-leder(e)
```

## Regel per celle (per dag × per vakt × per team-rad)

1. Hvis vakten har en `assignment_type='team'`-tildeling for dette teamet → vis `Team X` + evt. fotnote-asterisk. Fyll cellen med team-fargen.
2. Ellers, hvis det finnes `assignment_type='leader'`-tildelinger på denne vakten der lederens `leader.team` tilhører dette team-radet (mapping `'1'→team1`, `'2'→team2`, `'1f'→team1f`, `'2f'→team2f`) → vis kortnavn(ene) stablet med linjeskift. Fyll cellen med team-fargen.
3. Ellers → tom, ufarget celle.

Ledere uten team-tilknytning (f.eks. koordinator/kjøkken som ikke matcher mappingen) faller utenfor de 4 radene; de håndteres ikke her (samme oppførsel som i dag for team-radene).

## Endringer i `src/lib/exportShiftScheduleXlsx.ts`

- Fjern `'single'` fra `ROW_TEAMS`. Ny rekkefølge: `['team1', 'team1f', 'team2', 'team2f']` (4 rader per dag).
- Fjern `singleNamesForShift()`. Erstatt `teamLabelForShift()` med ny `teamCellForShift(dayAss, st, team, leaderById) → { text: string; filled: boolean }`:
  - Returnerer `Team X[*]` hvis det finnes team-tildeling.
  - Ellers slår opp leader-tildelinger og filtrerer på `PROFILE_TO_TEAM[leader.team] === team`; returnerer kortnavn(ene) joinet med `\n` (inkl. evt. `(note)` per assignment).
  - `filled=true` så lenge tekst ikke er tom — da settes team-farge + bold + hvit/svart tekst.
- Importer/dupliser `PROFILE_TO_TEAM`-mappingen (legg den i `src/lib/teamUtils.ts` som ny eksport `leaderTeamKey()` så både ShiftPlanner og export kan bruke den uten duplisering).
- Radhøyde: alle team-rader får `wrapText: true` og auto-høyde (ingen fast 16 — vi vet ikke om det blir 1 eller flere navn).
- Dag-merge i kolonne A: `mergeCells(start, 1, start+3, 1)` (4 rader nå i stedet for 5).
- Asterisk-fotnotene under tabellen beholdes uendret.

## Ankomst-/avreise-blokken

Samme regel: hver av de 4 team-radene viser enten `Team X` eller navnet på de(n) leder(e) fra det teamet som er tildelt vakten den dagen — alltid med team-farge.

## Hva endres ikke

- Edge function / DB-skjema.
- Header-rader (vakt/tid/timer/min. ledere).
- Tittel og fotnoter.
