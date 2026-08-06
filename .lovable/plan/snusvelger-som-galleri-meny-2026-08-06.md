# Snusvelger som galleri-meny

Bygg om snusvalget i profilen til å se ut som skissen: en lys "kort"-skjerm med Øksnøen-logo, tittel, søk, merke-chips og et 2-kolonners rutenett av vippede snusbokser du trykker på, med rød «Velg denne»-knapp nederst.

## Layout (topp til bunn)

```text
        [ Øksnøen-logo ]
       Velg snusen din
 [ 🔍 Søk merke eller smak ]
 (Alle)(EPOK)(Skruf)(General)(LOOP)…
 ┌──────────┐   ┌──────────┐
 │  boks    │   │  boks    │
 │ EPOK No1 │   │ Skruf…   │
 │ Ice Blue │   │ Fresh…   │
 └──────────┘   └──────────┘
 ┌──────────┐   ┌──────────┐ (valgt = rød ring + ✓)
 └──────────┘   └──────────┘
     [   Velg denne   ]
```

- Trykk på en boks markerer den (rød ring rundt boksen + rød sirkel med hake øverst til høyre). «Velg denne» lagrer og lukker.
- Under hver boks: produktnavn i halvfet, og under det smak • styrke i mindre grå tekst.
- Søk og merke-chips filtrerer rutenettet som i dag; chip «Alle» er valgt som standard.
- Rutenettet scroller, mens logo/tittel/søk/chips ligger fast øverst og knappen fast nederst.

## Boksene

- Hver boks i rutenettet vises vippet (samme skrå vinkel som i skissen) og statisk — ingen rotasjon eller dragging i listen, så scrolling blir jevn og alle boksene laster raskt.
- Lokket får merkets farge (mørk navy Epok, sølvhvit Skruf, sort/gull General, grønn Loop osv.) med hvit/lys tekst, i stedet for dagens hvite lokk til alle.
- På lokket: merkenavn stort, «NO1»-nummer, smak, styrkeprikker og S-nivå — som i dag, men i merkets farger.
- Sideveggen viser merkenavnet gjentatt langs kanten pluss smaksnavn nederst, slik at boksen leses som en ekte boks fra siden.
- Den store, dreibare 3D-boksen beholdes, men flyttes til der du har valgt snus (profilkortet og lederdetaljer), ikke i selve listen.

## Teknisk

- `src/components/snus/SnusPicker.tsx`: ny layout med sticky topp (logo via `@/assets/oksnoen-header.png.asset.json`, tittel, søkefelt, merke-chips), `grid grid-cols-2 gap-4` med bokskort, sticky bunnknapp. Lokalt `selectedId` state; lagring skjer på «Velg denne».
- `src/components/snus/SnusCan3D.tsx`: legg til en lett statisk variant (f.eks. `interactive={false}` + fast vippevinkel) som brukes i rutenettet; den interaktive rotasjonen brukes bare i store visninger.
- `src/lib/snusCatalog.ts`: legg til fargepalett per merke (lokkfarge, tekstfarge, aksent) som lokk og sidevegg leser fra. Ingen endring i produktdata eller søkelogikk.
- Ingen databaseendringer — `snus_product_id` lagres som før.
