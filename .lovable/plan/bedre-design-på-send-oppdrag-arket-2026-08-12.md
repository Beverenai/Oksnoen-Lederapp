# Bedre design på «Send oppdrag»-arket

Arket ser i dag ut som et skjema: lang tittel som kolliderer med lukkeknappen, stor tom tekstboks, og en uendelig liste med ledere som fyller hele arket. Vi gir det samme iOS-glass-stil som resten av appen.

## Hva som endres

**Topp**
- Deltakerens bilde (avatar) og navn i en egen rad, med «Send oppdrag» som liten overskrift over navnet — så tittelen aldri kolliderer med X-knappen.

**Beskjed**
- Tekstfelt med rundere hjørner, mykere bakgrunn og tegnteller.
- Rad med hurtigvalg-chips som fyller inn vanlige beskjeder (f.eks. «Ta en prat», «Følg til nurse», «Ring hjem», «Hold øye med»), slik at admin sjelden må skrive.

**Mottaker**
- To tydelige valg-kort side om side øverst: «Alle ledere» og «Én leder». Lederlista og søket vises bare når «Én leder» er valgt.
- Valgt leder vises som en pill med bilde og navn (med kryss for å bytte), i stedet for at hele lista blir stående.
- Lederlista får fast maks-høyde med egen scroll, avatar + navn, og hake på valgt leder.

**Send-knapp**
- Fast nederst i et eget felt med glass-bakgrunn og safe-area, deaktivert til beskjed finnes, og med tekst som speiler valget: «Send til alle ledere» / «Send til {navn}».

## Teknisk
- Kun `src/components/passport/SendParticipantTaskSheet.tsx` endres — ren presentasjon, ingen endring i data, hooks eller push-logikk.
- Bruker eksisterende semantiske tokens (`bg-card`, `border-border`, `primary`, `muted-foreground`), `rounded-2xl`, `shadow-card` og `dvh`/safe-area-mønsteret fra de andre arkene. Ingen hardkodede farger.
