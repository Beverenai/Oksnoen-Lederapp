## Ny funksjon: Deltakerlag (10 grupper)

En ny seksjon på **Deltaker­statistikk** som fordeler alle deltakerne i aktiv periode i 10 lag. Admin kan endre navn og farge per lag, og når funksjonen er skrudd på vises lagnavn + farge­merke på hvert deltakerkort rundt om i appen.

### Brukerflyt

1. Admin går inn på `/participant-stats` → nytt kort **"Lag"**.
2. Toggle øverst: **"Vis lag i appen"** (av som standard).
3. Under: 10 lag-rader. Hver rad viser fargeplukker, navnefelt, antall deltakere, og en `Se deltakere`-knapp.
4. Knapp **"Fordel deltakere"** som tilfeldig deler alle deltakere i aktiv periode i 10 tilnærmet like store lag. Kan kjøres på nytt (bekreftelse). Manuell flytting av enkelt­deltakere via dropdown i deltaker­listen.
5. Når togglen er på, får deltaker­kort i Passkontroll, Deltaljvisning, Nurse-søk osv. en liten fargeprikk + lagnavn.

### Datamodell

Ny tabell `participant_teams`:
- `period_id` (fk periods)
- `slot` 1–10 (unikt per periode)
- `name` (default "Lag 1" … "Lag 10")
- `color` (hex, default fra en 10-fargers palett)

Ny kolonne på `participants`:
- `team_id uuid` (fk participant_teams, nullable, ON DELETE SET NULL)

Ny flagg i `app_config`:
- `teams_enabled` (boolean, styrer om lag vises i appen). Lest via en enkel hook `useTeamsEnabled()` med realtime, likt `useCheckoutEnabled`.

RLS: Ledere kan lese; admin kan skrive.

### Frontend

- **Ny tab** i `src/pages/admin/ParticipantStats.tsx`: `teams` → komponent `src/components/stats/TeamsTab.tsx`.
  - Toggle for `teams_enabled`.
  - Liste med 10 lag: fargeplukker (enkel swatch-grid), inline navneredigering med debounced save, antall medlemmer, expander som lister deltakerne med mulighet til å flytte til annet lag.
  - "Fordel automatisk"-knapp (shuffle + jevn fordeling over 10 lag i aktiv periode).
- **Deltakervisning**: ny liten komponent `TeamBadge` (fargeprikk + navn) som brukes i:
  - `ParticipantDetailDialog` (topp av dialog)
  - `VirtualizedParticipantList` (ved navnet)
  - `Nurse.tsx` deltakersøk-resultater
  - Kun rendret når `teams_enabled = true`.
- Ny hook `useParticipantTeams(periodId)` som henter de 10 lagene for aktiv periode og cacher via React Query.

### Teknisk

- Fordelings­algoritme: hent alle `participants.id` for aktiv periode, shuffle, del i 10 buckets (Math.floor(i / (n/10)) med overskudd fordelt fra start), oppdater `team_id` i én batch pr. lag.
- Migrasjonen seeder 10 tomme lag for hver eksisterende periode så UI-et alltid har 10 rader å redigere.
- Deltakerlister som allerede henter `participants` legger til `team:participant_teams(name, color)` i selecten kun der badgen skal vises, for å holde payload lav ellers.

### Ute av scope

- Ikke automatisk regenerering når nye deltakere importeres — de får `team_id = null` og admin trykker "Fordel" på nytt, eller tildeler manuelt.
- Ikke egne poeng/scoreboard per lag i denne omgangen.
