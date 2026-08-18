# Rydde opp i leirskole-admin: dag-til-dag øverst, færre knapper

## 1. Ukevelgeren blir en knapp
- «Leirskoleuker»-listen med alle ukene tar mye plass. Erstattes av én knapp øverst: `Uke 34 · 17.–21. aug ▾`.
- Trykk åpner et ark (sheet) med ukelisten, «Ny uke» og «Bytt aktiv uke» — samme funksjoner som i dag, bare skjult til de trengs.

## 2. Færre «Åpen»/«Rediger»-striper
- De brede hjelpe-stripene («Legg til ledere og aktiviteter rett i øktene» + Åpen, «Trykk på en leder …» + Rediger) fjernes.
- Erstattes av to små ikonknapper på samme linje som dagvelgeren: hengelås (åpen/låst) og blyant (rediger av/på). Hjelpeteksten flyttes til `title`/tooltip.

## 3. «Dag til dag» blir første seksjon
- Ukeplanleggeren flyttes opp som en av de øverste seksjonene i leirskole-admin, med toggle (lukket som standard etter at den er fylt ut).
- Ny layout: dagene nedover som rader, Økt 1–3 bortover som kolonner — som i regnearket. Annenhver økt-kolonne får egen bakgrunnsfarge, og fargeprikkene per rute beholdes.
- Ankomst-/avreisedager beholder sine egne økter som i dag.

## 4. Aktiviteter med antall (`x2`)
- Når man legger inn en aktivitet i en rute, kan man velge antall ledere: 1–6. Ruten viser `Klatring x2`.
- Antallet styrer hvor mange lederplasser økten får i uke-bordet og i generatoren, i stedet for at man må skrive aktiviteten to ganger.
- Eksisterende ruter med samme aktivitet på to linjer tolkes fortsatt som 2.

## 5. Ledere som egen seksjon nederst i «Hele uken»
- «Ledere»-fanen i uke-bordet fjernes som fane.
- I stedet ligger «Ledere · timer» som en sammenleggbar seksjon nederst under bordet, med timer per leder per dag og uketotal (samme tabell som i dag).

## Teknisk
- `LeirskoleWeekPeriodsCard.tsx`: kompakt trigger-knapp + `Sheet` rundt dagens innhold.
- `LeirskoleAdmin.tsx`: ny rekkefølge — toppkort → uke-knapp → «Dag til dag» (ukeplan) → «I dag · rediger dagen» → stegene 1–3.
- `LeirskoleWeekPlanCard.tsx`: bytt rutenettet fra dag-kolonner til dag-rader × økt-kolonner, sebrafarge på annenhver økt-kolonne, og antall-velger (`x2`) i aktivitets-popoveren.
- `src/lib/leirskoleCellInstances.ts`: `countActivity` parser `xN`-suffiks (`Klatring x2` → 2), fortsatt bakoverkompatibelt med gjentatte linjer.
- `LeirskoleWeekBoard.tsx`: fjern `view === 'ledere'`-fanen, render `LeirskoleLeaderWeekTable` i en collapsible nederst.
- `LeirskoleDayEditor.tsx` / `LeirskoleDaySessions.tsx`: erstatt info-stripene med ikonknapper (`Lock`/`LockOpen`, `Pencil`).
- Ingen databaseendringer — antall lagres i teksten i `leirskole_week_plan_cells.content`.
