# Leirskole-admin: én ukesoversikt + full auto-generering

## Problemet nå
Admin-siden er 4 steg med 8 kort inni. Ukeplan, kjøkken, vaktplan og aktiviteter vises hver for seg, så ingen skjerm gir hele uken i ett blikk. Å fylle ut uken krever mange manuelle valg før generatoren kan kjøre.

## Det vi bygger

### 1. Ny toppseksjon: "Uken" (ett bord, hele uken)
En fast matrise øverst på `/admin/leirskole`, over stegene:

```text
             MAN      TIR      ONS      TOR      FRE
Økt 1      Kano     Bue      Kajakk   Fisking  Klatring
           Anna     Per      Ida      Ola      Anna
Økt 2      Klatring Kano     Bue      Kano     Fri
           Per      Ida      Ola      Anna     —
Økt 3      Bruskass Fri      Kano     Bue      Avreise
Måltid     Anna+Per Ida+Ola  ...
Kjøkken    Sara     Sara     Jonas    Jonas    Sara
Nattevakt  Ola      Anna     Per      Ida      —
Timer/dag  7.5t     8t       8t       7t       4t
```

- Kolonne per dag (også ankomst/avreise med egne økter), rad per økt + måltid, kjøkken, nattevakt, sum timer.
- Hver celle viser aktivitet(er) + tildelte ledere med avatar. Klikk på celle åpner et lite ark for å bytte aktivitet eller leder — samme lagring som i dag.
- Fargekoding: grønn = fylt og bemannet, gul = aktivitet uten leder, grå = fri/tom, rød = brudd på 8t-regel eller manglende kompetanse.
- Under bordet: en kompakt "Timer per leder"-rad så det er lett å se at alle nærmer seg 8t/dag.

### 2. Én knapp: "Generer hele uken"
Kjører alt i riktig rekkefølge i én operasjon:
1. Fyll tomme ukeplan-ruter med tilfeldig utvalg fra de aktive aktivitetstypene (rullerer så samme aktivitet ikke gjentas dag etter dag, og respekterer ruter du allerede har fylt ut / låst).
2. Generer vaktplanen (8t/dag, 11t hvile, sammenhengende vakter, maks 2 på måltid, 4 på Sanitas, kjøkkenvakter holdes utenfor).
3. Fordel aktivitetene til lederne etter kompetanse, rullering og "ikke samme som forrige økt".

Knappen får en liten meny med:
- **Tilfeldig ukeplan** (bare steg 1)
- **Generer alt** (steg 1–3)
- **Generer på nytt uten å endre ukeplan** (steg 2–3)

Alt du har endret manuelt låses og overskrives ikke; resten balanseres på nytt. Etter kjøring viser et lite sammendrag hva som ble satt og hvilke huller som gjenstår (aktivitet uten kvalifisert leder).

### 3. Ryddigere layout
- Toppkortet beholdes, men stat-boksene reduseres til det som betyr noe: ledere, vakter, timer, publisert.
- Stegene under bordet blir 3 i stedet for 4: **Uken** (ukeplan + aktivitetstyper + kjøkken), **Oppgaver**, **Ledere**. Vaktplan-kortene flyttes inn under bordet siden bordet nå er hovedvisningen.
- Guide-kortet blir en liten "?"-knapp i toppkortet i stedet for et eget kort.

## Teknisk
- Ny `src/components/admin/LeirskoleWeekBoard.tsx` (matrisen) + `LeirskoleCellSheet.tsx` (rediger celle).
- Ny `src/lib/leirskoleRandomPlan.ts` — tilfeldig, rulleringsbevisst fylling av `leirskole_week_plan_cells` fra aktive `leirskole_activity_types`.
- Ny orkestrering i `src/lib/leirskoleGenerateAll.ts`: random plan → `generate-leirskole-schedule` (uendret edge function) → `autoAssignWeek` (gjenbrukes som den er).
- `LeirskoleAdmin.tsx` omstruktureres til bord + 3 steg; eksisterende kort gjenbrukes uendret der de fortsatt trengs.
- Ingen skjemaendringer i databasen.
