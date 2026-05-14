## 1. Fikse team-farger i Excel

I `src/lib/exportShiftScheduleXlsx.ts` matcher fargene per i dag ikke det du ønsker. Endre `TEAM_FILL`:

| Team | Nå | Skal være |
|------|----|-----------|
| Team 1 | Rød ✓ | Rød `FFEF4444` |
| Team 2 | Blå | **Oransje** `FFF97316` |
| Team 1F | Oransje | **Gul** `FFEAB308` |
| Team 2F | Gul | **Blå** `FF3B82F6` |

Tekstfarge-logikken oppdateres: hvit tekst på rød/oransje/blå, svart tekst på gul (`team1f`). Samme TEAM_META i `ShiftPlanner.tsx` er allerede korrekt (rød / oransje / gul / blå), så grid-visningen er allerede riktig — bare Excel må fikses.

## 2. Manuell redigering: bytt person + revalidér

Du valgte: **Bytt én person i én vakt og kjør validering på nytt** (ingen cascade-omfordeling).

### UI i `ShiftPlanner.tsx` grid-visning
- Hver tildelt person/team-badge får en liten redigerings-knapp (blyant-ikon) ved siden, kun synlig for admin og kun når planen er `draft` (ikke `published`/`archived` — eller med en "Lås opp for redigering"-toggle).
- Klikk på blyanten åpner en `Popover` / `Dialog` med:
  - Dropdown over alle aktive ledere (filtrert: ekskluder kjøkken/sjef/nurse for vanlige vakter; samme regler som generatoren — F-team-vakter viser kun F-team-ledere, 18+ vakter viser kun ≥18).
  - "Lagre" / "Avbryt".
- For team-tildelinger (`assignment_type='team'`) får du i tillegg en knapp "Konverter til enkeltperson" som splitter team-raden til individuelle leder-rader.

### Backend-flyt
- Lagrer `UPDATE shift_assignments SET leader_id = ... WHERE id = ...` direkte via supabase-klient (RLS tillater admin).
- Etter lagring kalles en ny edge function `revalidate-shift-schedule` med `schedule_id`. Den henter alle assignments + shift_types + leaders, kjører **samme validerings-blokk som generatoren** (8t/dag, 11t-hvile, F-team-etter-21:00, min_leaders, requires_18+), og returnerer `{ warnings: Warning[] }`.
- Frontend oppdaterer `warnings`-state og lokal `assignments`-state → grid og advarsels-boks oppdateres umiddelbart.

### Refaktorering
- Flytt validerings-logikken fra `generate-shift-schedule/index.ts` (linje ~440-508) til en delt modul `supabase/functions/_shared/validate-shift-schedule.ts` slik at både generatoren og den nye `revalidate`-funksjonen kaller samme kode (én sannhetskilde).

## 3. Hvorfor 134 advarsler?

Advarslene kommer fra valideringen som kjører **etter** generering (`supabase/functions/generate-shift-schedule/index.ts` linje 460-507). Det er tre regler:

| Regel | Hva den sjekker |
|-------|-----------------|
| `8h_max` | Mer enn 8 timers arbeid på én leder samme dag |
| `f_team_after_21` | F-team-leder har vakt som slutter etter 21:00 |
| `11h_rest` | Mindre enn 11 timer hvile mellom siste vakt dag N og første vakt dag N+1 |

Med dagens vakttyper (Sanitas slutter 01:00, Bingsvakt går natt, Vekking starter 06:30, osv.) er det matematisk nesten umulig å unngå 11t-brudd hvis samme leder har kveldsvakt + tidlig morgen. Generatoren genererer planen først og **flagger** brudd — den prøver ikke å unngå dem.

### Mitt forslag (etter at #1 og #2 er gjort)
Jeg gir deg en oppsummering gruppert per regel + per leder så du ser hvor smerten ligger:
```
8h_max:        45 tilfeller (12 ledere)
11h_rest:      72 tilfeller (18 ledere)
f_team_after_21: 17 tilfeller (4 ledere)
```
Så kan vi sammen avgjøre:
- Er 11t-regelen riktig satt? (Norsk AML har 11t hvile, men leirsetting kan ha unntak.)
- Skal generatoren prøve å unngå disse, eller er det OK å bare flagge dem?
- Skal noen vakttyper "ikke telle" mot 8t/dag (f.eks. korte vakter på 0.75t)?

Dette gjør vi som en separat runde etter at fargene + redigerings-UI er på plass.

## Berørte filer
- `src/lib/exportShiftScheduleXlsx.ts` — fargefiks
- `src/pages/admin/ShiftPlanner.tsx` — redigerings-UI i grid
- `supabase/functions/_shared/validate-shift-schedule.ts` — ny delt modul
- `supabase/functions/generate-shift-schedule/index.ts` — bruker delt modul
- `supabase/functions/revalidate-shift-schedule/index.ts` — ny edge function
