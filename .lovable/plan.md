## Mål
Gi hver leder en kompakt visning av sine egne vakter for inneværende periode, tilgjengelig fra menyen. Trygg mot navneendringer; krever manuell handling fra admin når nye ledere legges til.

## Trygghet ved endringer (svar på spørsmålet)
- **Navneendring:** Helt trygt. `shift_assignments` lagrer `leader_id` (UUID), navnet hentes via join til `leaders`. Endrer navn → vises nytt navn overalt umiddelbart.
- **Endre alle navnene:** Samme som over — ingen risiko.
- **Ny leder midt i periode:** Hen får ingen vakter automatisk. Admin må enten regenerere perioden eller tildele manuelt i ShiftPlanner. Vi viser et lite varsel i admin-UI når dette oppdages.
- **Slettet/inaktiv leder:** Vakter blir liggende med `leader_id` som peker på fjernet rad. Vi håndterer dette ved å vise "Ukjent" og logge en advarsel.

## Det som skal bygges

### 1. Ny side: `src/pages/MyShifts.tsx` (rute `/my-shifts`)
- Henter aktiv `shift_schedule` (status = `published`, evt. nyeste `draft` hvis ingen publisert) for inneværende år/periode.
- Henter `shift_assignments` filtrert på innlogget leder (`leader_id = currentLeader.id`) + `excluded_leader_ids` ikke inneholder min id.
- Henter `shift_types` for navn/tider.
- Gruppert per dag (`day_index`), sortert på `start_time`.
- Per vakt: tid (HH:MM–HH:MM), navn på vakt, varighet, evt. `note`.
- Sum-rad nederst per dag (totalt antall timer) og totalt for perioden.
- Pull-to-refresh + React Query (`['my-shifts', leaderId]`, stale 30s).
- Tom-tilstand: "Ingen vakter publisert ennå" med RefreshCw-knapp.
- Respekterer impersonation (`effectiveLeader.id`) så admins kan "View as".

### 2. Meny-integrasjon i `src/components/layout/AppLayout.tsx`
- Legg til `myShiftsNavItem = { to: '/my-shifts', icon: ClipboardList, label: 'Min vakt' }`.
- Legg inn i leder/nurse/admin-menyene (etter "Din Hytte"). Behold eksisterende `/schedule` (aktivitetsprogram-bildet) — det er noe annet.

### 3. Rute i `src/App.tsx`
- `<Route path="/my-shifts" element={<MyShifts />} />`

### 4. Admin-varsel i `ShiftPlanner.tsx` (lite tillegg)
- Når en publisert plan finnes og det finnes aktive ledere uten en eneste tildeling i den planen → vis gul banner: "X ledere har ingen vakter (lagt til etter generering). Regenerer eller tildel manuelt."

### 5. (Valgfritt) Hjem-kort
Ikke bygd nå — du valgte kun egen side.

## UI-skisse (mobil)
```
┌─ Min vakt ──────────────────┐
│  Periode 1 · 2026           │
├──────────────────────────────┤
│  Lørdag 21. juni            │
│   13:00–15:00  Ankomst (2t) │
│   17:00–18:30  Middag (1.5t)│
│                Sum: 3.5 t   │
├──────────────────────────────┤
│  Søndag 22. juni            │
│   …                         │
├──────────────────────────────┤
│  Totalt: 38.5 timer         │
└──────────────────────────────┘
```

## Tekniske detaljer
- RLS: `shift_assignments_select` tillater alle authenticated → ingen endring nødvendig.
- Query: ett SELECT med embedded join `shift_types(name,start_time,end_time,duration_hours)`.
- Sortering: `day_index ASC`, deretter `shift_types.start_time ASC`.
- Dato-mapping: `period.start_date + day_index` (hvis perioden har startdato — sjekk `shift_schedules`-skjema; ellers vis kun "Dag 1, Dag 2…" eller ukedag).
- Ingen schema-endringer.

## Filer som endres / opprettes
- `src/pages/MyShifts.tsx` (ny)
- `src/App.tsx` (ny rute)
- `src/components/layout/AppLayout.tsx` (nytt menypunkt)
- `src/pages/admin/ShiftPlanner.tsx` (advarsel om uassignerte ledere)
