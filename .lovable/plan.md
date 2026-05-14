# Vaktplan v2 — Excel-lik grid + eksport + validering

Mål: Generator som produserer en plan som ser ut som Excel-malen din, med streng validering (8t/dag, F-team < 21:00, 11t hvile, hele økter), og .xlsx-nedlasting.

## 1. Edge function — `generate-shift-schedule` (full omskriving)

**Input:** `period_number`, `year`, `period_length` (7/8). Team hentes fra `leaders.team` ("1"/"2"/"1f"/"2f").

**Output:** `assignments`, `special_duties`, og en ny `validation`-blokk med advarsler per leder.

**Logikk (per spec):**
- A/B-rotasjon: oddetallsdager = Dag A (Team 1 = dag, Team 2 = kveld); partall = Dag B
- Spesialvakt-rotasjoner pre-bygget for hele perioden:
  - `morgenvakt` (1 fra UNDER18A, roterer)
  - `bingsvakt` (par fra UNDER18B, par-rotasjon)
  - `kjøkkenvakt` (1 fra et F-team, roterer — IKKE samme person som har morgen-/bingsvakt samme dag)
  - `nattevakt` (par fra Team1+Team2)
  - `frokostvakt` (par fra dagteam)
  - `sanitas` (2 fra leggeteam), `seilern` (2 fra vekketeam)
- Asterisk-regler implementert: `*` (uten frokost/natt), `**` (uten bings), `***` (uten morgenvakt), `****` (legging-natt-regel), `*****` (ikke jobbet Økt 1)
- **Middag** = dagens `dagteam*` + UNDER18B + **morgendagens frokostvakt-par** (lagres som ekstra leder-tildelinger på middag-vakten med `role='frokostvakt_neste_dag'`)

**Validering (kjøres etter generering, returneres til klient — generering stopper IKKE):**

| Regel | Sjekk |
|---|---|
| Maks 8t/dag per leder | Sum `duration_hours` per (leder, dag) ≤ 8 |
| F-team aldri etter 21:00 | Ingen leder med team 1F/2F tildelt vakt med `start_time` > 21:00 |
| 11t hvile | Mellom siste `end_time` dag X og første `start_time` dag X+1 |
| Hele økten | Ledere som er i en team-tildeling regnes som hele varigheten (asterisk-unntak respekteres ved at de ikke er med) |
| Kjøkkenvakt-konflikt | Ikke samtidig morgen/bings samme dag |
| Bings-par hindret Økt 1 | Bings-leder må IKKE stå i Økt 1 samme dag |

Advarsler returneres som `[{leader_id, leader_name, day_index, rule, detail}]` og lagres i state — ikke i DB.

## 2. Frontend — `ShiftPlanner.tsx`

**Endringer i grid-visning** for å matche Excel-malen:

```text
                Morgenvakt | Vekking | Frokost | Bings | PM1 | Økt 1 | Middag | ... | Nattevakt
Søndag (dag 1)   [Sophia H] [Team1F] [Frokost: ...] ...
Mandag (dag 2)   [Marie]    [Team2F] ...
...
```

- Dager som rader, vakter som kolonner (sticky header + sticky første kolonne, horisontal scroll på smale skjermer)
- Hver celle viser fargede team-bånd (rød=Team1, blå=Team2, oransje=1F, gul=2F) + navngitte ledere som tekst på badges der relevant (morgen, bings, natt, kjøkken, frokost)
- Stablede bånd i samme celle (matcher Excel der flere team står over hverandre i en vakt)
- Asterisk-tegn (`*`, `**`, etc.) vises på bånd som har dem
- Egne rader for Ankomst/Avreise med sin egen kolonne-rekkefølge

**Validering-kort** øverst i grid-visning:
- Grønt panel "Ingen brudd" hvis tomt
- Rødt/gult panel med liste: "⚠ Marie (Team 1F) — Tirsdag: 9.5 timer (over 8t)"
- Filtrerbar per leder

**Periode/team-summary:** beholdes som i dag (read-only fra profil).

## 3. Excel-eksport (.xlsx)

- "Last ned Excel"-knapp på hver vaktplan-rad
- Klient-side med [`exceljs`](https://www.npmjs.com/package/exceljs) (støtter cell fill + merged cells)
- Layout matcher uploads:
  - Header-rad: vakt-navn
  - Tid-rad, Timer-rad, Min.ledere-rad
  - Dag-rader (Søndag … Fredag) med flettede celler og team-fargede bakgrunner
  - Egen blokk for "Ankomst (Lørdag)" og "Avreise (Lørdag)" under hovedtabellen
  - Asterisk-fotnoter nederst
- Filnavn: `vaktplan-periode-{n}-{year}.xlsx`

## 4. Tekniske detaljer

- Ny fil `src/lib/exportShiftScheduleXlsx.ts` med eksportlogikk
- `exceljs` legges til (`bun add exceljs`)
- Edge function returnerer `validation: { warnings: [...], errors_blocking: [] }` — ingen blokkerende feil med dette valget
- Ingen DB-skjemaendringer nødvendig (advarsler er kun runtime, lagres ikke)
- Eksisterende `shift_assignments`-tabell brukes som er; `role`-feltet markerer spesialvakter ('morgenvakt', 'bingsvakt', etc.)

## 5. Rekkefølge for implementering

1. Skriv om edge function (logikk + validering)
2. Legg til `exceljs` + skriv eksport-modulen
3. Bygg om grid-visningen (matrix-layout)
4. Vis validering-advarsler øverst
5. Legg til "Last ned Excel"-knapp

Sier du fra til "implementer planen", går jeg på.
