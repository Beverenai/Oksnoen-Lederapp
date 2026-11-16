# Project rules

## Hub-API (MCP) skal følge med på alle endringer

`supabase/functions/hub-api/index.ts` gir admin-dashboardet og AI-assistenter lesetilgang til data fra denne appen. Den må holdes i takt med appen:

- **Ny funksjon med egne data** (ny tabell, eller nye felt admin bør kunne se): legg til et nytt verktøy i `tools`-listen i hub-API-et, eller utvid et eksisterende, i samme endring.
- **Endring i en tabell eller et felt hub-API-et leser** (nytt navn, fjernet, ny betydning): oppdater verktøyene som bruker den, i samme endring. Søk etter tabellnavnet i `supabase/functions/hub-api/index.ts` før du endrer databasen.
- **Etter hver endring i hub-API-et:** øk `SERVICE_VERSION`, publiser funksjonen `hub-api` på nytt, og kjør verktøyet `helsesjekk`. Alle verktøy skal være grønne.
- Hub-API-et er **bare lesing**. Legg aldri til verktøy som endrer data.
- Behold tilgangskontrollen (`HUB_API_KEY`) og loggingen til `hub_api_log` uendret.
- Disse opplysningene skal aldri ut gjennom hub-API-et: sykepleiernotater, hendelser, fritekstnotater på deltakere og kontaktinfo til foresatte.
