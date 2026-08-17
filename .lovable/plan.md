# Leirskole: off-season-design + aktivitetsgenerator

## 1. Design — samme mørke look som off-season

- Leirskole-flatene bruker samme mørke natt-palett og glass/pill-stil som off-season (samme bakgrunnsgradienter, kort- og pill-flater, avrundede iOS-pills), i stedet for dagens egne teal-tokens.
- Aksentfargen holdes teal-grønn slik at man ser at man er i Leirskole, men alt annet (bakgrunn, kort, tekst, borders, ark/dialoger) blir identisk med off-season.
- Gjelder alle leirskole-sider: hjem, vaktplan, oppgaver, ledere, chat og leirskole-admin — inkludert bunnmeny og ark/dialoger.

## 2. Hjemskjerm — kun det viktigste

Beholdes:
- Uke-header øverst (ukenavn, datoer, hilsen, publisert/utkast).
- Neste vakt (stor klokke-visning).
- Mine vakter (per dag med timer mot maks/dag).
- "Denne økten skal du" hvis admin har lagt inn info til deg.

Flyttes til Mer-skjermen:
- Min kompetanse
- Snarveier til Vaktplan, Oppgaver, Ledere, Lederhuset, Leirskole-admin

Fjernes fra hjem:
- "Ledere denne uken" / lederteller i statistikkraden (kun mine timer + i dag beholdes).

## 3. Admin — dashboard over aktive leirskole-ledere

Admin blir mer som resten av appen: en oversikt først, detaljer i ark.

- Statusstripe: antall ledere, på vakt nå, timer, poster, publiser-bryter.
- Lederdashboard (hovedflaten): kort per aktiv leirskole-leder med bilde, timer denne uken, kompetanse-chips og hvilke aktiviteter lederen har hatt før.
- Trykk på en leder åpner et ark der admin kan:
  - tildele aktivitet manuelt for en dato/økt
  - se historikk over tidligere aktiviteter
  - redigere kompetanse
  - sende oppgave kun til denne lederen
- Eksisterende kort (tilgang, vaktplan-generator, økt-info, oppgaver) samles lenger ned som seksjoner, slik at dashboardet ligger øverst.

## 4. Aktivitetsgenerator (Tube, Klatring, Rappellering, Kanotur, Båtkjøring, Badevakt)

- Én knapp per økt/dag: "Generer aktiviteter".
- Generatoren tar lederne som faktisk er på vakt i den økten, og fordeler aktivitetene slik at:
  - en leder ikke får samme aktivitet igjen før alle har hatt den (færrest antall ganger vinner)
  - kompetanse respekteres — ledere uten kompetanse på f.eks. Klatring får den ikke tildelt
  - hvis det ikke finnes noen annen mulighet, gjentas en aktivitet (og vises tydelig som gjentakelse)
- Resultatet vises som forslag admin kan justere før lagring, og lagres per uke/dato/økt.
- Publisering sender varsling kun til lederne som fikk en aktivitet.
- Lederen ser sin aktivitet på hjem under "Denne økten skal du" og i Vaktplan.

## Teknisk

- Tabellen `leirskole_activity_assignments` (week_id, leader_id, date, session, activity, note, auto_generated) finnes allerede og tas i bruk — ingen ny migrasjon nødvendig for lagring; RLS-policyene sjekkes og justeres kun hvis de blokkerer admin-skriving eller leder-lesing.
- Ny `src/lib/leirskoleActivities.ts`: aktivitetsliste (gjenbruker nøklene i `leirskoleCompetencies.ts`) + rettferdig fordelingsalgoritme basert på tidligere tildelinger og kompetanse.
- Nye hooks i `useLeirskole.ts`: aktivitetshistorikk per uke/leder, generer-forslag, lagre tildelinger, slett tildeling.
- Nye komponenter: `LeirskoleActivityCard.tsx` (generator) og `LeirskoleLeaderSheet.tsx` (per-leder-ark). `Leirskole.tsx` slankes, `More.tsx` får leirskole-snarveiene, `index.css` gjenbruker off-season-tokens for `oks-leirskole-theme`.
