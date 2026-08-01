## Mål
I Nurse → fanen "Rapport" skal du kunne:
1. Trykke på en deltaker for å åpne deltakerkortet (samme detaljvisning som i "Deltakere"-fanen).
2. Redigere teksten i notatene direkte i rapporten, ikke bare slette dem.

## Hva som endres

### 1. Trykk på deltaker i rapporten
- `NurseReportEditor` får en ny valgfri prop `onOpenParticipant(participantId)`.
- Deltakerens topplinje (bilde + navn + hytte/alder) blir en klikkbar flate som kaller propen. "+ Notat"-knappen forblir egen knapp og trigger ikke åpning.
- `Nurse.tsx` sender inn en funksjon som finner deltakeren i den eksisterende lista og kaller `openParticipantDetail(...)`, som allerede laster helseinfo/notater og åpner detaljdialogen. Ingen ny dialog bygges.

### 2. Redigere notater i rapporten
- Hver oppføring får en blyant-knapp ved siden av slett-knappen. Trykk gir et redigeringsfelt (textarea) i stedet for teksten, med Lagre / Avbryt.
- Redigerbare kilder:
  - "Nurse" (nurse_report_mentions) → oppdaterer `mention_text`.
  - "Nurse-notat" (participant_health_notes) → oppdaterer `content`.
  - "Hendelse" (participant_health_events) → forblir lesbar/ikke redigerbar, siden den logges fra ledere med type/alvorlighet.
- Lagring oppdaterer lista lokalt umiddelbart og kaller `onDataChange` slik at deltakerlista og filtrene oppdateres.
- Feil ved lagring viser feilmelding via eksisterende StatusPopup; ingen tekst mistes (feltet forblir åpent).

### Teknisk
- Kun frontend: `src/components/nurse/NurseReportEditor.tsx` (redigeringsmodus + ny prop) og `src/pages/Nurse.tsx` (kobler propen til `openParticipantDetail`).
- Ingen databaseendringer; skrivetilgang til begge tabellene finnes allerede siden appen både oppretter og sletter disse radene i dag.
- Slett-knapp og PDF-eksport blir uendret.
