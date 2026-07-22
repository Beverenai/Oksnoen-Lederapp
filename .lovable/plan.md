
# Vaktplan Auto — automatisk generering per leirskoleperiode

## Utgangspunkt fra dagens kode

Camp Commander har allerede tre relaterte moduler:
- `shift_types` (posttyper: navn, slug, start/slutt, varighet, min_leaders, day_type)
- `shift_schedules` (skjema per periode-nummer + år, status draft/published/archived)
- `shift_assignments` (leder- eller lag-tildeling per dag + posttype, med `is_locked` og `excluded_leader_ids`)
- To sider: `ShiftPlanner` (full generator, teams+F-team) og `ShiftPlannerMini` (matrise, manuell)
- Edge function `revalidate-shift-schedule` som allerede sjekker 8t/dag, F-team etter 21, 11t hvile

**Antagelse (bekreft gjerne):** Vi skal *ikke* kaste den eksisterende Vaktplan/Vaktplan Mini. Vi legger til en tredje, ren "Auto"-modus som:
1. Kobler direkte mot `periods` (ikke bare period_number/year), slik at én aktiv periode = én plan.
2. Genererer per **navngitt leder** (ikke team-baserte "team1/team2"-tildelinger).
3. Har konfigurerbart bemanningsbehov per post (i dag ligger dette som `min_leaders` men brukes ikke som hardt behov).
4. Tar med tilgjengelighet per leder per dato/tidsrom og maks-timer per leder.

Hvis du heller vil at auto-generatoren skal *erstatte* dagens `ShiftPlanner`, si fra — planen under bygger den som ny modul ved siden av.

## Datamodell (kun det som mangler)

Gjenbruk `leaders`, `periods`, `shift_types`, `shift_schedules`, `shift_assignments`. Legg til:

- `period_leaders` — kobling leder ↔ periode
  - `period_id`, `leader_id`, `period_number` (int, unik per periode; visnings­nummer 1..N), `max_hours_per_day` (default 8), `status` (approved/pending), `notes`
  - unique(period_id, leader_id), unique(period_id, period_number)
- `leader_availability` — tilgjengelighet
  - `period_leader_id`, `date`, `available` (bool), `from_time`, `to_time`, `note`
- `schedule_posts` — auto-modus poster (parallell til `shift_assignments` sitt behov, men per dato)
  - `schedule_id`, `date`, `shift_type_id` (nullable) *eller* inline navn/tid, `start_time`, `end_time`, `duration_hours` (generated), `required_leaders`, `sort_order`, `notes`, `is_main_session` (bool)
- `schedule_post_assignments`
  - `post_id`, `period_leader_id`, `is_locked`, `assigned_manually`, `generator_run_id`, `assigned_at`
- `schedule_generator_runs`
  - `schedule_id`, `run_at`, `run_by`, `stats` (jsonb: unfilled, warnings, hours per leader)

Utvid `shift_schedules` med `period_id uuid references periods(id)` og `is_published bool default false`.

Alle nye tabeller: RLS — admin full tilgang; ledere kan lese egne rader + publiserte poster/assignments hvor de er tildelt.

## Generator (edge function `generate-shift-schedule-auto`)

Ren TypeScript i Deno. Deterministisk med seed.

**Harde regler** (aldri brutt av auto):
1. Post får nøyaktig `required_leaders`.
2. Leder ≤ `max_hours_per_day` (default 8) per kalenderdag.
3. Ingen tidsoverlapp per leder.
4. Nattevakt → ingen frokost neste dag.
5. Kun `status=approved` og tilgjengelige i tidsrommet.
6. `is_locked=true` beholdes; hvis de bryter regler → rapporteres som konflikt, ikke skjules.

**Prioritering (rekkefølge):** vanskeligste post først — nattevakt → færrest kandidater → hovedøkter → måltider → øvrige.

**Score per kandidat** (lavere = bedre, deterministisk):
```
score = w1*totale_timer + w2*timer_denne_dag + w3*natt_count + w4*måltid_count
      + w5*belastning_forrige_24t - w6*preferanse_match
      + tiny_hash(leader_id, post_id)  // stabilt tie-break
```

**Metode:** greedy med backtracking — hvis en post blir uløselig, rull tilbake siste ikke-låste valg. Returnerer alltid delplan + liste over utildelte poster med forklaring ("Tirsdag Økt 2 mangler 1 leder; 4 kandidater over 8t, 2 opptatt, 1 utilgjengelig").

