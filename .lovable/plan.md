
# Inaktiv-modus: full "off-season"-opplevelse

Når admin skrur på **Inaktiv** i Periode-fanen skal appen automatisk endre form for alle ledere:

- Alle ledere blir satt til `is_active = true` (så varsler når frem, og alle kan logge inn).
- Alle push-varsler går til absolutt alle ledere (ingen filtrering på periode).
- Vanlige ledere ser kun to sider i bunnmenyen: **Hjem** og **Øksnøen Chat**. Alt annet skjules.
- Hjem forenkles til en "off-season"-visning som senere skal vise deres pass (placeholder nå).
- Superadmin/admin beholder full tilgang for å styre appen.

## Endringer

### 1. Toggle-effekt (`src/components/admin/NursePeriodsTab.tsx`)
Når `app_mode` bytter fra `active` → `inactive`:
- Kall en ny Edge Function `activate-all-leaders` som setter `is_active = true` på alle rader i `leaders` (service role, superadmin-only via JWT-sjekk).
- Vis bekreftelse i StatusPopup ("Alle ledere er aktivert. Kun Hjem + Chat vises.").

Når `app_mode` bytter tilbake til `active`: ingen automatisk deaktivering (admin styrer det manuelt som før).

### 2. Ny Edge Function `supabase/functions/activate-all-leaders/index.ts`
- Verifiserer at kaller er superadmin (via `has_role` med bruker-JWT).
- Kjører `update leaders set is_active = true` med service role.
- Returnerer antall aktiverte.

### 3. Push-varsling i inaktiv modus
Oppdater `supabase/functions/push-send/index.ts` og `push-admin-alert/index.ts`:
- Les `app_config.app_mode` først. Hvis `inactive`, drop alle filtre og send til alle `push_subscriptions` som tilhører ledere (uansett `is_active`, periode, rolle).
- I aktiv modus: uendret oppførsel.

### 4. Bunnmeny i inaktiv modus (`src/components/layout/AppLayout.tsx`)
- Les `useAppMode()`.
- Hvis `mode === 'inactive'` og bruker ikke er superadmin: bunnmeny vises kun med `Hjem` og `Øksnøen Chat`. Hamburgermeny/øvrige nav-grupper skjules.
- Header/logo beholdes.

### 5. Rute-gate (`src/App.tsx`)
Allerede finnes en redirect til `/chat` for inactive. Utvides:
- Tillatte ruter for ikke-superadmin i inactive: `/`, `/chat`, `/profile`.
- Alle andre ruter redirecter til `/`.

### 6. Hjem i inaktiv modus (`src/pages/Home.tsx`)
Når `mode === 'inactive'` og ikke superadmin:
- Rendrer en enkel "off-season"-visning: velkomstkort med tekst "Sesongen er over — vi sees neste år!" og en placeholder-seksjon "Ditt pass kommer her" (tom card foreløpig, koples opp senere).
- Alle andre Home-widgets (overnatting, kjøkkentjeneste, aktiviteter osv.) skjules.

### 7. Chat-oppgradering til messenger-stil (`src/pages/Chat.tsx`)
Behold eksisterende datamodell (`chat_messages` + realtime). UI-forbedringer:
- Grupper meldinger fra samme avsender innen 5 min (skjul avatar/navn på oppfølging).
- "I dag / I går / dato"-separator mellom meldingsgrupper.
- Automatisk scroll kun hvis brukeren allerede er nær bunn.
- Enter sender, Shift+Enter = ny linje (bytt `Input` → `Textarea` med auto-grow).
- Vis "leser skriver…"-indikator via en lettvekts Realtime broadcast-kanal (`presence`/broadcast, ingen DB-endring).
- Døgnrytme: rundede bobler, samme høykontrast-tokens som i dag.
- "Sees av"-teller er utenfor scope for nå.

## Teknisk

- Ingen nye DB-tabeller. Kun ny Edge Function + små UI/logikk-endringer.
- `useAppMode` er allerede realtime, så alle klienter reagerer umiddelbart på toggle.
- Push-endringene sikrer at "Egen varsling" fra QuickNotificationSheet også når alle i inaktiv modus.

## Åpne spørsmål
Ingen — jeg antar at Chat-messenger-stilen (typing-indikator via broadcast, gruppering) er ønsket. Si fra hvis du vil droppe typing-indikator eller ha "sett av"-markører.
