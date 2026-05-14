## 1. Sammenkobling av frokostvakt (D → D+1)

I `supabase/functions/generate-shift-schedule/index.ts`:

- Legg til `const frokostByDay = new Map<number, LeaderRow>();` før normal-dag-loopen.
- I dag-loopen, før `frokost` plukkes:
  - Hvis `frokostByDay.has(d)` → bruk den lagrede personen som dagens `frokost` (og marker `busy.add(...)` + `inc(...)`).
  - Ellers (kun første normale dag) → `pickFairest(grouped[morning18], 1, busy)` som nå.
- Bytt ut nåværende `nesteFrokost`-blokk:
  - Hopp over hvis `d + 1 >= NORMAL_TO` (siste normale dag — ingen frokostvakt morgen etter).
  - Ellers `pickFairest(grouped[evening18], 1, busy)`, mark `busy`/`inc`, og lagre i `frokostByDay.set(d + 1, leader)`. Personen tas fortsatt med på dagens Økt 1, personalmøte og Bings-personalmøte slik som nå.
- Behold `duties`-radene `frokostvakt` og `neste_frokostvakt` uendret.

Effekt: personen som har `frokostvakt` på dag D+1 var alltid med på Økt 1 på dag D. Unntak: dag 1's frokostvakt (ingen forrige dag).

## 2. Timer-oversikt i vaktplan-visningen

I `src/pages/admin/ShiftPlanner.tsx`, under Grid-visningen, legg til en ny `Card` ("Timer per leder"):

- Tabell: **rad per leder** (kun aktive ledere med team 1/2/1F/2F, alfabetisk), **kolonne per dag** + en sum-kolonne til slutt.
- Hver celle viser totale timer den lederen jobber den dagen, beregnet ved å:
  - Iterere over `assignments` for `schedule_id`.
  - For `assignment_type='leader'` med matchende `leader_id`: legg til `shift_type.duration_hours`.
  - For `assignment_type='team'`: hvis lederens team-key (via samme `PROFILE_TO_TEAM` som finnes i fila) matcher `team_name`, legg til `shift_type.duration_hours`. (Dette speiler hvordan generatoren og revalidate teller.)
- Fargekoding: tom = nøytral; > 8t = rød bakgrunn (matcher `8h_max`-regelen); 0t / "fri" = lys grå tekst "–".
- Tom-rad / sum-rad nederst med totaler per dag og totalt for perioden.
- Bruk semantiske design-tokens (ikke direkte farger), eks. `bg-destructive/10 text-destructive`.

Logikken bygges som en `useMemo` `hoursByLeaderDay: Map<leaderId, number[]>` som leser fra `assignments`, `shiftTypes`, og `leaders`.

### Berørte filer
- `supabase/functions/generate-shift-schedule/index.ts`
- `src/pages/admin/ShiftPlanner.tsx`
