# Hendelseslogg for deltagere

Ledere kan raskt loggføre en hendelse knyttet til én eller flere deltagere. Lederen ser kun sine egne hendelser. Admin ser alt samlet i en ny fane under Deltagere, samt inne på hver deltager.

## Datamodell (backend)

**Ny tabell `participant_incidents`**
- `title` (tekst)
- `description` (tekst)
- `category` (enum-tekst: `konflikt`, `skade`, `hjemlengsel`, `positivt`, `annet`)
- `severity` (`low` | `medium` | `high`)
- `leader_id` (referanse til `leaders`)
- `period_id` (auto-sett via eksisterende `set_period_id_default`-trigger)
- standard `created_at` / `updated_at`

**Ny koblingstabell `participant_incident_participants`**
- `incident_id`, `participant_id` (mange-til-mange)

**RLS-policyer**
- Leder kan SELECT/INSERT/UPDATE/DELETE egne rader (`leader_id = current_leader_id()`)
- Admin (`is_admin()`) kan SELECT/UPDATE/DELETE alt
- GRANTs til `authenticated` og `service_role` iht. prosjektstandard

## Ledergrensesnitt

**1. Knapp på Hjem-skjermen** ("Hendelse")
- Åpner et `Sheet` med:
  - Tittel-felt
  - Beskrivelse (textarea)
  - Kategori (chip-velger: Konflikt / Skade / Hjemlengsel / Positivt / Annet)
  - Alvorlighet (Lav / Middels / Høy)
  - Deltagere: søkbar multi-select fra `participants` (aktiv periode)
- Lagrer → toast + lukker

**2. Snarvei inne på deltager (Passkontroll → ParticipantDetailDialog)**
- "Registrer hendelse"-knapp som åpner samme Sheet, forhåndsvalgt deltager (kan legge til flere).

**3. Min historikk**
- Liste over egne hendelser vises inne på Hjem-sheeten (eller egen «Mine hendelser»-liste) slik at lederen kan gå tilbake og redigere/slette.

## Admin-grensesnitt

**Ny fane «Hendelser» i Deltagere-siden** (`/participant-stats`)
- Liste over alle hendelser i aktiv periode
- Filter: kategori, alvorlighet, leder, deltager (søk)
- Hver rad viser: tittel, deltagernavn (badges), kategori, alvorlighet, leder, tid
- Klikk → detaljvisning med full beskrivelse

Historikk per deltager inne på admin sitt deltagerkort kommer i en senere runde (kun global fane nå iht. valg).

## Periode-scoping
- `period_id` settes automatisk via eksisterende trigger.
- Alle queries filtrerer på `useActivePeriodId()`, konsistent med Dynga/Gjenglemt.

## Filer som opprettes / endres

- Migrasjon: `participant_incidents` + `participant_incident_participants` (tabeller, GRANTs, RLS, policies, `set_period_id_default`-trigger, `updated_at`-trigger)
- `src/hooks/useParticipantIncidents.ts` – React Query-hook (list/create/update/delete)
- `src/components/incidents/IncidentSheet.tsx` – felles skjema-Sheet (opprett/rediger)
- `src/components/incidents/MyIncidentsList.tsx` – lederens egen liste
- `src/components/admin/IncidentsTab.tsx` – admin-fanen
- `src/pages/Home.tsx` – ny «Hendelse»-knapp
- `src/components/passport/ParticipantDetailDialog.tsx` – «Registrer hendelse»-knapp
- `src/pages/admin/ParticipantStats.tsx` – legg til fane «Hendelser»
