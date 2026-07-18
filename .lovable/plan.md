## Gensere (Sweater pickup) feature

En ny funksjon som lar ledere krysse av om deltagere har hentet forhåndsbestilt genser, eller kjøpt en på leir — med størrelse. Fungerer som Passkontroll (søk + kryss av). Kan skrus av/på fra admin (kun aktiv første dagen). Skopet til aktiv periode.

### Datamodell

Ny tabell `participant_sweaters` (period-scoped):
- `participant_id` (fk), `period_id` (fk)
- `preordered_size` (text, nullable) — fra importert liste ("s", "m", "l", "xl", "xs" osv.)
- `picked_up` (boolean)
- `picked_up_at` (timestamptz)
- `bought_on_camp` (boolean)
- `bought_size` (text, nullable)
- `bought_at` (timestamptz)
- Unique (participant_id, period_id)
- RLS: leser for authenticated (aktive ledere), skriving for authenticated, full for service_role
- GRANTs som vanlig

Ny `app_config` nøkkel: `sweaters_enabled` (true/false) — realtime-hook `useSweatersEnabled` som styrer synlighet.

### Import

Admin-fane "Gensere" får en import-boks som tar Excel/CSV/tekst i formatet:
```
Navn | Etternavn | Forhåndsbestilt | Hentet | Kjøpt på leir
```
- Matcher deltager på fullt navn (fornavn + etternavn, case-insensitive, trim).
- Setter `preordered_size` fra kolonne C. Kolonne D/E ignoreres ved import (de fylles i appen).
- Rapport: X matchet, Y ikke funnet (vises som liste).

### Admin (Innstillinger → Deltakere)

Ny tab `SweatersTab.tsx`:
- Toggle "Aktiver Gensere i appen" (skriver `sweaters_enabled`).
- Import-boks (paste liste eller last opp `.xlsx`/`.csv`).
- Oversikt: antall forhåndsbestilte, antall hentet, antall kjøpt på leir, per størrelse.
- **"Kopier arket"-knapp**: kopierer full tabell til clipboard i samme kolonneformat (Navn, Etternavn, Forhåndsbestilt, Hentet, Kjøpt på leir) med avkrysningsstatus + valgt størrelse — klar til å limes tilbake i Excel/Sheets.
- Eksporter som `.xlsx` (samme format).

### Leder-side: `/gensere`

Ny rute + nav-ikon (kun synlig når `sweaters_enabled = true`, akin til Checkout-mønsteret):
- Layout kopiert fra Passport: søk, filter på hytte/lag, virtualisert liste.
- Deltager-kort viser: navn, hytte, forhåndsbestilt størrelse (badge), status.
- Trykk på kort → sheet med to seksjoner:
  - **Hentet**: toggle-knapp, viser forhåndsbestilt størrelse (kan overstyres hvis feil).
  - **Kjøpt på leir**: toggle + størrelses-velger (XS/S/M/L/XL/XXL).
- Skiller "Trenger genser" fra "Ferdig" (som Checkout gjør med `pass_written`).

### Filer som lages/endres

- `supabase/migrations/...` — ny tabell + GRANTs + RLS + policies + trigger `set_period_id_default`.
- `src/hooks/useSweatersEnabled.ts` — realtime `app_config` flag.
- `src/hooks/useSweaters.ts` — spørring per periode.
- `src/components/admin/SweatersTab.tsx` — admin-UI (toggle, import, oversikt, kopier, eksport).
- `src/pages/Gensere.tsx` — leder-side (søk + kryss av).
- `src/components/gensere/SweaterDetailSheet.tsx` — detalj-sheet per deltaker.
- `src/App.tsx` — route `/gensere`.
- `src/components/layout/AppLayout.tsx` (eller nav-komponent) — bunn-nav-ikon gated på flag.
- `src/pages/admin/AdminSettings.tsx` eller `ParticipantStats.tsx` — legg til ny tab.

### Åpne spørsmål

1. Hvor skal admin-fanen ligge — under **Innstillinger** eller under **Deltaker-statistikk** (der Ambassadører/Lag ligger)?
2. Skal ikonet for `/gensere` vises i bunn-nav for alle ledere, eller bare admin? (Passkontroll er for alle ledere — antar samme her.)
