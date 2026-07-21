
## Mål

Når Lag er aktivt, skal hver deltakers profil (`ParticipantDetailDialog`) vise en totalsum av poeng deltakeren har samlet, med samme regler som teller mot laget – men beregnet per deltaker.

## Poengregler (per deltaker)

- **Aktiviteter (fra `participant_activities`):**
  - Standard-aktiviteter (finnes i `ACTIVITIES` i `src/lib/activityUtils.ts`, matches via `normalizeActivityForStats` / navnemapping): teller **kun 1 poeng per unike aktivitet**, uansett hvor mange ganger den er registrert.
  - "Andre aktiviteter" (custom – aktiviteter som ikke matcher en standard-aktivitet): teller **1 poeng per registrering** (dvs. antall rader).
- **Insjpoeng (Hemmelige ord):** +1 for hver rad i `secret_word_matches` der deltakeren er `participant_a_id` eller `participant_b_id` i aktiv periode.
- **Bonus/Ekstra poeng:** sum av `points` fra `participant_bonus_points` for deltakeren i aktiv periode (inkluderer både +2 ekstra-poeng-varianter og manuelle justeringer knyttet til deltakeren).

Total = aktiviteter + insjpoeng + bonus.

## Endringer

1. **Ny util** `src/lib/participantPoints.ts`:
   - `computeParticipantPoints({ activities, matches, bonuses })` som returnerer `{ activities, secretWord, bonus, total }` etter reglene over.
   - Bruker eksisterende `ACTIVITIES` + `STATS_ACTIVITY_GROUPING` / `ACTIVITY_NAME_MAPPING` for å avgjøre om en aktivitet er "standard" (unik-telling) eller "annet" (rå telling).

2. **`src/components/passport/ParticipantDetailDialog.tsx`:**
   - Hent `secret_word_matches` og `participant_bonus_points` for deltakeren (aktiv periode). Aktiviteter finnes allerede i komponentens data.
   - Bruk `useTeamsEnabled()` (finnes allerede) – kun vis kortet når lag er aktivt.
   - Legg til et kompakt "Poeng"-kort øverst (eller like under navnet, over eksisterende seksjoner) som viser Total stort, med tre små tall under: Aktiviteter, Insjpoeng, Bonus.

3. Ingen backend-endringer, ingen endringer i lag-leaderboard-logikken.

## Teknisk

```text
Standard-aktivitet? 
  ja  -> legg navnet i Set, +1 kun første gang
  nei -> +1 hver gang
```

En aktivitet regnes som "standard" hvis normalisert navn finnes i `ACTIVITIES.title` (lowercased) eller i nøklene/verdiene til `STATS_ACTIVITY_GROUPING` / `ACTIVITY_NAME_MAPPING`.
