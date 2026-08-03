## Mål
Roligere topp på hjem-siden, tydeligere Hendelse-knapp, og Morderleken + Lederpasset plassert som små ikoner ved profilbildet.

## Endringer (kun `src/pages/Home.tsx`)

### 1. Fjern bildebanneret øverst
- Fjern `oksnoenHeader`-bildet og gradient-overlayet (hele header-blokken med `h-44 md:h-52`).
- Profilseksjonen flyttes opp som toppen av siden (ingen negativ `-mt-14`-overlapping lenger), med litt luft over.
- Oppdater-knappen (`RefreshCw`) flyttes til øvre høyre hjørne av den nye toppen, i nøytral/muted stil siden bakgrunnen ikke lenger er mørk.
- «Hei, {fornavn}!» får vanlig `text-foreground` i stedet for hvit tekst med drop-shadow.

### 2. Pass til venstre, dødningskalle til høyre for profilbildet
- Ny rad: `[LederPass-ikon]  [Avatar]  [Morderleken-ikon]`, sentrert, avataren beholder samme størrelse og grønn/rød ring.
- Venstre: eksisterende `<LederPass leader=... periodLabel=... />` i liten ikon-variant.
- Høyre: liten vertikal knapp med `Skull`-ikon i sirkel + teksten «Morderleken» under (liten uppercase-label), navigerer til `/morder`. Vises kun når `showMurder` er sann; rød prikk-indikator beholdes ved `incoming_claim_id`.
- Når Morderleken er av, holdes avataren sentrert (usynlig plassholder på høyre side).

### 3. Tydeligere Hendelse-knapp
- Erstatt den lille sentrerte outline-knappen nederst med et fullbredde, framtredende kort/knapp i rød aksent: ikon i sirkel, tittel «Registrer hendelse» og en liten hjelpetekst, med tydelig kant og skygge — samme visuelle vekt som de andre kortene på siden.
- Plasseres øverst i kortlisten (rett under profilseksjonen) i tillegg til å beholde samme navigasjon til `/hendelser`.

### 4. Rydding
- Fjern nå ubrukt import av header-bildet.
- Morderleken-statuskortet lenger ned beholdes uendret (viser status/bekreftelser).

## Teknisk
- Ingen endringer i data, RLS eller edge functions — kun presentasjon i `Home.tsx`.
- Farger via eksisterende semantiske/tailwind-klasser som brukes i filen i dag.
- Verifiseres i mobilvisning (393px) med skjermbilde.
