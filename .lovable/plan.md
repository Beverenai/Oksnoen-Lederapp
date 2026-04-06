
Mål: fikse at hele app-shellen faktisk bruker hele iPhone-høyden nederst. Problemet er sannsynligvis ikke navbaren, men at selve layouten klippes før den når bunnen.

Hva jeg fant
- `index.html` og manifestet ser nå riktige ut for standalone.
- Skjermbildet tyder på at Safari-linjen ikke lenger er hovedproblemet; nå er det layout-høyden som er feil.
- I `src/index.css` låses `html, body` til:
  - `height: 100dvh`
  - så overskrives det av `height: -webkit-fill-available`
  - samtidig med `overflow: hidden`
- På iPhone kan `-webkit-fill-available` bli lavere enn faktisk standalone-skjerm. Da stopper hele appen for tidlig, og safe area nederst blir aldri en del av appens faktiske høyde.
- `AppLayout` bruker også `h-dvh`, så vi har flere lag som prøver å styre høyden samtidig.

Rotårsak
- Hele app-shellen er hardlåst til feil viewport-høyde.
- Bottom-nav ligger riktig nederst visuelt, men innhold/root-containeren slutter før den kommer dit.
- Derfor ser det ut som “plassen nederst ikke brukes”, selv om navbaren er helt nede.

Plan
1. Rydd opp i global høyde-styring i `src/index.css`
- Fjern kombinasjonen som setter både `100dvh` og `-webkit-fill-available` på samme elementer.
- Behold én tydelig strategi for høyde i stedet for flere konkurrerende regler.
- La `html/body/#root` bruke full viewport uten at `-webkit-fill-available` klipper standalone-høyden.

2. Legg inn en robust iPhone viewport-løsning i `src/main.tsx`
- Sett en CSS-variabel, f.eks. `--app-height`, fra `window.visualViewport?.height || window.innerHeight`.
- Oppdater den ved `resize`, `orientationchange` og `visualViewport.resize`.
- Bruk denne bare som layout-grunnlag for app-shellen, så løsningen passer på tvers av iPhone-modeller.

3. Koble app-shellen til den nye høyden i `AppLayout.tsx`
- Bytt ut hard `h-dvh` på rot-wrapperen med en løsning som bruker den nye viewport-variabelen.
- Sørg for at `main` får ekte tilgjengelig høyde og at scroll kun skjer inni content-området, ikke at hele shellen blir avkuttet.

4. Finjuster bunnplass uten å miste pill-designet
- Behold glassmorfisk pill-meny festet til `bottom: 0`.
- La safe area være en del av menyens interne padding, ikke en ekstra “låst” sone utenfor appen.
- Juster `app-content` sin `padding-bottom` så den matcher faktisk nav-høyde, i stedet for en grov fast verdi som `100px`.

5. Begrens endringen til mobil/standalone
- Desktop-layouten skal ikke røres unødvendig.
- Standalone-/mobil-regler holdes isolert så vi ikke skaper nye problemer i vanlig desktop-visning.

Filer som endres
- `src/index.css`
- `src/main.tsx`
- `src/components/layout/AppLayout.tsx`

Forventet resultat
- Hele appen bruker faktisk hele skjermhøyden på iPhone.
- Safe area nederst blir en del av app-shellen i praksis, ikke bare visuelt.
- Pill-menyen beholdes.
- Den “låste” plassen nederst blir betydelig mindre eller forsvinner helt på tvers av iPhone-størrelser.

Teknisk kortversjon
- Dette ser ut som et viewport-height problem, ikke et navbar-problem.
- Mest sannsynlige synder er:
  - `height: -webkit-fill-available`
  - `overflow: hidden` på root-nivå
  - flere konkurrerende høyde-regler (`100dvh` + `h-dvh` + fill-available)
- Den tryggeste fiksen er å styre app-shell-høyden via én eksplisitt CSS-variabel basert på faktisk viewport.
