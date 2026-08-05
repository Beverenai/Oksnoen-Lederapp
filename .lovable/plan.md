# Morder-leken runde 2: Spøkelseslag og tidsfrist

To nye lag med mekanikk oppå dagens ring-spill. Ingenting endres for dagens runde før admin starter en ny.

## 1. Spøkelseslag for drepte

Når du blir bekreftet drept havner du i **Spøkelseslaget** i stedet for å være ferdig med leken.

- Morder-siden bytter til «Spøkelses-modus»: mørkt tema, egen liste med oppdrag i stedet for mål.
- Admin lager oppdragsbanken (tittel, beskrivelse, poeng) — f.eks. «Få en levende spiller til å si navnet ditt», «Stå bak en levende spiller i 30 sekunder uten å bli sett».
- Spøkelset melder inn fullført oppdrag. En annen leder (eller admin) bekrefter. Bekreftet oppdrag gir poeng til spøkelseslagets felles sum.
- Felles teller vises både for spøkelser og levende: «Spøkelseslaget: 14 poeng».
- **Hjemsøkelse:** når spøkelseslaget når en poengterskel admin setter, kan admin utløse en hjemsøkelse — alle levende får halvert tidsfrist på gjeldende mål og en varsling. Gir de døde noe reelt å kjempe for.
- Alle spøkelsesoppdrag og poeng lagres per spill/periode, så vi ser statistikk i etterkant.

## 2. Tidsfrist per mål

Hvert mål får en frist (admin setter timer, standard 24 t) som starter når du får målet.

- Nedtelling vises på Morder-siden («Frist: 5 t 12 min»), og blir rød under 2 timer.
- Varslinger med dagens dødningslyd: påminnelse ved 6 timer og 1 time igjen.
- Går fristen ut blir du **sultet ut**: du er ute av leken (havner i spøkelseslaget), og din egen morder arver målet ditt — samme kjedelogikk som et vanlig drap, så ringen holder seg hel.
- Fristen nullstilles hver gang du får nytt mål. Admin kan pause fristene (samme som å sette leken på pause) og gi enkeltspillere forlengelse.
- Admin ser en «Frister»-liste sortert etter hvem som er nærmest utløp.

## Teknisk

**Database**
- `murder_players`: nye felter `target_assigned_at`, `target_deadline_at`, `died_of_starvation`, `ghost_points`.
- `murder_games`: `deadline_hours` (default 24), `deadlines_paused`, `ghost_points_total`, `haunt_threshold`, `haunt_triggered_at`, `round_number`.
- Ny tabell `murder_ghost_missions` (tittel, beskrivelse, poeng, aktiv) — admin-styrt bank, ikke periodebundet.
- Ny tabell `murder_ghost_claims` (game_id, ghost_leader_id, mission_id, status pending/confirmed/rejected, confirmed_by) med GRANTs og RLS: spøkelser skriver egne krav, alle spillere leser, admin/bekrefter oppdaterer.
- Nye/oppdaterte security-definer-funksjoner: `confirm_murder_death` og `start_murder_game` setter frister; `claim_ghost_mission`, `confirm_ghost_mission`, `trigger_murder_haunt`, `extend_murder_deadline`, `starve_murder_player`.
- `get_my_murder_state` utvides med frist, spøkelsesstatus og lagets poengsum.

**Backend-jobb**
- Ny edge function `murder-deadline-tick` som kjøres på timeplan (cron): sender påminnelser (6 t / 1 t) og sulter ut utløpte spillere, gjenbruker eksisterende push-oppsett og `morderen-drept.caf`.

**Frontend**
- `src/pages/Morder.tsx`: nedtellingsring på målkortet, spøkelses-modus med oppdragsliste og innmelding, felles spøkelsesteller.
- `src/components/admin/MurderGameTab.tsx`: fristinnstilling, fristliste med forlengelse, oppdragsbank, bekreftelseskø for spøkelsesoppdrag, hjemsøkelses-knapp.
- `src/hooks/useMurderGame.ts`: nye queries/mutations og realtime på de nye tabellene.
