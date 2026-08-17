# Egne aktiviteter for leirskole — med av/på per økt

I dag er aktivitetene (Tube, Klatring, Rappellering, Kanotur, Båtkjøring, Badevakt) hardkodet i appen. Du kan verken legge til nye eller styre hvilke som skal brukes i en enkelt økt.

## Hva du får

**1. Egen aktivitetsliste (admin)**
Et nytt kort i Leirskole-admin: «Aktiviteter» der du kan
- legge til nye aktiviteter (navn + emoji)
- endre navn/emoji
- slå aktiviteten av/på globalt (av = brukes ikke, men historikken beholdes)
- slette aktiviteter du ikke bruker
- sortere rekkefølgen

De seks eksisterende aktivitetene legges inn som standard, så ingenting forsvinner.

**2. Velg aktiviteter per økt**
I «Aktiviteter per økt» (der du velger dag og formiddag/ettermiddag) får du en rad med aktivitetsbrikker. Du trykker dem av/på for å bestemme hvilke aktiviteter som skal fordeles i nettopp den økta — noen ganger fire, noen ganger alle. Valget lagres per dag + økt, så det ligger klart neste gang du åpner samme økt.

«Generer» og «Generer hele dagen» bruker kun de aktivitetene som er slått på for økta. Er ingen valgt, brukes alle aktive aktiviteter (som i dag).

**3. Kompetanse følger listen**
Kompetansevalget på hver leder bygger på samme liste, så nye aktiviteter blir automatisk mulige å krysse av som kompetanse. Fordelingen er fortsatt rettferdig (færrest ganger først) og respekterer kompetanse.

## Teknisk

- Ny tabell `leirskole_activity_types`: `key`, `label`, `emoji`, `is_active`, `sort_order`, tidsstempler. GRANT + RLS: alle innloggede kan lese, admin/superadmin kan endre. Seedes med dagens seks aktiviteter.
- Ny tabell `leirskole_session_activities`: `week_id`, `date`, `session`, `activity_keys text[]` (unik per uke/dato/økt) for hvilke aktiviteter som er valgt i økta.
- `src/lib/leirskoleActivities.ts` gjøres datadrevet: `activityLabel`/`activityEmoji` slår opp i en liste som sendes inn i stedet for konstanten; `generateActivityAssignments` tar allerede en aktivitetsliste som argument.
- Nye hooks i `src/hooks/useLeirskole.ts`: `useLeirskoleActivityTypes` (+ mutasjoner for add/update/delete) og `useLeirskoleSessionActivities` (les/lagre valg per økt).
- `LeirskoleActivityCard.tsx`: aktivitetsbrikker med av/på, og generering filtrert på valget.
- Nytt `LeirskoleActivityTypesCard.tsx` i Leirskole-admin for å administrere listen.
- `LeirskoleCompetenceSheet.tsx` og `LeirskoleLeaderSheet.tsx` leser aktivitetene fra databasen i stedet for konstanten.
