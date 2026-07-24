## Problem

I `appMode === 'inactive'` fyller `Home.tsx` skjermen med `<LederPass fill>`, men inne i `LederPass` er selve boka begrenset av:

- En 128–160px høy header-illustrasjon + tittel/undertittel + kontroller under
- `max-w-[560px]` og fast `aspect-[3/2]` (landskap)
- En ytre `overflow-y-auto` som gjør at boka aldri får bruke tilgjengelig høyde

På mobil (393×844) blir resultatet et lite landskap-oppslag øverst i et scroll-view. Selv om vippemekanikken faktisk er 3D (rotasjon rundt ryggen med `preserve-3d`, backface-hidden, dynamisk skygge), oppleves det som en liten kortkarusell fordi boka er så komprimert og formatet ikke ligner et pass.

## Mål

- I fullskjerm (inactive-modus) skal boka fylle skjermen og se ut som et faktisk pass/bok.
- 3D-blaingen skal føles ekte: én stor side som brettes over ryggen, tydelig papirtykkelse, skygge, curl.
- I aktiv modus beholdes det lille ikonet uendret og åpner nå det samme fullskjermspasset som overlay.

## Endringer

Alt skjer i `src/components/passport/LederPass.tsx`. Ingen andre filer røres. `Home.tsx` fortsetter å rendre `<LederPass leader={effectiveLeader} fill periodLabel={activePeriodLabel} />` som i dag.

### 1. Ny fullskjerm-layout (inline `fill`-modus)

- Fjern header-bilde, "Lederpass"-eyebrow, stor `<h1>` og "Dra siden..."-undertittel fra selve pass-flaten. Erstatt med en tynn topplinje: liten `SealMark`, lederens fulle navn i serif, aktiv periode som eyebrow. Tar ~48–56px.
- Bunnlinje (også tynn, ~56px): prikker + små chevron-knapper + subtil "Dra for å bla"-hint. Fjern lukk-knappen på hjemskjermen (den er kun for modal-varianten).
- Midt: én flex-1 wrapper der boka sentreres og skaleres til å bruke `min(100vw, 100dvh - top - bottom)` med et sideforhold som matcher passet (se pkt. 2). Ingen ytre scroll — hele skjermen tilhører boka.

### 2. Portrett-passformat på smale skjermer, spread på brede

Passet skal se ut som et pass, ikke en åpen bok, når skjermen er smal.

- Legg til `useLayoutEffect` som måler containeren og bestemmer `mode: 'single' | 'spread'` basert på tilgjengelig bredde/høyde. Terskel: `spread` når container-bredde ≥ 720px OG bredde > høyde, ellers `single`.
- `single`-modus: én side vises av gangen i portrett (sideforhold ~ 2/3). Hver `Spread` splittes i to sekvensielle `Page` (venstre så høyre), slik at 5 spreads → 10 sider. Ryggen er på venstre side; blaingen roterer siden rundt venstre kant fra 0° → -180°. Bak-siden viser neste side.
- `spread`-modus: samme layout som i dag, men boka fyller tilgjengelig areal (ikke `max-w-[560px]`).

### 3. Fyll boka ut i tilgjengelig areal

- Bytt `max-w-[560px]` + `aspect-[3/2]` med målt størrelse:
  - Container-refs på ytre boks; regn ut boka: `H = availableH`, `W = H * ratio` der `ratio = 2/3` (single) eller `3/2` (spread). Klem så `W ≤ availableW` og reduser `H = W / ratio`.
  - Bruk piksler i style så boka blir så stor som mulig uten scroll.
- Papirkantene (ivory strips), rødt bokrygg-skjær og bunnskygge skalerer via prosent/rem — sjekk at de fortsatt ser proporsjonelle ut på stor størrelse (øk padding/border-radius litt når `H > 500px`).

### 4. Mer troverdig 3D-blaing

Beholder dagens leaf-modell (fast venstre/høyre-halvdel + én roterende leaf), men gjør den mer fysisk:

- Legg til en subtil `curl`: leafet får en indre `radial-gradient` skygge langs den frie kanten som blir sterkere mellom 0–90° og forsvinner mot 180°.
- To semitransparente skyggelag på base-halvdelene som mørkner der leafet svever over, drevet av `flipProgress`.
- Øk `perspective` fra 1400px til `min(1800, W*3)`, og legg til `transform: translateZ(0)` på leafet så GPU-laget er stabilt.
- Innfør en liten "papir-vridd"-CSS-variabel: leaf-elementet skaleres marginalt (`scale(1.005)` på topp av flippen) for å hinte tykkelse.
- Snapp-terskel: hev commit fra 0.5 til 0.35 slik at draget føles lettere; behold `cubic-bezier(0.32,0.72,0.28,1)` men øk varighet til 520 ms i single-modus (større flate = trenger litt mer tid).

### 5. Aktiv modus (ikke-inactive) — ikonet åpner fullskjerm

`Home.tsx` bruker allerede `LederPassIcon` når active. I dag har ikonet ikke onClick fra Home. Vi lar `Home.tsx` være i fred; i stedet endrer vi ingen adferd for ikonet. (Hvis brukeren vil ha click-to-open i active-modus også, gjøres det i en egen oppgave — det er utenfor "gjør passet stort og ekte".)

### 6. Redusert bevegelse / a11y

- `prefers-reduced-motion`: hopper som i dag, uten leaf-animasjon.
- Piltaster/dot-tabs beholdes; sikrer at fokus-outline er synlig mot rødt cover.

## Filer

- `src/components/passport/LederPass.tsx` — full omskrivning av `LederPassFullView` (layout, måling, single/spread-modus, curl/skygge). `LederPassIcon`, `buildSpreads`, historikk-fetch og modal-innpakningen forblir uendret bortsett fra at fullscreen-headeren blir en tynn topplinje.

## Teknisk

- Måling via `ResizeObserver` på ytre `flex-1` container, oppdaterer `{ mode, pageW, pageH }` state.
- Sider i single-modus: `pages = spreads.flatMap(s => [{ side:'left', ...}, { side:'right', ...}])`. Blaingen mapper fortsatt til én leaf; front/back-face bruker `pages[index]` / `pages[index±1]`.
- Sideforhold: `single = 2/3` (portrait passport), `spread = 3/2` (dagens landskap).
- Ingen nye avhengigheter. Ingen DB-endringer. Ingen ruter- eller navigasjons-endringer.

## Verifisering

- `tsgo` typecheck.
- Playwright: åpne `http://localhost:8080/` under inactive-modus, sett viewport 393×844, screenshot at boka fyller skjermen i portrett med tydelig bok/pass-utseende. Bla én side fram og tilbake via drag; screenshot midt i flippen for å se 3D-vinkel.
- Sett viewport 1280×800, verifiser at spread-modus aktiveres og boka skalerer opp uten scroll.
