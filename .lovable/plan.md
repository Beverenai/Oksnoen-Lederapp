# Ny vaktplan-generator (småskala)

Lager en ny, separat generator ved siden av eksisterende `ShiftPlanner`. Beholder de eksisterende reglene (8t maks, F-team ikke etter 21:00, 11t hvile mellom dager) men skalert for få ledere (nå 16 aktive) — færre parallelle vakter, mindre teaming, og valgbart hvilke ledere som deltar.

## Hva som lages

**Ny admin-side:** `/admin/shift-planner-mini` (lenke fra Admin-dashbordet, ved siden av eksisterende Vaktplan).

**Ny edge function:** `generate-shift-schedule-mini` — gjenbruker eksisterende `shift_types`, `shift_schedules`, `shift_assignments`, `special_duties`-tabeller så eksport (`exportShiftScheduleXlsx`) og revalidering (`revalidate-shift-schedule`) fortsatt fungerer.

## Sideoppsett

- **Ledervelger:** Liste over alle aktive ledere med checkbox. Standard = alle på. Viser team-badge ved siden av navnet.
- **Parametere:** Periode-nummer, år, antall dager (default 7), ankomstdag ja/nei, avreisedag ja/nei.
- **Generer-knapp** → kaller edge function med valgte `leader_ids` + parametere.
- **Resultat:** Samme visning som eksisterende planner (dag-for-dag grid) + advarselsliste fra `revalidate-shift-schedule` (som allerede returnerer 8h/F-team/11h-brudd).
- **Handlinger:** Regenerer, tøm, eksporter til Excel (bruker eksisterende `exportShiftScheduleXlsx`).

## Generator-logikk (edge function)

1. Autentiser + admin-sjekk (samme mønster som eksisterende).
2. Last kun de valgte lederne (i stedet for alle aktive). Grupper etter `team` (`1`, `2`, `1f`, `2f`, eller `none`).
3. Last `shift_types` fra DB (uendret).
4. For hver dag `0..N-1`:
   - Velg `day_type` (arrival/departure/normal).
   - Tildel vakter per skifttype med enkel round-robin per team, hopp over team som er tomt (kritisk når vi er få).
   - For skift som slutter etter 21:00 → ekskluder F-team automatisk.
   - Spor kumulative minutter per leder per dag → stopp tildeling til leder når +neste vakt bryter 8t (8.6t hvis natt).
   - Spor forrige vakts sluttid → hopp over leder hvis 11t-hvile brytes.
   - Fallback: hvis ingen leder passer regelen, legg vakten som "utildelt" med rød warning i stedet for å bryte regel.
5. Insert `shift_schedules` (med `period_id` fra aktiv periode) + `shift_assignments` + `special_duties`.
6. Kall `revalidate-shift-schedule` internt og returner warnings sammen med schedule_id.

## Teknisk oppsummering

- **Nye filer:**
  - `supabase/functions/generate-shift-schedule-mini/index.ts`
  - `src/pages/admin/ShiftPlannerMini.tsx`
  - Rute i `src/App.tsx`: `/admin/shift-planner-mini`
  - Kort i Admin-dashbord som lenker dit
- **Gjenbruker:** `shift_types`, `shift_schedules`, `shift_assignments`, `special_duties`, `revalidate-shift-schedule`, `exportShiftScheduleXlsx`
- **Ingen DB-migrasjon** — samme skjema
- **Regler beholdt:** 8t maks (8.6t med natt), F-team ikke etter 21:00, 11t hvile
- **Eksisterende `ShiftPlanner` forblir urørt**

## Åpne spørsmål

Hvis du senere vil ha manuell drag-and-drop-redigering av den genererte planen kan det legges på i en oppfølging — første versjon her er kun generering + advarsler + eksport.
