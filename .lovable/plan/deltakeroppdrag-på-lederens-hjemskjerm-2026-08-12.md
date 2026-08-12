# Deltakeroppdrag på lederens hjemskjerm

Admin kan trykke på en deltaker, skrive en beskjed, og sende den som et **oppdrag** til én bestemt leder eller til alle ledere. Oppdraget vises øverst på lederens hjemskjerm med deltakerens bilde og navn, sammen med en push-varsling.

## Slik virker det

**Sendt til én leder**
- Kortet ligger på lederens hjem til hen trykker **"Jeg har lest beskjeden"**.
- Admin ser når det ble lest.

**Sendt til alle ledere**
- Alle aktive ledere i perioden får kortet + varsling.
- Kortet har knappen **"Jeg fikser det"**. Første leder som trykker får oppdraget tildelt seg — og kortet forsvinner umiddelbart (realtime) for alle andre.
- Den som tok oppdraget ser det videre med en **"Ferdig"**-knapp som lukker oppdraget.
- Admin ser hvem som tok det og når.

**Admin-oversikt**
- Ny seksjon i Admin: aktive og fullførte oppdrag med deltaker, beskjed, mottaker, status og tidspunkt. Admin kan avbryte/slette et oppdrag.

## Hvor man sender fra
- I deltakerkortet (Passkontroll → trykk deltaker) får admin en ny knapp **"Send oppdrag"** som åpner et ark med beskjed, valg av mottaker (én leder via søk / alle ledere) og send-knapp.

## Teknisk

**Ny tabell `participant_tasks`**
- `id`, `participant_id`, `period_id` (default aktiv periode), `message`, `created_by`, `created_at`
- `target_leader_id` (null = broadcast), `is_broadcast`
- `claimed_by`, `claimed_at`, `read_at`, `read_by`, `completed_at`, `status` ('open' | 'claimed' | 'done' | 'cancelled')
- GRANT SELECT/INSERT/UPDATE/DELETE til `authenticated`, GRANT ALL til `service_role`. RLS: admin full tilgang via `is_admin()`; ledere kan lese oppdrag rettet mot dem eller broadcast i aktiv periode, og kun oppdatere lest/claim/ferdig-feltene.
- Claiming via security-definer-funksjon `claim_participant_task(_task_id uuid)` med betinget update (`WHERE claimed_by IS NULL`), så bare første leder vinner.

**Frontend**
- `src/hooks/useParticipantTasks.ts`: React Query + realtime-kanal på `participant_tasks`, så kortet forsvinner hos alle andre straks noen claimer.
- Nytt kort `src/components/home/ParticipantTaskCards.tsx` øverst i `src/pages/Home.tsx` (over "Denne økten"), glass-stil, med deltakerbilde, beskjed og knapp.
- Nytt ark `src/components/passport/SendParticipantTaskSheet.tsx`, åpnes fra deltakerdialogen (kun admin).
- Admin-oversikt som ny seksjon (`ParticipantTasksTab`) i admin-innstillinger.

**Varsling**
- Ny edge function `push-participant-task` etter mønster fra `push-admin-alert`, filtrert til aktive ledere i perioden, deep-link til hjem. App-badge via eksisterende `useAppBadge`.