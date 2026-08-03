## 1. Hjem: rekkefølge på kortene

I `src/pages/Home.tsx`:
- Flytt hero-kortet «Denne økten skal du» (`current_activity`, i dag rundt linje 722) opp som **første kort** rett under de runde hurtigknappene.
- Flytt kortet «Aktiviteter denne økten» (`session_activities`, i dag øverst) helt **nederst**, rett over Morder-leken-boksen. Behold styling, økt-badge og påminnelse, men gjør kortet visuelt roligere (tynn ramme, nøytral bakgrunn) siden det ikke lenger er hovedfokus.
- Resten (kjøkkentjeneste, fix, tau, OBS, ekstra, notater) beholder rekkefølgen mellom disse to.

## 2. Hendelser-tekst

I `src/pages/Hendelser.tsx` byttes hjelpeteksten til:
«Her skriver du inn alle små og store hendelser.»

## 3. Hyttenavn: bare hovednavn

Ledere med flere rom i samme hytte (Seilern Honolulu, Seilern Hawaii, …) skal kun se **Seileren** som én chip.
- Bruk eksisterende `formatMainCabins` i `src/lib/cabinDisplay.ts` som grunnlag, men legg til en liten navnetabell så hovednavnet blir korrekt norsk visningsform: `Seilern → Seileren`, `Balder → Balder`, osv. (fallback = første ord).
- I `Home.tsx` grupperes `leaderCabins` på hovednavn før chips rendres: én chip per hovedhytte, klikk fortsatt til `/my-cabins`.
- Samme hjelpefunksjon brukes der lederens hytter vises som chips/badges (Leaders-oversikt og leder-detaljer bruker allerede `formatMainCabins`, så de får riktig visning automatisk).

## 4. Mini-lederpass i «Mer»

I `src/pages/More.tsx` erstattes den vanlige listeflisen «Lederpasset» med et bredt **mini-pass-kort** øverst i «Min side»:
- Lite passkort i samme stil som passet (mørk forside, navn, rolle, periode-badge, lite stempel-preview), klikkbart til `/lederpass`.
- Rendres som en gjenbrukbar `LederPassMini`-komponent (ny fil `src/components/passport/LederPassMini.tsx`) som tar `leader` + `periodLabel`, uten den tunge PassRail-logikken, slik at «Mer» laster raskt.

## Teknisk

Ingen databaseendringer. Kun frontend: `Home.tsx`, `Hendelser.tsx`, `More.tsx`, `cabinDisplay.ts` og ny `LederPassMini.tsx`.
