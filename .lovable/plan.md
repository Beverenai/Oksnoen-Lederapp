# Off-season: nattmørkt design + nytt POV-hovedbilde

## Hva du får
En off-season-opplevelse som ser ut som skjermbildet: dyp nattblå bakgrunn, POV som stort hero-kort med bilde og «Ta neste bilde», rød Tinder-flis og mørkegrønn Lederhuset-flis side om side, to smale fliser (Klineliste, Snus), og en mørk rød Lederpass-stripe med profilbilde, navn og gull-merker.

Det opplastede Øksnøen-bildet (regatta-skiltet) blir hovedbildet for POV — brukt både i POV-hero på hjem og øverst på POV-siden. Bildet ligger sidelengs, så det roteres til riktig retning før bruk.

## Endringer

### 1. POV-hovedbilde
- Roter det opplastede bildet til riktig retning og last det opp som CDN-asset.
- Bruk det som bakgrunn i POV-hero-kortet på off-season-hjem og som header-bilde på `/pov`, med mørk gradient over slik at tekst og knapp er lesbare.

### 2. Nattmørk off-season-palett
- Utvid `oks-offseason-bg` med en mørk nattvariant: dyp navy/nesten svart bakgrunn med svak rød/gull glød øverst.
- Nye flis-toner: `night` (mørk navy), `forest` (mørkegrønn til Lederhuset), sterkere rød til Tinder, mørk rød + gullkant til Lederpass.
- Kort blir mørke flater med lys krem tekst — samme tokens, ingen hardkodede farger.

### 3. Hjem (off-season)
- Header: logo + «Off-season»-chip + «Hei, {navn} 👋» på et mørkt bilde-topp.
- POV-hero: fullbredde kort med bildet, «X av Y bilder», framdriftslinje og «Ta neste bilde»-knapp.
- Rad 2: Øksnøen Tinder (rød, høy) + Lederhuset (mørkegrønn, høy, med varselprikk).
- Rad 3: Klineliste + Snus (Snus beholder 3D-boksen).
- Nederst: Lederpass-stripe (avatar, navn, rolle- og periode-merker) som åpner passet. Øksnøen + og Feedback flyttes til Mer for å holde hjem ryddig.

### 4. Mer + undersider
- `Mer`-rutenettet får samme mørke fliser og toner.
- `Pov`, `Klineliste`, `SnusPage`, `Feedback` bruker den mørke bakgrunnen og samme header-stil.

## Teknisk
- `src/index.css`: nye night/forest-tokens og mørk `oks-offseason-bg`-variant; `tailwind.config.ts` utvides tilsvarende.
- `src/components/offseason/BentoTile.tsx`: nye toner + støtte for bilde-bakgrunn/hero-variant med CTA.
- `src/components/home/OffSeasonHome.tsx`: ny layout iht. skjermbildet.
- `src/pages/More.tsx`, `Pov.tsx`, `Klineliste.tsx`, `SnusPage.tsx`, `Feedback.tsx`: mørk bakgrunn og toner.
- Bildet lastes opp via `lovable-assets` og importeres som pointer-JSON (ingen binærfil i repoet).
- Ingen endringer i data, roller eller logikk.
