## Mål
Admin kobler til et Google Sheet og trykker "Synk nå" for å oppdatere ledere + leder-innhold med samme felter som dagens lim-inn-funksjon (Tlf, Navn, Aktivitet, Notater, Til deg, OBS!, Ekstra #1–5, Hytte, Ansvar, Ministerpost, Team).

## Trinn

### 1. Koble til Google Sheets
Bruk Lovable sin Google Sheets connector (OAuth). Når du godkjenner kobles din Google-konto, og appen kan lese ark du har tilgang til via en edge function.

### 2. Lagre hvilket ark som skal synkes
Ny rad i `app_config`:
- `key = 'google_sheet_sync'`
- `value` = JSON med `{ spreadsheetId, range, lastSyncAt }`

Ingen ny tabell — gjenbruker eksisterende `app_config`.

### 3. Edge function: `sync-leaders-from-sheet`
- Kalles fra admin med spreadsheetId + range
- Henter rader via `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/{id}/values/{range}`
- Header-rad gjenkjennes med samme aliaser som `PasteLeaderContentSheet` (Tlf, Navn, Aktivitet, …)
- Matcher mot `leaders` på telefon (siste 8 siffer), så navn
- Oppdaterer `leaders` (Tlf, Hytte, Ministerpost, Team) og upserter `leader_content` (Aktivitet, Notater, Til deg, OBS!, Ekstra #1–5, Ansvar)
- Returnerer `{ matched, updated, unmatched: [...navn] }`

### 4. UI i admin
Ny seksjon i `AdminSettingsContent` ("Google Sheet sync"):
- Input for Spreadsheet-URL/ID + range (default `Ark1!A1:Z1000`)
- "Lagre kobling"-knapp → skriver til `app_config`
- "Synk nå"-knapp → kaller edge function, viser resultat (matched/updated/unmatched) i samme stil som lim-inn-forhåndsvisningen
- Viser sist synket-tidspunkt

### 5. Hjelpetekst
Liten guide: "Del arket med Google-kontoen som er koblet til. Første rad må være headere: Tlf, Navn, Aktivitet, …"

## Tekniske detaljer
- Connector: `google_sheets` (krever `standard_connectors--connect` først)
- Edge function bruker `LOVABLE_API_KEY` + `GOOGLE_SHEETS_API_KEY` via gateway, `verify_jwt = false` med manuell admin-sjekk i koden (kun `is_admin()` får kjøre)
- Parser/matcher-logikk lånes direkte fra `PasteLeaderContentSheet.tsx` (HEADER_ALIASES, normPhone, field-mapping) — flyttes til en delt utility i `src/lib/leaderImportParser.ts` så både lim-inn og sheet-sync bruker samme kode
- Ingen endring av RLS — edge function bruker service role for skriving
- Ingen sletting av ledere; kun oppdatering av matchede rader

## Ikke berørt
Eksisterende lim-inn-funksjon, andre admin-faner, RLS, auth, design system, leder-app for vanlige brukere.
