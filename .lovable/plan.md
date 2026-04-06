
Mål: få tilbake glassmorfisk pill-meny, men uten “dødplass” under den i installert iPhone-PWA.

Diagnose:
- `index.html` er allerede riktig for edge-to-edge PWA: `viewport-fit=cover` og Apple PWA-meta finnes allerede.
- Problemet er at `.bottom-nav` nå er gjort om til en full bred tab bar med `bottom: 0` og `padding-bottom: env(safe-area-inset-bottom)`. I en installert iPhone-PWA blir derfor hele safe-area nederst synlig som en høy, tom bar.
- Safe area brukes feil sted akkurat nå: den bør beskytte innholdet i menyen, ikke bli til visuell luft under en flytende meny.
- `main`/`.app-content` er også justert for en full-width bar, så innholdet stopper for tidlig og forsterker følelsen av dødplass.

Plan:
1. Gjeninnfør pill-menyen i `src/index.css`
   - Bytt `.bottom-nav` tilbake til flytende pill med `left/right: 8px`, `border-radius: 20px`, blur og shadow.
   - Fjern dagens full-width tab bar-stil som fyller hele bunnen.

2. Skill mellom installert PWA og vanlig browser
   - Legg egne regler for `@media (display-mode: standalone)` og eventuelt native/Capacitor-tilfeller.
   - I installert PWA skal pillen ligge nesten helt nederst (`bottom: 2px` eller tilsvarende minimal offset).
   - I vanlig browser kan vi beholde litt tryggere offset hvis browser-UI krever det.

3. Bruk safe area inni menyen, ikke som gap under menyen
   - Juster den indre nav-containeren slik at ikon/tekst fortsatt ligger trygt over swipe-området.
   - Selve pillen skal visuelt ligge tett mot bunnen i stedet for å flyte en hel safe-area over den.
   - Midtknappen (Hajolo/Admin/Nurse) beholdes som nå, med samme prominente FAB-oppsett og lest/ulest-status.

4. Reduser bunnpadding for innhold i `AppLayout.tsx`
   - Oppdater `<main>` og/eller `.app-content` slik at padding nederst matcher faktisk høyde på pillen, ikke en full bred dock.
   - Dette gjør at innholdet kan bruke mer av den nederste delen av skjermen.

5. Behold fullskjerm-app uten svarte striper
   - La full-height-oppsettet for `html`, `body` og `#root` stå, så appens bakgrunn fortsatt dekker hele skjermen.
   - Ikke endre funksjonaliteten i header, navigasjon eller Hajolo-logikk — kun layout/CSS og eventuell standalone-detektering.

Filer som endres:
- `src/index.css`
- `src/components/layout/AppLayout.tsx`
- eventuelt `src/main.tsx` hvis vi trenger en enkel `standalone/native` klasse på `<body>` for presis styling

Forventet resultat:
- Pill-menyen kommer tilbake
- Den sitter nesten helt ned mot bunnen i installert PWA
- Ingen stor tom sone under menyen
- Innholdet bruker mer av skjermen nederst
- Hajolo-knappen ser ut og oppfører seg som før
