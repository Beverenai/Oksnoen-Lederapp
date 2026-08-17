# Leirskole-admin: tydelig flyt i 4 steg

Målet er at admin-siden speiler den faktiske arbeidsflyten, og at aktivitetene fordeles automatisk etter kompetanse og rullering — i stedet for at alt må gjøres manuelt.

## Ny struktur

Erstatt dagens fire faner (Oversikt / Vaktplan / Økter / Oppgaver) med én stegvis flyt der hvert steg viser status (ikke gjort / klart) og kan åpnes/lukkes:

```text
1. Ledere        -> hvem jobber denne uken (+ kompetanse)
2. Ukeplan       -> hvilke aktiviteter i økt 1-3 hver dag
3. Vaktplan      -> generer vakter (maks 8t/dag) + fordel aktiviteter
4. Oppgaver      -> beskjeder/oppgaver til lederne
```

Toppkortet beholdes (uke, datoer, publisert-bryter) men slankes: Ledere / Timer / Vakter / På vakt nå.
Guide-kortet gjøres om til en kort linje per steg i stedet for et eget stort kort.

## Steg 1 - Ledere

Kompakt liste med bilde, navn, timer denne uken og kompetanse som små merker. Ledere uten kompetanse markeres tydelig ("mangler kompetanse"), fordi de blokkerer automatisk fordeling.

## Steg 2 - Ukeplan

Ukeplanleggeren beholdes som i dag (aktiviteter velges fra lista, økt 1-3), men får en tydelig "X av Y ruter fylt"-status så det er synlig at dette må gjøres før steg 3.

## Steg 3 - Vaktplan + automatisk aktivitetsfordeling

To knapper:
- **Generer vaktplan** - som i dag (vakter, måltider, Sanitas, nattevakt, maks 8t/dag, sammenhengende vakter).
- **Fordel aktiviteter** (ny) - leser aktivitetene fra ukeplanen for hver dag/økt og velger leder til hver aktivitet etter denne prioriteringen:
  1. lederen må ha kompetansen for aktiviteten
  2. lederen må ha vakt i den økten
  3. lederen skal ikke ha hatt samme aktivitet i forrige økt
  4. lavest antall ganger med denne aktiviteten tidligere i uken (rullering)
  5. jevn fordeling av totalt antall aktiviteter

Manuelt satte aktiviteter (auto_generated = false) beholdes alltid. Aktiviteter uten kvalifisert ledig leder listes som "mangler leder" med forklaring, i stedet for å bli tildelt tilfeldig.

Under knappene: dagvelger med rad per leder og kolonne per økt, der aktiviteten kan endres manuelt i en nedtrekksliste (som i dag, men strammere design og med kompetanse-advarsel når man velger noe lederen ikke kan).

## Steg 4 - Oppgaver

Som i dag, men flyttet inn i steget og med kompaktere liste over sendte oppgaver.

## Ledersiden

Ingen endring i logikken - lederen ser fortsatt vakter og aktivitet per økt, men får nå riktigere fordeling fordi den kommer fra ukeplanen.

## Teknisk

- `src/pages/admin/LeirskoleAdmin.tsx`: bytt Tabs mot stegvis accordion-layout, flytt oppgavepanelet inn i steg 4, forenkle toppkort og guide.
- Ny `src/components/admin/LeirskoleAutoActivityCard.tsx`: "Fordel aktiviteter"-knapp + resultatliste (tildelt / mangler leder).
- Ny hjelpefil `src/lib/leirskoleAutoAssign.ts`: rene funksjoner for kompetanse-, rullering- og balanse-scoring (kjøres på klient mot `leirskole_week_plan_cells`, `leirskole_posts`/`schedule_post_assignments` og `leirskole_activity_assignments`).
- `LeirskoleDayActivityCard.tsx`: strammere design + advarsel ved manglende kompetanse.
- `LeirskoleWeekPlanCard.tsx`: legg til utfyllingsstatus.
- `LeirskoleGuideCard.tsx`: kortes ned til de fire stegene.
- Ingen databaseendringer.
