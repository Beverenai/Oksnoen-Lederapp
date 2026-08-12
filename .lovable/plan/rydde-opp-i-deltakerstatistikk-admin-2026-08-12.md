# Rydde opp i Deltakerstatistikk (admin)

Målet: siden skal gi mening ved første blikk, og på iPhone skal funksjonsknappene ligge rett under tittelen — ikke langt nede etter en høy statistikkboks.

## Ny struktur

1. **Stram topp**: mindre luft over, kompakt tittel «Deltakere».
2. **Statistikk blir en tynn linje**: dagens store statistikkort kollapses til én rad med nøkkeltall (ankommet / totalt, bursdager, mangler aktivitet) som kan utvides med et trykk. Utvidet visning er akkurat som i dag (aldersfordeling, bursdagsliste, ikke ankommet, mangler aktivitet). Standard: lukket på telefon, åpen på PC.
3. **Funksjoner grupperes etter tema med overskrifter** i stedet for én lang rekke med 14 like kort:

```text
Bo & rom           Hytter i bruk · Rombytter · Hytterapporter · Utsjekk
Aktiviteter & lag  Aktiviteter · Lederaktivitet · Styrkeprøven · Lag · Ambassadører
Oppfølging         Hendelser · Deltakeroppdrag · Dynga · Hemmelige Ord
Penger & data      Gomla · Eksporter
```

Kortene beholder ikonene og fargene sine, men blir litt lavere så flere synes uten scrolling. Overskriftene er små, i store bokstaver, med skillelinje.

## Hva som ikke endres

- Alle funksjoner beholdes — ingenting fjernes eller flyttes til en annen side.
- Innholdet i hver enkelt fane er urørt.
- Undersidene (når man har åpnet en fane) fungerer som før, bare med litt strammere topp på mobil.

## Teknisk

- `src/pages/admin/ParticipantStats.tsx`: erstatt flat `navItems`-array med grupper (`{ title, items[] }`), render seksjonsoverskrift + `grid-cols-2` per gruppe (3 kolonner på lg). Legg Dynga inn i «Oppfølging» og Eksporter i «Penger & data» i stedet for som løse kort. Reduser `py-6` til responsiv `pt-3 pb-6 sm:py-6` og kortpadding til `p-3 sm:p-4`.
- `src/components/admin/ParticipantStatsCard.tsx`: pakk innholdet i en `Collapsible` med en kompakt sammendragsrad som trigger; default lukket under `sm`, åpen fra `sm` og opp. Ingen endring i datalasting eller spørringer.