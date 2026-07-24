# Periode-arkiv + Inaktiv-modus med chat

## Del 1 — Sikre og arkivere periode 4-data

**Verifisering (ingen datamigrering nødvendig):**
Alle sentrale tabeller er allerede `period_id`-scopet: deltakere (inkl. bilder via `image_url`/thumb), aktiviteter, Dynga (cards+columns), nurse (reports/notes/events/health_info), hendelser, sveitere, hemmelige ord, hytterapporter, Fix, Gjenglemt, rombytter, tau-kontroll, roulette-tildelinger, booking, teams + bonus, storiesm.m. Bilder ligger i Storage-buckets og bindes til deltaker-rader — de forsvinner ikke ved periodebytte.

Handling:
- Kjør en verifikasjons-migrering som legger til CHECK-triggere som forhindrer sletting av rader i historiske perioder (kun aktiv periode + service_role kan slette).
- Legg til `archived_at`-tidsstempel på `periods` (settes automatisk når `is_active` går fra true → false).

**Arkiv-visning i admin:**
Ny side `/admin/arkiv` (kun admin/superadmin):
- Periode-velger (alle perioder utenom aktiv).
- Faner: Deltakere (grid m/ bilder + søk), Aktiviteter (aggregert), Dynga (read-only board), Nurse (rapport-eksport), Hendelser, Lag & poeng, Hytterapporter, Gjenglemt, Sveitere.
- Alt skrivebeskyttet — gjenbruker eksisterende komponenter med `readOnly`-prop der det finnes, ellers wrapper som deaktiverer mutasjoner.
- «Eksporter periode» knapp: samler nurse-rapport (HTML), CSV over aktiviteter/poeng, og lister til nedlasting.

## Del 2 — Inaktiv-modus (global bryter, superadmin-styrt)

**Datamodell:**
- Utvid `app_config` med `app_mode` (`'active' | 'inactive'`). Standard `'active'`.
- Kun superadmin kan sette (RLS-policy + UI).

**Gating i frontend:**
- Ny `useAppMode()`-hook med realtime-subscribe på `app_config`.
- I `AppLayout`: når `app_mode === 'inactive'` og bruker ikke er superadmin → alle ruter unntatt `/chat` og `/profile` redirecter til `/chat`. Bunn-nav byttes ut med minimal versjon (Chat + Profil).
- Superadmin ser en banner «Appen er i inaktiv-modus» og beholder full tilgang.
- Ny superadmin-kort i AdminSettings: «Sett app til inaktiv / aktiv» med bekreftelses-dialog.

## Del 3 — Global chat

**Datamodell (ny migrering):**
- `chat_messages(id, leader_id, body text, created_at)` — én global kanal.
- GRANTS: `authenticated` full CRUD på egne, SELECT alle; `service_role` ALL.
- RLS: alle aktive ledere kan lese; kun forfatter kan slette egen melding; superadmin kan slette alle; INSERT krever `leader_id = current_leader_id()` og `leaders.is_active = true`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages`.
- Ingen periode-scoping — meldinger persisterer på tvers av perioder/år (som ønsket for «chat mellom sesonger»).

**UI (`/chat`):**
- Enkel meldingsliste (navn + `image_url_thumb` fra `leaders`) med auto-scroll og realtime.
- Kun tekst i første versjon (utvidbart senere).
- Tilgjengelig kun når `app_mode === 'inactive'` (rute-guard); superadmin kan alltid åpne.
- Debounced typing er ikke nødvendig — vanlig submit på Enter.

## Filer som endres/opprettes

**Migreringer:**
- `app_config`: `app_mode` kolonne + policy for superadmin-write.
- `periods.archived_at` + trigger.
- Ny tabell `chat_messages` med RLS/GRANTS/realtime.
- Slettings-guard trigger på historiske periode-rader (deltakere, aktiviteter, dynga, nurse osv.).

**Frontend:**
- `src/hooks/useAppMode.ts` (ny)
- `src/components/layout/AppLayout.tsx` (gate ruter i inaktiv-modus)
- `src/pages/Chat.tsx` (ny)
- `src/pages/admin/Arkiv.tsx` (ny) + underkomponenter som gjenbruker eksisterende visninger read-only
- `src/pages/admin/AdminSettings.tsx` (kort for app-modus, kun superadmin)
- `src/App.tsx` (ruter: `/chat`, `/admin/arkiv`)

**Ingen endring på:** eksisterende ShiftPlanner, passgenerator, checkout-flow, deltaker/leder-CRUD.

## Manuelle steg etter deploy
1. Godkjenn migreringer.
2. Verifiser at `app_mode` starter som `'active'`.
3. Test inaktiv-modus i en test-økt før faktisk sesongslutt.
4. Når P4 er ferdig: skru på inaktiv-modus → bytt til P5 senere ved å reaktivere + sette ny aktiv periode.