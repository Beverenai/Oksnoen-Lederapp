# Off-season redesign — Øksnøen-farger + bento

Off-season-flatene er i dag hvite kort med grønne ikoner og lik vekt på alt. Vi gir dem Øksnøen-logoens farger (dyp rød, gull, marineblå, krem) og en bento-layout der de viktigste funksjonene får plass og karakter.

## Fargesystem (nye tokens)
Legger til semantiske off-season-tokens i `src/index.css` basert på logoen:
- `--oks-red` (dyp logorød), `--oks-red-deep`, `--oks-navy` (marineblå fra logoringen), `--oks-cream` (varm papirkrem), pluss eksisterende `--oks-gold`.
- Gradientene `--gradient-oks-red`, `--gradient-oks-navy`, `--gradient-oks-sunset` (rød→gull) og `--shadow-oks-card`.
- Off-season-bakgrunnen blir varm krem med et mykt rødt/gull-glød-felt øverst i stedet for flatt hvitt.
- Alt via tokens — ingen hardkodede fargeklasser i komponentene, og begge temaer får riktig kontrast.

## Hjem (off-season)
- Header: «Off-season»-chip i gull på rød glass-pille, hilsen i heading-fonten, mer luft (spacing-skala 6/8 i stedet for 5).
- Ny bento-grid erstatter den nøytrale ikonraden:
  - Stor flis: **Øksnøen Tinder** (rød→gull gradient, flammeikon, sveip-hint).
  - Mellomflis: **Lederpasset** som forhåndsvisning i rødt.
  - Små fliser: **Snus** (3D-boksen beholdes), **Klineliste**, **Lederhuset**, **POV** — hver med egen tonet farge fra paletten, ikke alle grønne.
- Øksnøen +-seksjonen får gull-innramming og tydeligere låse-ikoner.
- Lederpass-kortet nederst beholdes, men med gull-kant og bedre bunnpadding.

## Mer-siden
- Samme bento-språk: `Tile` får en `tone`-prop (rød / navy / gull / krem) slik at seksjonene skiller seg visuelt, og en `size`-prop for hero-fliser.
- Off-season-visningen får ett stort lederpass-kort øverst, deretter bento-fliser for Klineliste, Snus, Tinder, POV, Lederhuset, Min profil, Øksnøen +, Feedback.
- Seksjonsoverskrifter i gull-versaler, tettere gap, avrundede 24px-kort, mykere skygger og trykk-animasjon.
- Aktiv-modus (admin/leder på leir) beholder dagens struktur, men får de samme kort-stilene så appen føles enhetlig.

## Undersider
Bruker samme tokens og korthøyder på: `Snus`, `Klineliste`, `KlineTinder`, `Pov`, `Feedback`, `Lederpass` — farget sideheader, konsistent innholdsbredde og bunnpadding over bunnmenyen. Ingen endring i logikk eller data på disse sidene, kun presentasjon.

## Teknisk
- Nye tokens i `src/index.css`, mappet i `tailwind.config.ts` (`oks.red`, `oks.navy`, `oks.cream`, `oks.gold`).
- Ny gjenbrukbar `src/components/offseason/BentoTile.tsx` (varianter: size `sm|md|lg`, tone, badge/teller, valgfritt `visual`).
- `OffSeasonHome.tsx` bygges om til bento; `HomeQuickActions` beholdes for aktiv-modus.
- `More.tsx`: `Tile` utvides med tone/size, off-season-seksjonene omorganiseres.
- Safe-area og `dvh` respekteres som i dag; ingen backend- eller tilgangsendringer.
