
Mål: få app-shellen til faktisk å bruke nederste del av iPhone-skjermen, uten å miste pill-menyen.

Hva jeg fant
- `index.html` og manifest-oppsettet ser nå riktig ut for standalone.
- Problemet ser ikke lenger ut til å være selve navbaren.
- Nåværende kode bruker allerede `--app-height`, men den settes fra `window.visualViewport.height` i `src/main.tsx`.
- På iPhone kan `visualViewport.height` være lavere enn den faktiske tilgjengelige standalone-flaten. Da blir hele root-containeren for kort.
- `AppLayout.tsx` låser hele app-shellen direkte til `style={{ height: 'var(--app-height, 100dvh)' }}`.
- Når rooten er for lav, hjelper det ikke at `.bottom-nav` ligger på `bottom: 0`; safe area under oppleves fortsatt som “låst” fordi selve appen stopper før den.

Rotårsak
- Vi styrer hele appens høyde fra feil målepunkt.
- `visualViewport.height` er sannsynligvis synderen nå, ikke `-webkit-fill-available`.
- App-shellen bør ikke hardlåses til en høyde som kan bli mindre enn faktisk skjermflate.

Plan
1. Bytt viewport-strategi i `src/main.tsx`
- Slutt å bruke `visualViewport.height` som primær kilde for app-shell-høyde.
- Bruk `window.innerHeight` som basis for `--app-height`.
- Behold resize/orientation-oppdatering, men gjør løsningen enklere og mer stabil på iPhone.

2. Gjør root-layout mer tolerant i `src/index.css`
- Endre `html`, `body` og `#root` fra hard `height` til en kombinasjon der appen minst fyller viewporten, i stedet for å bli klippet.
- Behold kontrollert scrolling, men unngå at root-nivået blir “kortere enn skjermen”.

3. Juster app-shellen i `src/components/layout/AppLayout.tsx`
- Bytt fra hard `height` til `minHeight` eller en mer robust full-height-strategi på wrapperen.
- Sørg for at `main` fortsatt er eneste scroll-område, men at shellen kan strekke seg helt ned.

4. Finjuster bunnnavigasjon og content-spacing
- Behold pill-designet på `.bottom-nav`.
- La safe area fortsatt være en del av menyens interne padding.
- Match `app-content` sin `padding-bottom` bedre mot faktisk nav-høyde, så vi ikke reserverer mer plass enn nødvendig.

5. Begrens endringen til mobiloppsettet
- Desktop skal fortsatt bruke dagens oppførsel.
- Endringen holdes isolert til mobil/standalone-app-shellen.

Filer som bør endres
- `src/main.tsx`
- `src/index.css`
- `src/components/layout/AppLayout.tsx`

Forventet resultat
- App-shellen stopper ikke for tidlig på iPhone.
- Nederste safe area blir en faktisk del av appens høyde.
- Pill-menyen beholdes nederst.
- Den låste plassen nederst blir klart mindre eller forsvinner.
