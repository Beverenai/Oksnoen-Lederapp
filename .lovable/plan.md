## Mål

Erstatte den horisontale slide-animasjonen i `LederPass` med en ekte 3D-bokfølelse: sidene skal løftes fra hjørnet, rotere om ryggen med perspektiv, kaste skygge på siden under, og lande på venstre halvdel — akkurat som når man blar i et pass.

## Bibliotek

Bruke `react-pageflip` (StPageFlip-porten for React). Den håndterer det som er vanskelig å få riktig for hånd:
- Hjørne-peel som følger fingeren
- Myk skygge over den siden man blar til
- Papir-«bøying» midtveis i vendingen
- Riktig z-orden så flere ark kan ligge oppå hverandre
- Tastatur- og drag-input, med snap tilbake hvis man ikke drar langt nok

Alternativ hvis vi vil unngå ny avhengighet: håndbygget CSS-3D med `rotateY` + `transform-style: preserve-3d` og en stack av «ark» der front = høyre side i oppslag N og bakside = venstre side i oppslag N+1. Fungerer, men mister hjørne-peel og realistisk skygge uten mye ekstra kode. Anbefaler biblioteket.

## Endringer i `src/components/passport/LederPass.tsx`

1. **Bytt datamodell fra oppslag til enkeltsider.** I dag bygger `buildSpreads` par av `{ left, right }`. Flate ut til en lineær liste med sider `pages = [cover, spread0.left, spread0.right, spread1.left, spread1.right, …, backCover]` slik at boken har ekte enkeltark som vendes én og én. Første og siste side blir cover/bakside i rødt bokbind (samme tekstur som i dag).

2. **Rendre `<HTMLFlipBook>` inne i «Book»-området** (der `trackRef`-diven ligger nå, linje 558–636). Konfigurasjon:
   - `size="stretch"`, `minWidth={280} maxWidth={520}`, `minHeight={380} maxHeight={720}` slik at boken skalerer med skjermen på både mobil (én synlig side) og bredere layout (to synlige sider).
   - `showCover={true}` for at rødt bokbind står som et ekte cover som vippes opp første gang.
   - `usePortrait={true}` på mobil (via `window.matchMedia('(max-width: 640px)')`) så vi ser én side av gangen; ellers to.
   - `drawShadow`, `flippingTime={700}`, `maxShadowOpacity={0.35}`, `mobileScrollSupport={true}`.
   - `onFlip` → oppdatere lokal `index` og trigge `hapticSelection()` for taktil vending.

3. **Fjerne dagens pointer-drag-håndtering** (`onPointerDown/Move/Up`, `dragDx`, `percent`, `translateX`). Biblioteket eier gestene.

4. **Beholde:**
   - Hentekallet til `leader_period_history` og `buildSpreads`-innholdet (bare pakke om til enkeltsider).
   - Punktindikatoren nederst (viser gjeldende side; klikk kaller `bookRef.current.pageFlip().flip(i)`).
   - Header-bildet, tittelen, «Lukk»-knappen når `inline={false}`, tastatursnarveiene (piler/Escape) — koblet til `pageFlip().flipNext()/flipPrev()`.
   - Rødt bokbind + gullramme rundt boken (som ytre wrapper utenfor `HTMLFlipBook`).

5. **Sidebakgrunn og papir.** Hver side er en `<div>` med samme `ivory-paper`-tekstur som i dag, med indre padding og et lite «ryggskygge»-gradient i innerkant (venstre side har skygge til høyre, høyre side har skygge til venstre) — det gir illusjon av papir mot rygg.

6. **`LederPassIcon`** (den lille 3D-ikonknappen) forblir uendret.

## Avhengighet

Legge til `react-pageflip@^2` (aktivt vedlikeholdt, MIT, ~40 kB gzipped, ingen peer-avhengigheter utover React 18 som prosjektet allerede bruker).

## Verifisering

- Typecheck kjøres etter endringene.
- Manuell test på mobil-viewport (393×844) via preview: åpne inaktivt-modus, sjekk at:
  - Cover åpnes med vipp
  - Enkeltsider vendes én og én med finger-peel
  - Punktindikatoren følger med
  - Escape/piltaster fortsatt virker
  - `LederPassIcon` åpner fullskjerm på Home når active-mode
