
# Manuell Vaktplan Mini — dra og slipp ledere

Ombygger `/admin/shifts-mini` fra AI-generator til en **manuell planlegger**: du definerer selv økter (navn, klokkeslett, varighet), og drar ledere inn i cellene. Appen regner løpende ut totaltimer pr. leder og markerer brudd på 11-timers hvile. Den vanlige `/admin/shifts` forblir uendret.

## Hva du får

**1) Egendefinerte økter (skift-maler)**
- Nytt kort «Økter» øverst: legg til, rediger, slett økter.
- Felt per økt: `Navn`, `Starttid`, `Sluttid`, (auto-beregnet `varighet i timer`), `Min. antall ledere` (valgfritt, kun for visning).
- Økter er dine — ingen kobling til de eksisterende `shift_types` (Vekking, Bings osv.). De lagres separat så «vanlig» Vaktplan ikke påvirkes.

**2) Dager**
- Velg antall dager (1–14). Ingen ankomst/avreise-logikk — bare dag 1..N.

**3) Matrise med drag & drop**
- Rader = dine økter, kolonner = dager.
- Dra en leder fra sidepanelet «Ledere» inn i en celle.
- Dra mellom celler for å flytte. `×` fjerner. Klikk `+` som fallback (mobil) for å velge fra liste.
- Hver celle kan ha flere ledere.

**4) Live-beregning pr. leder**
- Sidepanelet viser hver valgt leder med:
  - `Sum timer pr. dag` (badge pr. dag hvis > 0) — rød hvis > 8 t (kveldsskift 8,6 t).
  - `Total i perioden`.
  - `Hvile-varsel` når to påfølgende vakter for samme person har < 11 t mellom slutt og neste start (håndterer også over midnatt).
- Cellen vises rød når den forårsaker et brudd for en av lederne i den.

## Teknisk

**Ny tabell `shift_planner_mini_shifts`** (dine egne økt-maler, separat fra `shift_types`):
```
id uuid pk, created_by uuid, name text, start_time time, end_time time,
duration_hours numeric generated (end-start, håndterer over midnatt), 
min_leaders int default 0, sort_order int, created_at, updated_at
```
+ RLS: admin full tilgang, GRANT authenticated/service_role.

**Ny tabell `shift_planner_mini_assignments`** (celle-innhold):
```
id uuid pk, shift_id uuid fk -> shift_planner_mini_shifts,
day_index int, leader_id uuid fk -> leaders, created_at
unique (shift_id, day_index, leader_id)
```
+ RLS admin, GRANT.

Vi bruker ikke `shift_assignments`/`shift_schedules` her, så den vanlige planneren forblir helt uberørt.

**Frontend — `src/pages/admin/ShiftPlannerMini.tsx` skrives om:**
- Fjerner: AI-generator, periode-parametere, arrival/departure-brytere, kall til `generate-shift-schedule-mini` og `revalidate-shift-schedule`.
- Beholder: Ledere-panel (søk, av/på) — men nå brukes valgte ledere som «kandidater» du kan dra fra.
- Legger til:
  - `ShiftEditorCard` — CRUD på egne økter.
  - `PlannerMatrix` — HTML5 drag & drop (`draggable`, `onDragStart/Over/Drop`) mellom leder-panel og celler, og mellom celler.
  - `useHoursAndRest(assignments, shifts)` — util som per leder+dag summerer timer og sjekker 11 t hvile mot forrige dags siste vakt og samme dag; returnerer `{ perLeaderPerDay, totals, violations: Set<'leaderId|day'> }`.
  - Sidebar «Timer & hvile» med totals + varsler.
- Alle mutasjoner (add/move/remove økt/assignment) skriver direkte til de nye tabellene med optimistic update via React Query-mønster brukt ellers i prosjektet.

**Regler implementert i klient (samsvarer med eksisterende):**
- Maks 8 t/dag. (Info-varsel, ikke blokkering.)
- 11 t hvile mellom to påfølgende vakter for samme leder.
- Ingen team-logikk (du har allerede fjernet T1/T2/F i Mini).

## Ute av scope
- Ingen endring i `/admin/shifts` eller edge-funksjonene bak vanlig vaktplan.
- Ingen AI-forslag i Mini (kan legges til senere hvis ønsket).
- Ingen eksport/print i denne omgangen — kan tilføyes etter at layouten er godkjent.
