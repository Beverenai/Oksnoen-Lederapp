# Morder-leken: runde 2 med 4 gjenopplivede

## 1. Skjul antall gjenlevende for lederne

På Morder-siden fjernes badgen «X i live av Y». Lederne ser bare eget mål, egne drap og statusen sin. Admin beholder full oversikt (i live / drept / topplisten) i admin-fanen.

## 2. Ny funksjon i admin: «Gjenoppliv 4 tilfeldige»

En knapp i Morder-admin som:

- trekker 4 tilfeldige blant de drepte spillerne i gjeldende spill
- setter dem i live igjen (drapstall beholdes for alle)
- mikser de 8 spillerne (4 i live + 4 gjenopplivede) i en helt ny ring, så alle får nytt mål
- viser en bekreftelsesdialog først, og etterpå en liste over hvem som ble gjenopplivet

Ventende drapsmeldinger i spillet ryddes bort, siden alle mål endres.

## 3. Varsling til alle 8

Etter miksing sendes varsling til alle 8 spillere med dagens dødningslyd:

- de 4 gjenopplivede: «Du er tilbake i Morder-leken – sjekk ditt nye mål»
- de 4 som var i live: «Ringen er mikset – du har fått nytt mål»

Sendes fra admin (egen knapp, eller automatisk rett etter gjenopplivingen).

## Teknisk

**Database (migrasjon)**
- Ny security-definer-funksjon `revive_and_reshuffle_murder(_count int default 4)`: admin-sjekk, velger tilfeldige døde (`order by random() limit _count`), setter `is_alive = true`, `killed_by/killed_at = null`, nullstiller `winner_leader_id` på spillet, sletter ventende `murder_kill_claims`, og bygger ny ring med `row_number() over (order by random())` for alle levende spillere. Returnerer navnene på de gjenopplivede.

**Edge function**
- Ny `push-murder-reshuffle`: verifiserer JWT + admin, henter spillerne, sender to varslingstekster (gjenopplivet vs. nytt mål) via eksisterende `push-send`-oppsett og `morderen-drept.caf`. Tar imot listen over gjenopplivede leder-id-er.

**Frontend**
- `src/pages/Morder.tsx`: fjern `alive_count`/`total_count`-badgen.
- `src/components/admin/MurderGameTab.tsx`: ny knapp «Gjenoppliv 4 tilfeldige og miks ringen» med bekreftelsesdialog + varslingsknapp.
- `src/hooks/useMurderGame.ts`: nye mutations `reviveAndReshuffle` og `announceReshuffle`.
