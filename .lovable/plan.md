# Hjem-skjerm i "ambient glass"-stil

Referansen (Glebich-videoen) har fire tydelige grep vi kan låne, uten å endre noe funksjonalitet:

1. **Myk ambient bakgrunn** – en rolig, uskarp fargesky (aurora/gradient) bak hele hjem-skjermen, i stedet for flat bakgrunn. Skalerer i lys og mørk modus via design-tokens.
2. **Kompakt topp-rad med små pill-widgets** – i stedet for stor sentrert avatar: en rad øverst med små runde/pill-elementer (profilbilde til høyre, hytte-pill og status-pill til venstre), akkurat som «28°»-pillen og avataren i referansen.
3. **Stor, luftig hilsen som hovedanker** – «God morgen, Nils» med dato over i liten grå tekst, venstrejustert med mye luft. Dette blir det første øyet møter.
4. **Glass-kort med tydelig hierarki** – «Denne økten skal du» blir ett stort, avrundet glass-kort (translucent bakgrunn, myk skygge, delt i to soner: tittel/innhold øverst, detaljer i en litt mørkere fot-stripe). Resten av kortene (kjøkkentjeneste, morderleken, fix, OBS, aktiviteter) får samme glass-språk i mindre format.

Runde hurtigknapper (Hendelser / Overnatting) beholdes, men blir mer glassaktige og legges rett under hilsenen.

## Hva som IKKE endres
- All logikk: admin-styrt `home_screen_config`, rekkefølge, synlighet, farger, tekststørrelser, snus brothers, overnatting-dialog, pull-to-refresh.
- Ingen sider eller navigasjon flyttes.

## Teknisk
- `src/index.css`: nye tokens for ambient-bakgrunn (`--ambient-1..3`) og glass-overflate (`--glass-bg`, `--glass-border`, `--shadow-glass`) + en `.ambient-bg` og `.glass-card`-utility. Alt i HSL, både lys og mørk modus.
- Ny `src/components/home/HomeAmbientBackground.tsx`: fixed, pointer-events-none lag med tre uskarpe fargeflater.
- Ny `src/components/home/HomeGreeting.tsx`: dato + tidsbasert hilsen (God morgen/God dag/God kveld) + fornavn.
- Ny `src/components/home/HomeTopBar.tsx`: liten topp-rad med hytte-pill, evt. team-pill, refresh og avatar (avatar beholder grønn/rød ring for lest-status og åpner profil).
- `src/pages/Home.tsx`: bytter dagens sentrerte hero mot TopBar + Greeting + quick actions; kortene får `glass-card`-klassen. Ingen endring i data-henting.
- `src/components/home/HomeQuickActions.tsx`: glass-variant på knappene (behold størrelse og haptics).

## Rekkefølge på hjem etter endringen
Topp-rad → hilsen → hurtigknapper → «Denne økten skal du» (stort glass-kort) → kjøkkentjeneste/varsler → notater/OBS → aktiviteter denne økten nederst → morderleken-boks nederst.
