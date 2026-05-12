## Problem
1. **Eksport feilet 500**: n8n-webhooken er bygd for å motta ALLE ledere (clear & write all rows). Da vi byttet `trigger-export` til kun å sende "dirty" ledere, brekker n8n-flyten.
2. **Lagring føles treg**: 1000 ms debounce + statusen "Lagret" vises først etter at DB-kallet kommer tilbake. Det føles som om endringer ikke lagres.
3. **Sync tar lang tid**: n8n kaller `sync-leaders-import` mange ganger (per rad) og hver runde sletter+innsetter `leader_cabins` for alle 32 ledere — tung jobb.

## Løsning

### 1. Restore export-kompatibilitet med n8n (uten å gi opp "app vinner")
Endre `trigger-export` tilbake til å sende **alle aktive ledere** slik n8n forventer. Dirty-flagget brukes ikke lenger til å filtrere eksport, men:
- Etter vellykket eksport: sett `last_synced_at = now()` på alle aktive rader (nullstiller dirty).
- Importsiden (`sync-leaders-import`) beholder dirty-beskyttelsen som før: hvis admin har endret en leder i appen etter siste sync, blir ikke disse feltene overskrevet av sheet-data.

Dette betyr i praksis:
- Sheet → App: app-endringer beskyttes mellom syncer (uendret oppførsel).
- App → Sheet: når brukeren trykker Sync, sendes hele settet (n8n trenger dette for "clear & write"-flyten).
- App overskriver aldri sheet uten manuell sync (fordi vi ikke auto-syncer lenger).

Det dekker brukerens kjernekrav: "ikke trykker sync ⇒ appen overskriver ikke sheet".

### 2. Raskere oppfattet lagring i `LeaderDetailDialog`
- Reduser debounce fra 1000 ms → **350 ms**.
- Vis "Lagrer…" umiddelbart når et felt endres (i stedet for å vente på debounce).
- Behold flush-på-lukk så ingen data går tapt hvis admin lukker raskt.

### 3. Raskere `sync-leaders-import`
- Hopp over `leader_cabins` delete/insert hvis hyttesettet er uendret (sammenlign nåværende set med ønsket set først).
- Beholder all eksisterende matching/alias-logikk.
- Reduserer skrivinger fra ~30 inserts × N invocations til 0 når ingenting har endret seg.

### Filer som endres
- `supabase/functions/trigger-export/index.ts` — sende alle aktive igjen, men fortsatt markere `last_synced_at`.
- `supabase/functions/sync-leaders-import/index.ts` — diff-sjekk for cabin-links.
- `src/components/admin/LeaderDetailDialog.tsx` — kortere debounce + umiddelbar "Lagrer"-status.

Ingen DB-migrasjoner trengs (kolonnene finnes allerede).

### Det dette IKKE løser
Hvis n8n-webhooken fortsatt returnerer 500 etter denne endringen, ligger feilen i n8n-flyten selv (f.eks. Google Sheets-noden). Da må vi se på n8n-execution-loggen for å finne årsaken — det kan ikke fikses fra appen.