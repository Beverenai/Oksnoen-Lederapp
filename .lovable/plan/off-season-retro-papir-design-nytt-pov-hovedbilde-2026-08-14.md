# Off-season: retro papir-design + nytt POV-hovedbilde

## Hva du får
Off-season-flatene får et retro «fotoalbum»-preg som i mockupen: mørk nattblå bakgrunn, POV som en stabel med polaroid-rammer i papir, Tinder og Lederhuset som avrevne papirstrimler med rød/mørkegrønn tekstur, Klineliste + Snus som en delt strimmel, og Lederpasset som et bokbind i mørk rød skinn med gullkant.

Det opplastede Øksnøen-bildet (regatta-skiltet) blir POV-hovedbildet — i POV-stabelen på hjem og øverst på `/pov`. Bildet ligger sidelengs, så det roteres til riktig retning før bruk.

## Endringer

### 1. POV-hovedbilde
- Roter det opplastede bildet og last det opp som CDN-asset.
- Brukes som bildet i POV-polaroid-kortet på hjem og som header-bilde på POV-siden, med mørk gradient over for lesbar tekst.

### 2. Retro papir-lag (bruker det som allerede finnes)
Prosjektet har alt `ivory-paper.webp` og `red-bookcloth.webp` som assets — de gjenbrukes som teksturer i stedet for nye bilder.
- Nye CSS-hjelpere: `.oks-paper-frame` (kremhvit polaroid-ramme med lett rotasjon og skygge), `.oks-torn-strip` (avrevet papirkant via mask), `.oks-bookcloth` (rødt bokbind til Lederpasset), samt fint korn/vignett-overlegg.
- Mørk nattpalett: dyp navy bakgrunn, teal-aksent, gull og mørkegrønn — som tokens i `index.css`, ingen hardkodede farger.

### 3. Hjem (off-season)
- Header: logo + «Off-season»-chip + «Hei, {navn} 👋» over et mørkt kveldsbilde.
- POV: polaroid-stabel (2–3 papirlag bak) med kameraikon, «X av Y bilder», framdriftslinje og «Ta neste bilde»-knapp. Messing-kamerarunding øverst til høyre.
- Øksnøen Tinder: rød papirstrimmel i full bredde.
- Lederhuset: mørkegrønn papirstrimmel med rødt antall-merke.
- Klineliste + Snus: en delt mørk strimmel med skillelinje (Snus beholder 3D-boksen).
- Lederpass: bokbind-stripe med avatar, navn, gull-merker (rolle + periode) og gullemblem.
- Øksnøen + og Feedback flyttes til Mer så hjem holdes ryddig.

### 4. Mer + undersider
- `Mer` får samme papir/mørke stil på flisene.
- `Pov`, `Klineliste`, `SnusPage`, `Feedback` får den mørke bakgrunnen og samme retro header-stil.

## Teknisk
- `src/index.css` + `tailwind.config.ts`: nattpalett-tokens (navy/teal/grønn/gull) og papir-hjelperklasser med de eksisterende tekstur-assetene.
- `src/components/offseason/BentoTile.tsx`: nye varianter — `polaroid` (bilde + CTA), `strip` (avrevet strimmel), `split` (to-i-en), `bookcloth`.
- `src/components/home/OffSeasonHome.tsx`: ny layout iht. mockupen.
- `src/pages/More.tsx`, `Pov.tsx`, `Klineliste.tsx`, `SnusPage.tsx`, `Feedback.tsx`: bakgrunn og header.
- Bildet lastes opp via `lovable-assets` og importeres som pointer-JSON (ingen binærfil i repoet).
- Rotasjon/teksturer holdes lette (CSS-masker og eksisterende webp) så det ikke går utover ytelsen på iPhone. Ingen endringer i data eller logikk.