**Timer over midnatt:** hele vakten teller på startdato (dokumentert i én konstant `HOURS_ATTRIBUTION = 'start_date'` i shared helper).

**Server-side validering** ved manuell endring: trigger + `validate-shift-assignment` edge function som avviser overlapp/over-timer med mindre `is_locked=true` og admin.

## Admin-UI (`/admin/shifts-auto`)

Ny side, gjenbruker Camp Commanders komponenter (`Card`, `Sheet`, `Table`, `Badge`).

**Toppsone:** valgt periode (default aktiv), status (utkast/publisert), knapper: *Generer alt*, *Generer resten på nytt* (beholder låste), *Publiser/Avpubliser*, *Valideringsstatus*.

**Tabs:**
- **Ledere** — liste over godkjente ledere i perioden, tildel periodenummer, sett `max_hours_per_day`, rediger tilgjengelighet per dag.
- **Posttyper & Poster** — CRUD på posttyper (bruker `shift_types`), per-dag oversikt med `required_leaders`, mulighet til å markere `is_main_session`.
- **Plan (uke/matrise)** — dager × poster. Hver celle viser tildelt(e) leder(e) som pill med navn + `#nummer`. Dra/drop for å bytte, klikk = velg leder, hengelås-ikon for lock. Fargekoding: rødt = overlapp/over timer, oransje = under­bemannet, gult = natt→frokost.
- **Timer** — kolonne pr. dag + total pr. leder, med visuell varsel når > maks.
- **Konflikter** — liste over alle brudd med "hopp til"-lenker.

Publisering blokkeres til harde regler er OK (låste konflikter må aksepteres eksplisitt).

## Ledervisning

- `/my-shifts` utvides: hvis publisert Auto-plan finnes for aktiv periode → vis lederens egne vakter (dato, post, tid, varighet) + toggle for hele dagens/ukens oversikt (read-only).
- Ingen redigering. Uendret hvis ingen Auto-plan er publisert (viser fortsatt opplastet bilde).

## Tester

- Vitest for generator-logikken (`src/lib/shiftGenerator.test.ts` med Deno-shim): overlapp, 8t-tak, natt→frokost, låste tildelinger, backtracking, deterministisk output for gitt seed.
- Én integrasjonstest som kjører generator mot fikstur-periode med 10 ledere / 7 dager og verifiserer at ingen harde regler brytes.

## Filer som endres / opprettes

**Migration** (én): nye tabeller + kolonner + RLS + GRANTs + indekser + triggere for timer-beregning.

**Edge functions:**
- `supabase/functions/generate-shift-schedule-auto/index.ts` (ny)
- `supabase/functions/validate-shift-assignment/index.ts` (ny)
- `supabase/functions/_shared/shiftGenerator.ts` (delt logikk, testbar)

**Frontend:**
- `src/pages/admin/ShiftPlannerAuto.tsx` (ny hovedside)
- `src/components/admin/shifts-auto/*` (LederTab, PosterTab, PlanMatrix, TimerTab, KonfliktList, LockToggle, AvailabilitySheet)
- `src/hooks/useAutoSchedule.ts`, `usePeriodLeaders.ts`, `useShiftPosts.ts`
- `src/pages/MyShifts.tsx` (utvidelse)
- Route + meny-oppføring i `src/App.tsx` og `AdminSettings.tsx` under "Vaktplan"-kortet.

**Uendret:** eksisterende `ShiftPlanner`, `ShiftPlannerMini`, `revalidate-shift-schedule` beholdes som de er.

## Rekkefølge for utrulling

1. Migration (behøver din godkjenning i UI).
2. Edge functions + shared generator + tester.
3. Frontend-side + hooks.
4. Ledervisning + rutekobling.

## Manuelle steg som gjenstår for deg

- Godkjenne migration i Cloud-panelet når den kommer.
- Etter deploy: opprette/importere `period_leaders` for aktiv periode (evt. bulk-knapp "Legg til alle aktive ledere" leveres).
- Konfigurere `required_leaders` per posttype hvis defaultene (6/2/1) ikke stemmer.

Si "kjør" så starter jeg med migrationen. Hvis noe skal justeres (f.eks. erstatte gammel ShiftPlanner, andre bemanningsdefaults, ekstra harde regler) — flagg det først.
