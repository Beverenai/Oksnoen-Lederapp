## Mål
Få faktiske målinger på den grønne stripen i PWA-modus og så fikse bunnmenyen ut fra disse, i stedet for flere gjetninger.

## Hva jeg vil gjøre
1. Flytte debug-panelet fra bare Hjem-siden til global layout
   - Rendres fra `AppLayout`, så det vises også på `/admin` der feilen faktisk skjer.
   - Fortsatt kun i development eller med `?debug=1`.

2. Utvide debug-panelet med de målingene vi mangler
   - `window.innerHeight`, `window.innerWidth`
   - `document.documentElement.clientHeight`
   - `document.body.clientHeight`
   - `window.visualViewport.height`
   - `--safe-bottom`
   - `.bottom-nav` sin `top`, `bottom`, `height`
   - forskjell mellom viewport-bunn og nav-bunn (`gap`)
   - containing-block-kjeden som allerede er påbegynt
   - tydelig console-log med samme tall så du kan kopiere dem

3. Verifisere om portal-løsningen faktisk hjelper eller om dette er viewport-mismatch
   - Siden screenshotet fortsatt viser grønn stripe under gul meny, skal jeg måle om `nav.bottom` stopper over `innerHeight` / `visualViewport.height`.
   - Hvis det ikke finnes noen reell containing-block-synder, behandler jeg dette som PWA viewport-problem.

4. Implementere målrettet posisjonering for bunnmenyen hvis målingene bekrefter mismatch
   - Låse `.bottom-nav` mot faktisk viewport-bunn via JavaScript/CSS-variabel basert på `visualViewport.height` eller `innerHeight`.
   - Beholde scroll-funksjonalitet i hovedinnholdet.
   - Ikke røre mer enn nødvendig i layouten.

5. Beholde debug-fargene og panelet midlertidig
   - Slik at vi kan bekrefte visuelt at grønt område er borte før opprydding.

## Forventet resultat
- Debug-panelet blir synlig også på Admin.
- Vi får konkrete tall for hvorfor menyen stopper for høyt.
- Bunnmenyen legges helt ned til skjermkanten i installert PWA.
- Grønn stripe forsvinner uten å ødelegge scrolling.

## Tekniske detaljer
- Jeg kommer til å jobbe i `AppLayout.tsx`, `PwaDebugPanel.tsx` og eventuelt `index.css`.
- Mest sannsynlig løsning er en runtime-beregnet offset for `.bottom-nav` i standalone/PWA-modus, fordi dagens CSS med `bottom: 0` + safe-area ikke matcher faktisk viewport på enheten.
- Jeg lar midlertidige diagnostikkmarkører stå til vi har bekreftet at gapet er null.