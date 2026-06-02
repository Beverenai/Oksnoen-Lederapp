## Mål
Når CSV-en inneholder en Seilern-hytte (f.eks. `Seilern Haui`, `Seileren Maui`, `Seilern tipi`), skal importen rute deltakeren til riktig eksisterende hytte i databasen. Under-hyttene beholdes som egne `cabins`-rader (slik de er nå).

## Bakgrunn
I databasen finnes:
- Hovedoppføring: `Seileren`
- Under-hytter: `Seilern Haui`, `Seilern Halua`, `Seilern Maui`, `Seilern Tipi`, `Seilern Oahu`, `Seilern Honolulu`, `Seilern Hawaii`, `Seilern Waikikii`

CSV-en bruker trolig varianter som `Seileren Haui` / `seilern  maui` / `Seilern haui venstre`. I dag stripper `parseCabinField` bare ` venstre` / ` høyre` og sender resten videre som hyttenavn — så ekstra mellomrom, stor/liten bokstav, og "Seileren" vs "Seilern" gir bom.

## Endringer

### 1) `src/components/admin/ParticipantImportTab.tsx` — `parseCabinField`
- Normaliser whitespace (kollapser doble mellomrom, trimmer).
- Behold eksisterende håndtering av ` venstre` / ` høyre` suffiks.
- Etter suffiks-strip: hvis navnet starter med `seileren ` eller `seilern `, normaliser til `Seilern <Sub>` med stor forbokstav på under-navnet, slik at det matcher kanoniske rader (`Seilern Haui`, `Seilern Maui`, osv.).
- Hvis navnet er bare `seileren` / `seilern` uten suffiks, behold `Seileren` (hovedbygget).

### 2) `supabase/functions/import-participants-background/index.ts` — match mot `cabins`
- Gjør cabin-oppslaget case-insensitivt og whitespace-tolerant (`lower(trim(replace_double_spaces(name)))`) på begge sider, så små variasjoner i CSV ikke gir "cabin ikke funnet"-feil.
- Hvis CSV-en gir `Seilern X` men DB tilfeldigvis bare har `Seileren X` (eller omvendt), prøv også begge formene som fallback før vi gir opp.

### 3) Brukerinfo i import-UI
- I "Støttede kolonner"-boksen i `ParticipantImportTab.tsx`, legg til en kort linje som forklarer at både `Seilern Haui`, `Seileren Haui` osv. fungerer, og at " venstre"/" høyre" kan legges til på slutten som før.

## Ikke i scope
- Ingen schema-endringer.
- Ingen sammenslåing av Seilern-under-hyttene til `room`-felt på en `Seileren`-rad (det var alternativ 2; ble valgt bort).
- Ingen sletting/flytting av eksisterende deltaker-data.

## Verifisering
- Last opp en test-CSV med blanding av `Seilern Haui`, `Seileren maui`, `SEILERN  TIPI`, `Seilern Oahu venstre` → alle skal vises som "gyldige" i forhåndsvisningen og lande på riktig hytte i `participants.cabin_id`.
- Eksisterende `Knoll venstre` / `Knoll høyre`-flyt skal være uendret.