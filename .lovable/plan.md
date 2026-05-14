## Problem

`revalidate-shift-schedule` (edge function) gir 184 advarsler både på 7- og 8-dagers planer fordi den har samme dobbelttellings-bug som UI hadde:

- Generator (`generate-shift-schedule`) ekskluderer ledere med egen-vakt (kjøkken, morgen, natt, bings, sanitas, frokost) fra team-vakter via `recordWork`.
- Men `shift_assignments`-radene lagrer kun `team_name` — ikke hvem som er ekskludert.
- Både UI og `revalidate` ekspanderer derfor team-vakta til ALLE medlemmer av teamet → hver leder får ~16 t/dag → `8h_max`-regelen fyrer for nesten alle ledere på nesten alle dager.

Tallet er likt på 7 og 8 dager fordi feilen er per (leder, dag) og treffer hver normaldag uavhengig av periodelengde.

UI-fixen (intervall-union) hjalp delvis der egen-vakt og team-vakter overlapper i tid, men løser ikke selve datamodell-problemet, og treffer ikke `revalidate` i det hele tatt.

## Løsning

Persistér ekskluderingslisten på team-tildelingen. Da har UI, revalidate og Excel-eksport én sannhetskilde og slipper å rekonstruere generator-logikken.

### 1. Skjema-migrasjon

`shift_assignments`: legg til kolonne
```
excluded_leader_ids uuid[] not null default '{}'
```
Ingen RLS-endring.

### 2. Generator (`supabase/functions/generate-shift-schedule/index.ts`)

I `pushTeam`: ta `excluded` (LeaderRow[]) og skriv `excluded_leader_ids: excluded.map(l => l.id)` på rad-objektet. Alle eksisterende kall passerer allerede `excluded`.

### 3. Revalidate (`supabase/functions/revalidate-shift-schedule/index.ts`)

Når team-tildeling ekspanderes til medlemmer, hopp over `m.id` som finnes i `a.excluded_leader_ids`. Behold `union-of-intervals` for `8h_max` (sikkert mot fremtidige overlapp), men hovedeffekten er at de ekskluderte ikke lenger blir inkludert i det hele tatt.

### 4. UI (`src/pages/admin/ShiftPlanner.tsx`)

I `hoursMatrix`: samme exclusion-sjekk under team-ekspansjon. Behold union-logikken — den er fortsatt riktig for ledere som faktisk jobber overlappende vakter.

### 5. Excel-eksport (`src/lib/exportShiftScheduleXlsx.ts`)

Sjekk om filen ekspanderer team-vakter til ledere; hvis ja, samme exclusion-sjekk.

### Verifisering

- Kjør generate på 7-dagers og 8-dagers periode, åpne planen → forvent 0 eller noen få advarsler (kun ekte brudd, f.eks. F-team-natt eller manglende hvile).
- Sjekk timer-tabellen: ledere uten egen-vakt ≈ 8 t/dag på normaldag; ledere med egen-vakt ≈ 8 t også (egen-vakt erstatter team-vakt, ikke legges til).
- Sumkolonnen "Sum dag" ≈ antall ledere × 8 på normaldager.

### Filer som endres

- ny migrasjon: `supabase/migrations/<ts>_add_excluded_leaders_to_shift_assignments.sql`
- `supabase/functions/generate-shift-schedule/index.ts` (pushTeam + insert payload)
- `supabase/functions/revalidate-shift-schedule/index.ts` (team-ekspansjon)
- `src/pages/admin/ShiftPlanner.tsx` (hoursMatrix team-ekspansjon)
- `src/lib/exportShiftScheduleXlsx.ts` (kun hvis den ekspanderer team-vakter)
- `.lovable/plan.md`
