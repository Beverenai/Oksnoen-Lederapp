## Mål
Skrive om vaktplan-generatoren slik at den matcher fasit-malen 1:1 for normaldagene, og oppdatere Excel-eksporten til å være visuelt identisk.

## 1. Datamodell (ingen DB-endringer nødvendig)

Bruker eksisterende `shift_types`, `shift_assignments`, `shift_schedules`, `leader_teams`. Sikrer at `shift_types` har riktige slugs/tider:

```
morgenvakt    06:00–08:30   1 person  (kun F-team)
vekking       08:30–09:00   hele dagens F-team
frokost       09:00–10:00   1 person  (kun 18+)
bings_morgen  09:30–11:00   2 personer (par fra F-team)
personalmote1 10:45–11:00   alle 4 team til stede
okt1          11:00–14:00   1×18+team + 1×F-team (kryssparet)
middag        14:00–15:30   det andre 18+teamet
bings_em      15:30–16:00   samme bings-par
personalmote2 15:45–16:00   alle 4 team
okt2          16:00–19:00   andre 18+team + andre F-team (kryssparet)
kveldsmat     19:00–20:00   det første 18+teamet
bings_kveld   20:00–20:30   samme bings-par
okt3          20:30–00:00   ett 18+team (uten nattevakt)
legging       22:00–01:00   2 personer 18+ (ikke fra dem som hadde Økt 1)
nattevakt     23:30–05:00   2 personer 18+ = også Sanitas+Box
seilern       09:15 (under frokost)  2 personer fra dagens F-team (vask av båten Seileren)
kjokkenvakt   hele dagen    1 person fra F-teamene, roterer gjennom alle
```

## 2. Generator-logikk (`supabase/functions/generate-shift-schedule/index.ts`)

Helt omskrevet rotasjon for `period_length` 5 eller 6 normaldager:

**A/B-rotasjon (per dag d = 0..n-1):**
- A-dag (d partall): T1 = morning-team, T2 = evening-team
- B-dag (d oddetall): T2 = morning, T1 = evening
- Kryssparing F: morning-F = motsatt nummer av morning-team, evening-F = motsatt nummer av evening-team
  - A-dag: morning = T1+T2F, evening = T2+T1F
  - B-dag: morning = T2+T1F, evening = T1+T2F

**Spesialvakter (round-robin, fairness-tracker per leder):**
1. **Morgenvakt** (1 pers): alterner pool 1F→2F→1F→2F…, velg leder med lavest spesial-teller, hopp over de som allerede har en spesialvakt samme dag
2. **Frokostvakt** (1 pers): pool = morning-team (samme team som Økt 1 den dagen), velg leder med lavest spesial-teller
3. **Bingsvakt** (2 pers, samme par alle 3 bings-skift den dagen): alterner pool 2F→1F→2F→1F…, velg de 2 med lavest teller som IKKE har annen spesialvakt samme dag
4. **Kjøkkenvakt** (1 pers): roterer rettferdig gjennom alle 8 F-medlemmer
5. **Seilern** (2 pers): pool = dagens F-team (motsatt av morgenvakt-team), unngå de som har bings/morgen/kjøkken samme dag
6. **Nattevakt** (2 pers, mix T1+T2): roterer rettferdig blant 18+. De som er nattevakt regnes som "ute" av Økt 3
7. **Legging** (2 pers, 18+): velg fra evening-team, men IKKE de som hadde Økt 1 samme dag (gjelder ved overlapp morning-team)

**Fellesregel:** alle spesialvakt-velgere holder en `dutyCount` per leder, sorterer kandidater på `dutyCount asc, random` og hopper over alle som allerede har annen spesialvakt eller er utilgjengelig den dagen.

**Fotnote-flagg** (lagres i `shift_assignments.note`):
- Team i Økt 1/Økt 2: `*` (uten frokostvakt+nattevakt på morning-team), `**` (uten bingsvakt), `***` (uten morgenvakt)
- Team i Økt 3: `****` (uten nattevakt; de med Økt 1 neste dag → kommentar "slutter 23:45")
- Team i Legging: `*****` (de som hadde Økt 1 ekskluderes)

## 3. Excel-eksport (`src/lib/exportShiftScheduleXlsx.ts`)

Skrive helt om for å matche malen pixel-likt:

- Tittel: `Vakter og Skift (Uteledere)` merget over alle kolonner
- Kolonner i denne rekkefølgen: Morgenvakt, Vekking, Frokost, Bings, Personalmøte, Økt 1, Middag, Bings, Personalmøte, Økt 2, Kveldsmat, Bings, Økt 3, Legging, Nattevakt, **Seilern**, **Sanitas + Box**, **Kjøkkenvakt**
- Header-rader: Vakt-navn, Tid, Timer (fra `duration_hours`), `Fin. Federe` (= `min_leaders`)
- Dag-rader: én rad per normaldag, med 4 stablede team-bånd i hver celle:
  - Rød = Team 1, Oransje (#F4A800) = Team 2, Gul (#FFD400) = Team 1F, Blå (#1F6FBF) = Team 2F
  - Bånd-tekst = "Team 1", "Team 1F***", "Caroline & Casper" osv. med fotnote-suffix fra `note`
  - Personalmøte-celle viser alle 4 bånd
- Sanitas+Box-kolonne = samme par som nattevakt
- Bunntekst: alle 5 fotnoter (`* Teamet jobber uten frokostvakten…` osv.) + forklaringsavsnitt

## 4. UI (`src/pages/admin/ShiftPlanner.tsx`)

- Period-length picker tilbyr 5 eller 6 (normaldager). Ankomst/avreise-dager legges til som ekstra (logikk implementeres senere — beholdes som tomme/placeholder for nå).
- Validering bruker samme regler som før (max 8t, F-team ikke etter 21:00, 11t hvile), men frokostvakt-folk skal ikke utløse "for tidlig" varsel siden det er forventet.

## 5. Teknisk

- Ingen DB-migration — bare seed/upsert av `shift_types`-rader hvis Vekking/Seilern/Sanitas mangler. Legges som idempotent SQL i edge-funksjonen ved generering.
- Kjøres som `force_regenerate` flow vi allerede har.
- Bings/morgen/frokost/seilern/kjøkken/nattevakt/legging-rotasjon bruker en delt `DutyCounter`-klasse for rettferdighet på tvers av perioder (resettes per generering for nå; cross-period fairness senere).

## 6. Avgrenset bort (gjøres senere)
- Ankomst- og avreisedag-logikk
- Cross-period fairness (huske hvem som hadde nattevakt forrige periode)
- Manuell drag-and-drop justering i UI
