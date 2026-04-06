
Mål: få installert iPhone-PWA til å bruke hele skjermhøyden nederst, men beholde pill-menyen.

Hva jeg fant
- `index.html` er allerede riktig nok for edge-to-edge: `viewport-fit=cover` og Apple PWA-meta er på plass.
- Problemet sitter i layout/CSS:
  1. `.bottom-nav` er fortsatt en flytende pill med `left/right: 8px`, `bottom: 2px/8px` og avrundede hjørner. Da vil området under pillen alltid være synlig som “dødplass”.
  2. `main` og `.app-content` har ekstra `padding-bottom` for en full tab bar, ikke for en flytende pill. Det gir unødvendig luft over bunnen.
  3. Root-layouten bruker bare `pl-safe pr-safe`, ikke bunnfyll på selve app-skallet. Dermed er det ingen egen bakgrunnsflate som fyller safe area under pillen.
- Skjermbildet ditt bekrefter akkurat dette: pillen flyter over bunnen, og safe-area under den blir stående som et eget felt i stedet for å bli visuelt integrert.

Løsning
1. Behold pill-menyen.
2. La app-skallet selv fylle hele nederste safe-area med samme bakgrunn som siden.
3. Legg pillen visuelt “oppå” dette området.
4. Reduser content-padding nederst slik at skjermen faktisk brukes.

Filer som bør endres
- `src/index.css`
- `src/components/layout/AppLayout.tsx`

Konkrete endringer

1. `src/components/layout/AppLayout.tsx`
- På ytterste wrapper:
  - behold full høyde
  - legg til safe-area-bunn på selve layoutcontaineren, ikke bare i nav
  - sørg for at bakgrunnen dekker helt ned til nederste piksel
- På `main`:
  - bytt ut dagens store `pb-[calc(var(--nav-h)+16px+env(safe-area-inset-bottom,0px))]`
  - bruk mindre padding som matcher en flytende pill, f.eks. nav-høyde + liten luft, men ikke ekstra safe-area en gang til
- Eventuelt legg en egen “bottom-nav-underlay”-div inni layouten, fast plassert nederst, som fyller safe-area med samme bakgrunn/glass-tone som appen mens pillen ligger over.

2. `src/index.css`
- Juster `.app-content` slik at den ikke legger på full tab-bar-padding nederst.
- Endre `.bottom-nav` til:
  - fortsatt `position: fixed`
  - fortsatt pill-form og blur
  - men plasseres med liten offset over bunnen, mens området under fylles av app-layouten
- Legg til en ny stil for underlaget nederst, f.eks.:
  - fast nederst
  - høyde: `calc(env(safe-area-inset-bottom, 0px) + noen få px)`
  - bakgrunn matcher app/bottom-nav
  - z-index under pillen
- Sørg for at standalone/native-reglene brukes på underlaget også, ikke bare på `.bottom-nav`.

Hvorfor dette vil virke
- En flytende pill alene kan aldri “bruke” plassen helt nederst visuelt, fordi den per definisjon flyter over et annet område.
- For å få både pill-look og fullskjermsfølelse må vi skille:
  - visuelt underlag som fyller safe-area helt ned
  - selve pill-menyen som ligger oppå
- Da forsvinner inntrykket av svart/tom stripe, samtidig som pill-designen beholdes.

Hva jeg ikke vil endre
- Ingen navigasjonslogikk
- Ingen roller/Hajolo/Admin/Nurse-funksjonalitet
- Ingen sideinnhold eller routing
- Kun layout og safe-area-håndtering

Forventet resultat
- Installert iPhone-PWA fyller hele skjermen nederst
- Pill-menyen beholdes
- Ingen synlig svart/tom stripe under menyen
- Mindre “luft” mellom innhold og nederste del av skjermen
- Fortsatt korrekt safe-area på iPhone

Tekniske detaljer
- Nåværende root: `AppLayout` wrapper har `pl-safe pr-safe`, men ingen tilsvarende bunnstrategi for flytende nav.
- Nåværende problematiske regler:
  - `src/index.css` → `.bottom-nav { bottom: calc(8px + env(...)) }`
  - `src/index.css` → `.standalone-app .bottom-nav { bottom: 2px }`
  - `src/index.css` → `.app-content { padding-bottom: calc(var(--nav-h) + env(...)) }`
  - `src/components/layout/AppLayout.tsx` → `main` har ekstra `pb-[calc(var(--nav-h)+16px+env(...))]`
- Dette gir dobbelt bunnreservering samtidig som pillen fortsatt ikke fyller safe area visuelt.

Implementasjonsrekkefølge
1. Juster root/main bunnpadding i `AppLayout.tsx`
2. Legg til fast bunn-underlag i layouten
3. Oppdater `.bottom-nav` og `.app-content` i `src/index.css`
4. Behold standalone/native-detektering som allerede finnes i `src/main.tsx`

Resultat etter endring
- Hele appen dekker 100 % av iPhone-skjermen
- Nederste safe area blir en del av appens visuelle bakgrunn
- Pill-menyen kommer tilbake uten “dødplass” under
