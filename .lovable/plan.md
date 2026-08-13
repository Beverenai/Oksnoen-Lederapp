# Øksnøen + finere visning + ekte Tinder for off-season-ledere

## 1. Finere Øksnøen +-visning

Dagens dialog lister 15 fordeler som like små rader. Den bygges om til en «ekte» premium-salgsside:

- Fordelene deles i grupper med egne overskrifter: **Søvn og komfort**, **Aktiviteter**, **Mat og drikke**, **Sosialt**, **Status**.
- Hver fordel får et rundt gull-ikon, tittel og undertekst, i kort med myk glass/gull-gradient.
- Toppen får en «hero» med krone, «Øksnøen +»-logo, kort selling-line og en liten karusell av 3 uthevede fordeler (Kvarter lenger søvn, 2 ekstra enheter, Velg soveplass).
- Innholdet scroller mykt innenfor arket, med safe-area-padding (dvh) slik som resten av appen.
- Ingen endring i den falske betalingsflyten (avvist kort osv.) – bare presentasjon.

## 2. Alle Øksnøen +-funksjoner som knapper i «Mer»

I «Mer» for off-season/inaktive ledere legges en ny seksjon **Øksnøen +** med én flis per fordel (alle 15). Flisene:

- har låsikon og gull-tekst «Øksnøen +»
- åpner Øksnøen +-dialogen når man trykker (ren moro, ingen funksjon)
- unntaket er **Tinder for ledere**, som er en ekte funksjon og går til den nye siden

Samme låste fliser gjenbrukes på off-season-hjemsiden i stedet for dagens to («Din leirstatistikk», «Ledertema»), som en horisontal rad man kan bla i.

## 3. Kline-Tinder (ekte funksjon)

Ny side `/kline-tinder` – en sveipestokk med ledere.

- **Hvem vises:** ledere som ikke er aktive i perioden (og eksterne/manuelle ledere), utenom deg selv, de du allerede har sveipet, og de du allerede er koblet til på klinelista.
- **Kort:** stort profilbilde, navn, snusboks-badge, år på leir – i et kort man kan sveipe eller trykke på knappene «Nei» / «Ja».
- **Sveip høyre** = du liker. Sveip venstre = hopp over (huskes).
- **Match:** når begge har sveipet høyre, blir det en match – full-skjerm «Det er en match!»-animasjon, og koblingen blir bekreftet på klinelista (samme data som i dag, så kartet og lista oppdateres automatisk).
- **Matcher-liste** nederst på siden: alle dine matcher, med mulighet til å åpne Lederhuset-chatten.
- Push-varsel ved match, gjennom samme mekanisme som klinelista bruker i dag.
- Sveip-høyre uten svar vises som «venter» (som en pending forespørsel i dag).

## Teknisk

- Ny tabell `leader_swipes` (`swiper_leader_id`, `target_leader_id`, `liked boolean`, unik per par) med GRANT + RLS: en leder ser og skriver kun sine egne rader; motparten får ikke lese.
- Databasefunksjon `swipe_leader(_target uuid, _liked boolean)` (security definer) som lagrer sveipet, og ved gjensidig «liked» oppretter/bekrefter raden i `leader_hookups` og returnerer om det ble match. Dette hindrer at klienten kan lage falske matcher.
- Nye filer: `src/pages/KlineTinder.tsx`, `src/components/klineliste/SwipeDeck.tsx`, `src/components/klineliste/SwipeCard.tsx`, `src/components/offseason/PlusPerkTiles.tsx`, `src/hooks/useLeaderSwipes.ts`.
- `src/lib/limitedAccess.ts`: legg til `/kline-tinder`. Ny rute i `src/App.tsx`.
- Fordelslisten flyttes til `src/components/offseason/plusPerks.ts` slik at både dialogen, hjem og «Mer» bruker samme kilde.
- Sveip bygges med Motion for React (drag + spring), fallback-knapper for tilgjengelighet.
