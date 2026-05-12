## Hva som skjer nå

Etter å ha sett på edge-funksjonene og loggene er bildet ganske tydelig:

- `trigger-sync` kjører fint og kaller n8n-webhooken — den får 200 OK tilbake.
- n8n leser Google Sheet og formaterer dataene riktig (bekreftet i flow-bildet ditt).
- **MEN: `sync-leaders-import` har null logger.** Det betyr at n8n sin POST tilbake til denne edge-funksjonen **aldri når frem**.
- **`trigger-export` har også null logger** — den blir ikke kalt i det hele tatt.

## Hvorfor `sync-leaders-import` aldri kjører

Edge-funksjoner i Lovable Cloud krever JWT-validering by default. I prosjektet vårt er det kun `phone-login` som er åpnet for kall uten JWT (`verify_jwt = false` i `supabase/config.toml`).

Når n8n POST-er til `https://noxnbtvxksgjsqzfdgcd.supabase.co/functions/v1/sync-leaders-import` uten en gyldig Supabase Bearer-token, blir kallet avvist på Supabase-nivå med 401 *før* funksjonen i det hele tatt får boote. Derfor får vi:
- Ingen logger på funksjonen
- Ingen ledere oppdatert
- n8n får 401 i Sheets-flowen sin (sjekk siste node etter "Format Sheet Data for App")

## Hvorfor eksport tilbake ikke skjer

`trigger-export` er aldri kjørt i det hele tatt i loggene. Det betyr enten at:
1. Du har ikke trykket "eksport"-knappen i admin (kun "Synk ledere"), eller
2. `export_webhook_url` er ikke satt i `app_config`, så funksjonen aldri når n8n-flowen i bilde 2.

## Plan

### 1. Åpne `sync-leaders-import` for n8n
- I `supabase/config.toml`: legg til `[functions.sync-leaders-import]` med `verify_jwt = false`.
- Legge til en enkel delt hemmelighet (`N8N_SHARED_SECRET`) som n8n må sende i en header (f.eks. `x-n8n-secret`), og avvise alt annet i funksjonen. Slik blir endepunktet åpent for n8n men ikke for hvem som helst.
- Legge til litt mer logging øverst i `sync-leaders-import` (antall ledere, første telefonnummer, første feil) så vi kan bekrefte i loggene at n8n faktisk treffer funksjonen.

### 2. Verifisere n8n-konfigurasjonen (ting du må sjekke i n8n)
Etter at vi har gjort #1 må din n8n-flow ha en HTTP Request-node etter "Format Sheet Data for App" som:
- POST-er til `https://noxnbtvxksgjsqzfdgcd.supabase.co/functions/v1/sync-leaders-import`
- Sender body: `{ "leaders": [ ...formaterte rader... ] }` (merk: nøkkelen MÅ være `leaders` som array, det er det funksjonen forventer)
- Har header `Content-Type: application/json` og `x-n8n-secret: <samme verdi som i Supabase secret>`

### 3. Eksport tilbake (App → Sheets)
- Bekrefte at `export_webhook_url` er lagret i admin-innstillinger og peker på "Export Webhook"-noden i n8n.
- Bekrefte at admin-knappen som faktisk trigger eksport blir trykket (auto-eksport krever 30 sek timer + at webhook-URL er satt).
- Hvis 401: samme grep — sjekk auth fra n8n's side, men her er det vi som POST-er ut, så det er n8n-noden som må akseptere innkommende POST uten ekstra auth.

## Teknisk
- Filer som endres: `supabase/config.toml`, `supabase/functions/sync-leaders-import/index.ts`
- Ny secret som må legges til etterpå: `N8N_SHARED_SECRET` (du velger verdien)
- Edge-funksjoner deployes automatisk av Lovable etter endring