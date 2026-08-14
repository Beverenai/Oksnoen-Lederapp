# Mer-menyen, Tinder-matcher og egen drikke

## 1. Rydde opp i "Mer" (off-season)

Hjemskjermen viser nå POV, Tinder, Gi slurker, Klineliste og Snus som store fargede kort. De samme funksjonene ligger også som kort i Mer — det er dobbelt opp.

Ny logikk for Mer i off-season:
- Fjern kortene som allerede har egen knapp på hjemskjermen (POV, Tinder, Gi slurker, Klineliste, Snus).
- Mer blir "resten": Min Profil, Lederpass, Lederhuset, Feedback, Øksnøen +, Logg ut.
- Disse vises som en kompakt liste med ikon, navn og kort beskrivelse (rad-stil, ikke store bento-kort), slik at Mer føles som en meny og ikke som en ny hjemskjerm.
- Øksnøen +-seksjonen med de låste godene blir liggende nederst, siden den hører til menyen.
- Lederpass-stripen øverst i Mer beholdes som i dag.

On-season (aktiv periode) endres ikke: der er Mer fortsatt full oversikt over alle sider.

## 2. Tinder: ingen sletting av matcher

- Fjern "unmatch"-knappen fra matchlisten, slik at en match ikke kan slettes fra appen.
- Trykk på en match åpner bare chatten.
- Admin beholder full oversikt i Tinder-fanen i admin (uendret).

## 3. Gjenopprett Henrik Oksmo ↔ Vetle Hagerup Solberg

Sjekket i databasen nå: Henrik Oksmo har en like på Vetle (23:31 i kveld), men Vetle har ingen like tilbake, og det finnes ingen match mellom dem. Sannsynligvis ble matchen slettet med unmatch-knappen.

Fiks:
- Legg inn Vetle sin like på Henrik Oksmo, slik at matchen er "ekte".
- Opprett matchen mellom dem, så den vises i matchlisten hos begge med chat.

## 4. Egen drikke per leder (ikke per slurk)

I stedet for å velge drikke hver gang du sender, velger du **din drikke** én gang. Alt du gir vises da som den drikken.

- Ny innstilling "Min drikke" øverst på Gi slurker-siden (og i Min Profil): trykk for å bytte.
- Valg: Øl 🍺, Vin 🍷, Drink 🍸, Vodkadrink 🍹, Champagne 🥂, Shot 🥃.
- Når du sender slurker brukes din drikke automatisk — mottakeren ser og hører nettopp den drikken.
- Slurker som alt er sendt beholder drikken som ble brukt da (historikken endres ikke); nye slurker følger valget ditt.
- Lyd: hver drikke har sin egen lyd — pils som psjjer, vin som helles, shaker med is for drink/vodkadrink, boblende klirr for champagne, kort skål-klunk for shot.
- Emojiene i tellerne ("Fått", "Drukket") og på send-knappen følger drikken.

## Teknisk

- Database: ny kolonne `preferred_drink` på `leaders` (standard `beer`). `give_sips` leser avsenderens `preferred_drink` når `_drink_type` ikke sendes inn, så `leader_sips.drink_type` lagrer fortsatt hva som faktisk ble gitt.
- Dataretting: én rad i `leader_swipes` (Vetle → Henrik Oksmo, liked) og én rad i `leader_matches`.
- `src/lib/drinkSounds.ts` utvides med vodkadrink, champagne og shot; `playDrinkSound` beholder signaturen.
- `useUnmatch` fjernes fra `KlineTinder.tsx`.
- `More.tsx`: `limitedSections` reduseres, og off-season-visningen bytter fra bento-grid til kompakt radliste.
- `push-sips` mapper de nye typene til emoji/lydnavn (iOS-varslingslyd krever fortsatt lydfiler i native-bygget).