# Plan for å fikse Æ/Ø/Å-problemet helt

## Mål
Sørge for at deltakerimport håndterer norske tegn korrekt hver gang, og rydde opp i deltakere som allerede har blitt lagret med ødelagte tegn.

## Hva jeg vil gjøre
1. **Herd importen i appen**
   - Forbedre CSV-dekodingen slik at importen ikke bare prøver én fallback, men også normaliserer vanlige mojibake-mønstre før data sendes videre.
   - Sikre at både navn, hyttenavn og romverdier som `høyre` / `venstre` blir normalisert før preview og import.

2. **Legge inn server-side beskyttelse i backend-funksjonen**
   - Normalisere tekst en gang til i importfunksjonen, så dårlige tegn ikke kan slippe gjennom selv om en fil eller klient oppfører seg rart.
   - Bruke samme normalisering på `firstName`, `lastName`, `cabinName`, `room`, `info` og relevante aktivitets-/tekstfelter.

3. **Rydde opp i eksisterende ødelagte data**
   - Lage en migrering som retter opp kjente feilaktige tegnsekvenser i allerede lagrede deltakerdata.
   - Fokus på feltene som vises i skjermbildet: navn og rom/hytte-relaterte verdier.

4. **Verifisere mot visningen som fortsatt er feil**
   - Bekrefte at lister som bruker `participant.name` og `room` viser riktig etter opprydding, spesielt deltakerlister der du nå ser `�`.

## Teknisk detalj
- Frontend: `src/components/admin/ParticipantImportTab.tsx`
- Backend-funksjon: `supabase/functions/import-participants-background/index.ts`
- Datarydding: ny SQL-migrering i `supabase/migrations/`
- Berørte visninger er allerede avhengige av lagret data, så når dataene blir normalisert skal skjermbildene også bli riktige uten ekstra UI-endringer.

## Forventet resultat
- Nye importer lagres korrekt med `Æ`, `Ø`, `Å`.
- `høyre` og `venstre` fungerer stabilt i import og visning.
- Eksisterende deltakere med `�` eller feil norske bokstaver blir ryddet opp.