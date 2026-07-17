## Mål
Rydde opp Vaktplan Mini til én enkel horisontal matrise der du ser og redigerer alt på samme sted.

## Endringer

**1. Fjern rot fra resultatvisningen**
- Slett de separate "Resultat"-, "Underbemannet"- og "Regelbrudd"-kortene.
- Advarsler flyttes inn som små inline-badges direkte på cellene/radene som er berørt (rød prikk = regelbrudd, gul prikk = underbemannet), med tooltip for detaljer.

**2. Én ren horisontal matrise**
- Rader = vakttype (Vekking, Frokost, Bings, Økt 1, Middag, Bings, Økt 2, Kveldsmat, Bings, Økt 3, Legging, Nattevakt, Seilern, Sanitas, Sanitas + The box …), sortert som i dag.
- Kolonner = Dag 0 … Dag N.
- Første kolonne (vakt) er sticky venstre, header sticky topp — vannrett scroll for dagene.
- Kompakt design: hver leder vises som en liten "chip" i cellen, med × for å fjerne.

**3. Legg til ledere inline**
- I hver celle en "+ Legg til"-knapp som åpner en popover med søkbar liste over aktive ledere (samme utvalg som du haket av øverst).
- Ledere som allerede bryter regler (8t/dag, F-team etter 21, 11t hvile) vises nederst i lista med grå tekst + advarselsikon, men kan fortsatt velges (manuell override).
- Fjerne leder = klikk × på chip. Alle endringer lagres direkte til `shift_assignments` (insert/delete), ingen ekstra "Lagre"-knapp.

**4. Beholde**
- Ledervelger og parametere øverst (uendret).
- "Generer vaktplan"-knappen — den fyller matrisen automatisk som før.
- "Åpne i full planner"-lenken for Excel-eksport.

## Teknisk
- `ShiftPlannerMini.tsx`: fjern separate resultat-kort, slå sammen til én matrise-komponent. Ny popover bruker `Command` fra shadcn for søk.
- Ny mutasjon: `addAssignment(day, shift_type_id, leader_id)` → `insert` i `shift_assignments`, refetcher cellen.
- Ny mutasjon: `removeAssignment(assignment_id)` → `delete`, refetcher.
- Etter hver mutasjon kalles `revalidate-shift-schedule` i bakgrunnen for å oppdatere regelbrudd-badges.
- Ingen endringer i edge function eller database.
