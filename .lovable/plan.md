# Morder-leken

Et snikmorder-spill for ledere: alle får én leder de skal "drepe". Kjeden går rundt i en ring, og når noen dør arver morderen offerets mål.

## Slik fungerer det for lederen

1. Når spillet er aktivt vises en ny knapp på Hjem-skjermen ("Morder-leken") som går til `/morder`.
2. På Morder-siden ligger målet skjult bak en **Reveal**-knapp – man må aktivt trykke for å se navnet (og bildet) på den man skal drepe.
3. Under målet: to knapper
   - **Jeg har drept personen** → registrerer et drapsforsøk (venter på offerets bekreftelse). Lederen ser "Venter på at [X] bekrefter" og får ikke nytt mål før det.
   - **Jeg har blitt drept** → bekrefter drapet. Lederen blir markert som død, ser en "Du er ute"-skjerm med hvem som tok deg, og morderen arver offerets mål automatisk.
4. Alt oppdateres i sanntid, så morderen ser det nye målet (skjult bak Reveal igjen) i samme øyeblikk offeret bekrefter.
5. Når bare én leder står igjen vises "Vinner"-tilstand.

## Admin

Ny fane i Admin-innstillinger: **Morder-leken**
- Bryter for å slå spillet av/på (aktiv periode).
- Deltakerliste: alle aktive ledere er med som standard; admin kan haka av enkeltledere for å ta dem ut før start.
- **Start / nullstill spill**: trekker en tilfeldig ring av alle deltakere.
- Oversikt bak en **Reveal**-knapp (siden admin selv spiller):
  - Kjede-visning: A → B → C → … med grønn (i live) / grå (død) status og tidspunkt.
  - Graf/ring-visning som viser hele "spindelvevet" og hvem som tok hvem.
  - Liste over ventende drap som admin kan bekrefte manuelt hvis offeret glemmer å trykke.
- Statistikk: antall i live, antall drepte, leder med flest drap.

## Teknisk

Nye tabeller (per periode, RLS-sikret):
- `murder_games`: `period_id`, `is_active`, `started_at`, `winner_leader_id`.
- `murder_players`: `game_id`, `leader_id`, `target_leader_id`, `is_alive`, `killed_by`, `killed_at`, `kills` — unik per (game, leader).
- `murder_kill_claims`: `game_id`, `killer_leader_id`, `victim_leader_id`, `status` (pending/confirmed/rejected), `confirmed_at`.

Logikk:
- Start: security-definer-funksjon `start_murder_game(period_id)` trekker deltakerne i tilfeldig rekkefølge og setter target til neste i ringen.
- Bekreftelse: funksjon `confirm_murder_kill(claim_id)` (kun offeret eller admin) markerer offer som død, setter `killer.target = victim.target`, øker `kills`, og kårer vinner når kun én lever.
- Policies: ledere ser bare sin egen rad (mål-navn hentes via egen view/funksjon), admin ser alt. GRANT til `authenticated` + `service_role`.

Frontend:
- `src/hooks/useMurderGame.ts` — spillstate, claims, realtime-abonnement, mutasjoner.
- `src/pages/Morder.tsx` — reveal-kort, de to knappene, død/vinner-tilstand.
- `src/components/admin/MurderGameTab.tsx` — bryter, deltakervalg, start/nullstill, reveal-oversikt med kjede + graf.
- Hjem-knapp i `src/pages/Home.tsx` (samme mønster som Oppgave-roulette), rute i `src/App.tsx`, fane i `AdminSettingsContent.tsx`.
