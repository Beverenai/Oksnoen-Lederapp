# Leirskole: rent hjem-skjerm, mørkt iOS-design og aktivitetsfordeling

## 1. Hjem-skjerm (Leirskole) — kun det viktigste
Beholdes på `/leirskole`:
- Uke-header øverst: ukenavn, datoer, publisert-status, "mine timer / i dag".
- "Denne økten skal du" (info fra admin) — viktigst, rett under header.
- Neste vakt.
- Mine vakter.

Flyttes til Mer-siden:
- Min kompetanse
- Oppgaver fra admin
- Ledere denne uken (finnes allerede som eget "Ledere"-punkt)
- Hele vaktplanen
- Snarveier (chat, profil, leirskole-admin)

Mer-siden i leirskole-modus får derfor egne fliser: Vaktplan (hele uken), Oppgaver, Min kompetanse, Ledere, Chat, Profil, Admin.

## 2. Mørkt iOS-design (som off-season)
- Aktiverer off-season-temaet også i leirskole-modus: `AppLayout` setter et mørkt tema-klassenavn for både `offseason` og `leirskole` (egen `oks-leirskole-theme` som gjenbruker samme mørke tokens, med litt annen aksentfarge slik at modusene fortsatt skilles).
- Bruker `BentoTile`-komponenten og pill-stil (avrundede kort, glass/blur, tabulære tall) i leirskole-hjem, Mer-siden og lederlisten — samme visuelle språk som off-season.
- Ingen hardkodede farger; alt via tokens i `index.css`.

## 3. Leirskole-admin som "vanlig app"
Nytt hoveddashboard øverst på `/admin/leirskole`:
- Statuslinje: aktiv uke, antall ledere, timer totalt, vaktplan publisert.
- Ledergrid (fra dagens `LeirskoleStaffPanel`) hvor hvert lederkort viser bilde, kompetanse-chips, timer, dagens vakt **og dagens aktivitet**.
- Trykk på et lederkort → panel for å sette aktivitet manuelt, gi oppgave, eller endre kompetanse.
- Mindre viktige kort (opprett uke, sync, publiser) legges i en "Innstillinger"-seksjon lenger ned.

## 4. Aktivitetsfordeling med rotasjon
Aktiviteter: Tube, Klatring, Rappellering, Kanotur, Båtkjøring, Badevakt.

- Ny tabell `leirskole_activity_assignments` (week_id, date, session: formiddag/ettermiddag, leader_id, activity, auto_generated) med GRANTs, RLS (ledere ser sin uke, admin skriver) og unik nøkkel per leder+dato+økt.
- Generator-knapp "Fordel aktiviteter" per dag/økt:
  1. Finner lederne som har vakt i den økten (fra `leirskole_posts`).
  2. Filtrerer på kompetanse (`leirskole_competencies`) der det finnes match.
  3. Velger aktivitet med lavest antall tidligere tildelinger for den lederen (historikk på tvers av uker) — så ingen gjentar en aktivitet før alle er brukt opp.
  4. Låser manuelt satte aktiviteter, og lar admin bytte etterpå.
- Tildelt aktivitet vises automatisk i "Denne økten skal du" på lederens hjem-skjerm.
- Push-varsel når admin publiserer fordelingen.

## Teknisk
- Migrasjon: `leirskole_activity_assignments` + evt. `activity` på `leirskole_session_info` for visning.
- Nye filer: `src/lib/leirskoleActivities.ts`, `src/components/admin/LeirskoleActivityCard.tsx`, `src/components/leirskole/LeirskoleHomeHeader.tsx`.
- Endres: `src/pages/Leirskole.tsx`, `src/pages/More.tsx`, `src/pages/admin/LeirskoleAdmin.tsx`, `src/components/layout/AppLayout.tsx`, `src/hooks/useLeirskole.ts`, `src/index.css`.
