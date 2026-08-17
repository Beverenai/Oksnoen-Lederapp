# Leirskole – egen modul for leirskole-ledere

En ny funksjon der utvalgte ledere får rollen "leirskole". De ser en egen, begrenset del av appen med hjem, chat, oppgaver fra admin, varslinger og vaktplanen sin – med vaktplan-generatoren fra oksnoen-leder-flow portert inn.

## Slik blir det for brukeren

**Leder med leirskole-rollen**
- Logger inn og havner på Leirskole-hjem: neste vakt, ukens dager, uleste oppgaver og varsler.
- Bunnmeny: Hjem – Vaktplan – Chat – Oppgaver. Ingen andre sider (passkontroll, POV, slurker osv. er utilgjengelig).
- Vaktplan: ukevisning med alle poster, egne vakter tydelig markert og timer per dag. Vises først når admin publiserer uka.
- Tilgjengelighet: kan melde inn dager/klokkeslett de ikke kan jobbe før generatoren kjøres.
- Chat: én felles leirskole-kanal med samme funksjoner som Lederhuset (svar/sitat, emoji-reaksjoner, bilder, @-nevning og @alle med push).
- Oppgaver: liste med oppgaver fra admin som kan markeres som fullført. Nye oppgaver gir push.

**Admin**
- Ny "Leirskole"-fane i admin: uker, bemanning, poster, generator og oppgaver.
- Gi/fjerne leirskole-rollen på ledere.
- Uker: navn, fra/til-dato, publiser vaktplan.
- Poster per dag: navn, tid, antall ledere, hovedvakt/natt, sortering. Kopier dagsmal til andre dager.
- Generator: fordeler ledere på poster med maks 8 timer per dag (justerbart), 11 timers hvile, respekterer tilgjengelighet og låste vakter. Viser statistikk og udekte poster etterpå.
- Manuell overstyring: legg til/bytt/fjern leder på en post, lås vakter før ny kjøring.
- Oppgaver: send oppgave til én eller alle leirskole-ledere og se hvem som har fullført.

## Teknisk

**Roller og tilgang**
- Utvid `app_role`-enum med `leirskole`. Rolle lagres i `user_roles` som i dag; `AuthContext` får `isLeirskole`.
- Ny rutebeskyttelse: er man leirskole (og ikke admin/superadmin) tvinges all navigasjon til `/leirskole/*` – samme mønster som dagens `isLimitedAccess`, med en egen `isLeirskoleRoute`-allowlist. Egen `LeirskoleLayout` med egen bunnmeny.

**Database (ny migrasjon, egne tabeller for å ikke røre dagens ShiftPlanner)**
- `leirskole_weeks`: name, start_date, end_date, is_active, schedule_published_at, max_daily_hours (default 8), min_rest_hours (default 11).
- `leirskole_staff`: week_id, leader_id, maks-timer-override, unik per uke+leder.
- `leirskole_posts`: week_id, date, name, post_type, start_time, end_time, crosses_midnight, duration_hours, required_leaders, is_main_shift, is_night, sort_order, notes. Trigger regner ut varighet og midnattskryssing (portert `schedule_post_duration`).
- `leirskole_assignments`: post_id, staff_id, is_locked, assigned_manually, generator_run_id.
- `leirskole_availability`: staff_id, date, available, from_time, to_time, note.
- `leirskole_generator_runs`: week_id, status, stats jsonb, run_by.
- `leirskole_tasks` + `leirskole_task_completions`: tittel, beskrivelse, frist, mottakere (alle eller valgte), fullført-status per leder.
- Chat: gjenbruker `chat_messages` med `channel = 'leirskole'`. RLS utvides slik at leirskole-rollen og admin kan lese/skrive den kanalen, mens leirskole-ledere ikke får lese `period`/`offseason`.
- GRANT + RLS på alle nye tabeller: admin/superadmin full tilgang; leirskole-ledere leser publiserte uker/poster/vakter for uker de er satt opp på, og skriver kun egen tilgjengelighet og egne oppgave-fullføringer.

**Generator (edge function `generate-leirskole-schedule`)**
- Portes fra oksnoen-leder-flow, tilpasset leder-id i stedet for søknader: sorterer poster (natt/hovedvakt først), fordeler etter minst timer så langt, sjekker maks daglige timer, 11t hvile, ingen overlapp, tilgjengelighet og låste vakter. Returnerer statistikk og udekte poster.

**Frontend**
- Sider: `src/pages/leirskole/LeirskoleHome.tsx`, `LeirskoleSchedule.tsx`, `LeirskoleChat.tsx`, `LeirskoleTasks.tsx`.
- Admin: `src/components/admin/leirskole/` med `LeirskoleWeeksTab`, `LeirskoleStaffTab`, `LeirskolePostsTab`, `LeirskoleScheduleView` (portert) og `LeirskoleTasksTab`.
- Hooks: `useLeirskole.ts` (uker, bemanning, poster, vakter, oppgaver) og `useLeirskoleSchedule.ts` (generator-kall), React Query + realtime som resten av appen.
- Chat gjenbruker dagens chat-komponenter (reaksjoner, bilder, mentions) via en `channel`-prop i stedet for duplisert kode.
- Push: ny edge function `push-leirskole` for oppgaver og publisert vaktplan; chat-varsler går via eksisterende `push-chat-mention` med leirskole-kanalen.

## Rekkefølge
1. Migrasjon: rolle-enum, leirskole-tabeller, RLS/GRANT, chat-kanal-policy.
2. Auth, routing og layout for leirskole-rollen.
3. Admin: uker, bemanning, poster.
4. Generator (edge function) + admin vaktplanvisning med manuell overstyring.
5. Ledersider: hjem, vaktplan, tilgjengelighet.
6. Chat-kanal, oppgaver og push-varsler.