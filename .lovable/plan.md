## Mål

- Ingen automatisk sync (verken inn eller ut). Kun når du trykker "Sync".
- App-redigering lagres umiddelbart i databasen (som i dag) — ingen refresh, ingen tap av data.
- Sheet er fortsatt admin sin "hurtig-inntasting" for økter/info.
- App overskriver ALDRI sheet-felt uten at du trykker sync.
- Sheet overskriver ALDRI manuelle app-endringer som ikke er sendt til sheet enda.
- Sync-knappen blir tydelig markert når det finnes uleste app-endringer.

## Hvordan vi løser konflikten

Vi bruker en enkel "dirty flag" pr. leder: et tidsstempel som viser når lederen sist ble redigert i appen, og et som viser når den sist ble synket til sheet.

Regel under sync (én knapp gjør begge veier):

1. **Eksport først (app → sheet):** Send kun ledere der `last_app_edit_at > last_synced_at` (de som er "dirty"). Resten røres ikke i sheet.
2. **Import etterpå (sheet → app):** For hver rad i sheet, oppdater leder i appen — men hopp over felter som er dirty (siden vi nettopp pushet dem opp). Felter brukerne ikke har endret i appen, blir alltid friske fra sheet.
3. Når sync er ferdig: sett `last_synced_at = now()` på alle synkede ledere → de blir "clean" igjen.

Resultat: Du kan redigere fritt i appen uten frykt for at neste import sletter det. Og admin kan skrive økter i sheet uten frykt for at appen overskriver.

## Endringer

### Database
- Legg til kolonne `last_app_edit_at timestamptz` på `leaders` (default `now()`).
- Legg til kolonne `last_synced_at timestamptz` på `leaders` (nullable).
- Trigger som setter `last_app_edit_at = now()` ved UPDATE fra app (men IKKE når `sync-leaders-import` skriver — den edge-funksjonen setter feltet eksplisitt til den gamle verdien for å ikke markere som dirty).

Tilsvarende for `leader_content` (samme kolonner + trigger) siden current_activity/obs/extra også redigeres begge steder.

### Edge functions
- **`trigger-export`:** Endre fra "send alle aktive" til "send kun dirty" (`last_app_edit_at > last_synced_at OR last_synced_at IS NULL`). Etter vellykket 200 fra n8n, oppdater `last_synced_at = now()` for de eksporterte radene.
- **`sync-leaders-import`:** Når n8n poster en rad tilbake, sjekk om noen felter er dirty i app. Behold app-versjonen for de feltene; oppdater de andre. Sett `last_synced_at = now()` etterpå.
- **Ingen endring i `trigger-sync`** — den fyrer fortsatt n8n-importen.

### Frontend (`src/pages/admin/Admin.tsx`)
- **Fjern auto-export:** Slett `scheduleAutoExport`, `exportTimerRef`, `countdownIntervalRef`, `pendingExport`, `exportCountdown`. Ingen 30-sek timer mer.
- **Fjern alle kall til `scheduleAutoExport`** fra steder som redigerer ledere.
- **Behold:** Auto-save av leder-felt i `LeaderDetailDialog` (skriver kun til DB — det er det vi vil).
- **Sync-knappen:**
  - Hent antall dirty ledere (count med `last_app_edit_at > last_synced_at`).
  - Hvis > 0: vis knappen i `variant="default"` med pulserende ring + badge "N endringer venter".
  - Hvis 0: vanlig outline-knapp.
  - Knappen kjører nå: `triggerExport()` (kun dirty) → vent på 200 → `triggerSync()` (importer fra sheet).
- **Realtime på `leaders`** beholder vi (oppdaterer admin-listen live etter import).

### UX-tekst
- Tooltip på sync-knappen: "Sender dine endringer til Sheet og henter nye økter/info derfra."
- Når ingen dirty: knappen sier "Synk med Sheet". Når dirty: "Synk (3 endringer venter)".

## Hva blir igjen som "automatisk"
Kun realtime-oppdatering av admin-listen i UI (når andre admins eller import skriver). Ingen webhook-trafikk uten knappetrykk.

## Filer som endres
- ny migrasjon (kolonner + triggere)
- `supabase/functions/trigger-export/index.ts`
- `supabase/functions/sync-leaders-import/index.ts`
- `src/pages/admin/Admin.tsx`
- liten visuell oppdatering på sync-knappen i `Admin.tsx` (badge + pulse)

## Spørsmål før jeg bygger
1. Skal `leader_content` (current_activity, OBS, extra_1–5) følge samme dirty-logikk, eller alltid hentes friskt fra sheet (admin skriver disse der)?
2. Hvis admin endrer både i app OG i sheet på samme leder mellom to syncs — hvem vinner? Forslaget over lar **app vinne** (dirty felt overskrives ikke av sheet). OK?