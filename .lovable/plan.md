## Kjøkkentjeneste for lag (2 og 2)

Legger til en automatisk rotasjon der 2 av de 10 lagene har kjøkkentjeneste hver dag, med visning i admin, på lederens hjemskjerm, og et klikk-filter i Passkontroll.

### Rotasjonsmodell
- Fem par som roterer daglig: (Lag 1+2), (Lag 3+4), (Lag 5+6), (Lag 7+8), (Lag 9+10).
- Par for i dag = `((antall dager siden startdato) mod 5)`.
- Admin setter én "startdato" per periode (default = periodens startdato). Ingen kompleks kalender.
- Admin kan også manuelt overstyre dagens par ved behov (valgfritt felt for "override for dato").

### 1. Data
Ny tabell `team_kitchen_duty` (per periode):
- `period_id`, `rotation_start_date`, `manual_override_date`, `manual_override_slot_a`, `manual_override_slot_b`.
- RLS: alle innloggede kan lese; kun admin kan skrive.

### 2. Admin — Lag-fanen (`TeamsTab.tsx`)
- Nytt kort "Kjøkkentjeneste":
  - Datovelger for `rotation_start_date`.
  - Viser dagens 2 lag (navn + farge + slot-nr) og hele ukens rotasjon som liste.
  - Knapp "Overstyr i dag" → velg 2 slots manuelt.

### 3. Lederens hjemskjerm (`Home.tsx`)
- Nytt kort "Kjøkkentjeneste i dag" som kun vises når `teams_enabled = true`.
- Viser de 2 lag-badgene (samme stil som `TeamBadge`) side ved side.
- Trykk på kortet → navigerer til `/passport?kitchenDuty=1` (viser begge lag).
- Trykk på ett enkelt badge → `/passport?team=<team_id>` (kun det ene laget).

### 4. Passkontroll (`Passport.tsx`)
- Leser `?kitchenDuty=1` fra URL: aktiverer et multi-team-filter som viser deltagere i begge dagens kjøkken-lag.
- Eksisterende single-team filter (`?team=`) beholdes uendret.
- Legger til en liten "Kjøkkentjeneste i dag"-chip i filter-baren når aktiv, med X for å fjerne.

### 5. Hook
Ny `useKitchenDutyToday(periodId)` som:
- Henter `team_kitchen_duty` for perioden og `participant_teams` (slot 1–10).
- Regner ut dagens par (eller bruker override hvis satt for i dag).
- Returnerer `{ teamA, teamB }` (fulle team-objekter med navn/farge/slot).

### Teknisk oppsummering
- Migrering: `team_kitchen_duty` + GRANTs + RLS (admin write, authenticated read) + `updated_at`-trigger.
- Frontend: `useKitchenDutyToday`, kort i `TeamsTab`, kort i `Home`, URL-param-håndtering i `Passport`.
- Ingen endringer i eksisterende team- eller passregistrerings-logikk.