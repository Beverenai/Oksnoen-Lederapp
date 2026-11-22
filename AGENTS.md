# Project rules

## Hub-API (MCP) skal følge med på alle endringer

`supabase/functions/hub-api/index.ts` gir admin-dashboardet og AI-assistenter lesetilgang til data fra denne appen. Den må holdes i takt med appen:

- **Ny funksjon med egne data** (ny tabell, eller nye felt admin bør kunne se): legg til et nytt verktøy i `tools`-listen i hub-API-et, eller utvid et eksisterende, i samme endring.
- **Endring i en tabell eller et felt hub-API-et leser** (nytt navn, fjernet, ny betydning): oppdater verktøyene som bruker den, i samme endring. Søk etter tabellnavnet i `supabase/functions/hub-api/index.ts` før du endrer databasen.
- **Etter hver endring i hub-API-et:** øk `SERVICE_VERSION`, publiser funksjonen `hub-api` på nytt, og kjør verktøyet `helsesjekk`. Alle verktøy skal være grønne.
- Hub-API-et er **bare lesing**. Legg aldri til verktøy som endrer data.
- **Nye funksjoner skal være klare for MCP og se bra ut der** (bestemt av August 16.11.2026). Når appen får en ny funksjon eller nye data, skal hub-API-et kunne lese dem i samme endring, slik at admin og Grok, Claude og ChatGPT kan bruke dem. Svar som er til for å vises (et barn, en leder, en dag), får et kort i admin-huben (`Beverenai/camp-operations-hub`, `src/lib/mcp/apps/`) i admin-designet. Gi derfor hub-API-et strukturerte felt (navn, tidspunkt, bilde-URL, hvem som registrerte) i stedet for ferdig tekst.
- Behold tilgangskontrollen (`HUB_API_KEY`) og loggingen til `hub_api_log` uendret.
- **Admin skal kunne lese alt** (bestemt av August 16.11.2026). Verktøyene `datakart` og `rader` åpner hver tabell som står i `TABELLER`. En ny tabell må legges til der, med område og beskrivelse, i samme endring som den lages.
- Disse skal aldri ut gjennom hub-API-et: PIN-koder (`admin_pins`), push-nøkler (`push_subscriptions`), `app_config`, og det sosiale mellom lederne (sveip, match, meldinger, spill). Avsender på anonyme meldinger i postkassen skal alltid skjules.

- Arrival history is written by database triggers; bulk controls use the security-invoker RPC so existing participant permissions remain authoritative.
- Session saves use a shared config-and-history writer and report partial failures explicitly so missing history cannot be presented as a successful save.
- Activity registration uses a fresh session UUID per scanner registration or manual batch, preserved in the offline queue, so only same-session duplicates are rejected.
- Registration confirmations use a scoped popup hook, preserving the rest of the app's notification behavior.
- Period leader activity summaries read period_leaders and date-bounded records under existing RLS, rather than global active-leader membership.
- Period registration summaries page through all matching records so API row limits cannot silently truncate counts.
- Phone login validates the number before requesting a PIN challenge and clears stale PIN state on lookup failures, so unknown users stay on the phone form.
