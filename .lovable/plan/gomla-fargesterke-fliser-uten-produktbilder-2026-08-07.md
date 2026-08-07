# Gomla: fargesterke fliser (uten produktbilder)

Ingen genererte produktbilder. Rutenettet bygges på fargekoding, korte merker/emoji og et tydeligere, kulere flisdesign — retningen "Fargesterke fliser".

## Slik blir det

- Hver vare blir en hel fargeflate i merkefargen (Cola rød, Pepsi mørkeblå, Fanta oransje, Cola Zero svart med rød glød osv.) i stedet for hvitt kort med liten fargeprikk.
- Stor initial/merke ("C", "PM", "KL") eller emoji sentrert i flisen, i lav opasitet så det leses som logo, ikke tekst.
- Navn + pris ligger i et halvtransparent, blurret felt nederst på flisen — alltid lesbart.
- Tettere rutenett (3 kolonner på mobil, flere på iPad) så flere varer får plass uten skrolling.
- Lyse merkefarger (Urge, Solo, Haribo, Cheez Doodles) får automatisk mørk tekst, mørke farger får hvit tekst — kontrast beregnes fra fargekoden.
- Trykk gir rask press/scale-effekt, og antall i kurven pops inn som et lite tall-badge i hjørnet av flisen.
- Kategorichips og søk beholdes som i dag, men strammes opp i samme stil (mørk aktiv chip, lyse inaktive).

## Teknisk

- `src/lib/kioskBrand.ts`: utvides fra "emblem" til full flis-stil — behold `mark`/`emoji`, legg til beregnet tekstfarge (luminans-sjekk) og valgfri gradient for Cola Zero-typen. Ingen nye bildefiler, ingen `kioskImages.ts`.
- `src/pages/Kiosk.tsx`: bytt produktkortene til `aspect-square` fliser med full bakgrunnsfarge, sentrert merke, blurret info-stripe nederst, `active:scale-95` og antall-badge. Grid: `grid-cols-3` på mobil, `sm:grid-cols-4 lg:grid-cols-6`.
- Fjern eventuelle referanser til produktbilder som ble lagt inn i forrige runde.
- Merkefargene er faste produktfarger og blir liggende som hex i `kioskBrand.ts` (ikke tema-tokens), mens chrome rundt (header, chips, kurvlinje) bruker semantiske tokens som før.
