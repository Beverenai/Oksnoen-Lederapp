## Mål

1. Passet skal bla helt smooth (ingen hakking / stopp).
2. Ledere kan selv huke av år (2013 → i år) og periode (1, 2, 3, 4, 4+, 5, 6, 7) på første side.
3. Hver kombinasjon år + periode gir ett stempel — designet kan byttes til egne filer senere.

## Del 1 — Silke-smooth blaing (gjøres først)

Dagens 3D-flip i `LederPass.tsx` bygger opp/ned DOM per drag, oppdaterer flere skygge-lag imperativt, kjører dobbel `requestAnimationFrame`-koreografi og bygger hele sidelisten på nytt hver gang historikken endres. Det er hovedårsaken til hakkingen.

Ny modell:

- Én horisontal "rail" med alle sidene side om side, flyttet med `transform: translate3d(...)`. Ingen rotasjon, ingen flip-blad, ingen skygge-animasjon under drag.
- Under drag: kun én stil-oppdatering per frame (`transform` på rail), ingen React-state.
- Ved slipp: snap til nærmeste side med én CSS-transition (cubic-bezier, ~320 ms). Terskel: 25 % av bredden eller rask flikk.
- Kun tre sider mountes (forrige / nåværende / neste); resten er lettvekts-placeholder. Bilder får `loading="lazy"` og `decoding="async"`.
- Alle side-noder memoiseres, så historikk-endring ikke re-renderer hele passet.
- Beholder: haptics ved sidebytte, `Escape` for lukk, piltaster, `prefers-reduced-motion` (hopper rett til side).
- Fjerner: flip-blad, curl-lag, dobbel-rAF-koreografi, spread-modus-flippen (spread beholdes visuelt på store skjermer, men samme rail-mekanikk).

Etterpå verifiserer jeg med Playwright at drag-sekvensen ender på riktig side uten feil i konsollen.

## Del 2 — Tjenestehistorikk: huk av år + periode

Ny tabell `leader_service_periods`:

| kolonne | type |
| --- | --- |
| id | uuid |
| leader_id | uuid → leaders |
| year | int (2013–inneværende år) |
| period_code | text ('1','2','3','4','4+','5','6','7') |
| created_at | timestamptz |

Unik på (leader_id, year, period_code). Med GRANTs + RLS: leder ser/redigerer kun sine egne rader (via `current_leader_id()`), admin ser og redigerer alle.

UI på første side i passet ("Tjenestehistorikk"-oppslaget):

- Kompakt årsliste 2013 → i år. Trykk på et år åpner de 8 periodesjekkboksene for det året.
- Avhuking lagres umiddelbart (optimistisk), i tråd med app-mønsteret for auto-lagring.
- Sammendragslinje: totalt antall perioder + antall år.
- Kun egen pass er redigerbar; ser du en annen leders pass er avhukingen låst (admin unntatt).

## Del 3 — Stempler

- Ett stempel per år + periode, sortert nyest først, i grid som får plass til 7 per side og paginerer videre til neste stempel-side.
- Stempeltekst: periodenummer stort, "ANNO {år}" rundt kanten (samme visuelle språk som i dag), men flyttet til egen fil `PeriodStamp.tsx`.
- Stempelet slår opp i et register `stampRegistry` med nøkkel `"{år}-{periode}"`. Mangler egendefinert fil, brukes dagens SVG-stempel som fallback. Når du sender inn bildefiler senere legger vi dem inn i registeret uten å røre resten av koden.

## Teknisk

- Filer: `src/components/passport/LederPass.tsx` (deles opp i `PassRail.tsx`, `PeriodStamp.tsx`, `ServiceHistoryEditor.tsx`, `stampRegistry.ts`).
- Ny hook `useLeaderServicePeriods(leaderId)` med React Query for lesing/skriving.
- `leader_period_history` (CSV-importert) beholdes; stemplene slås sammen fra begge kilder, duplikater filtreres på år+periode.
- Én migrering for den nye tabellen.

## Rekkefølge

1. Smooth blaing + verifisering.
2. Migrering + avhuking-UI.
3. Stempel-refaktor med register for kommende filer.
