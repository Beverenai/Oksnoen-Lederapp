# Plan: Bunnmeny helt nederst på PWA – uten død stripe

## Mål
- Menyen skal ligge på **bunnen** av skjermen igjen (ikke topp).
- På iOS PWA skal den **klistres helt ned** mot home-indicator – ingen tom stripe under.
- Skal fungere både i Safari, installert PWA og Capacitor.

## Hvorfor det feilet sist
Vi hadde `#root { height: 100% }` + en intern `<main>` med `overflow-y: auto`, og bunnmenyen som `position: fixed; bottom: 0`. På iOS endrer `visualViewport` seg når URL-baren vises/skjules – men `position: fixed` i en låst container følger **layout viewport**, ikke visual viewport. Resultat: menyen "fløt" oppover med ~10 % tom plass under.

## Ny tilnærming – body-scroll + ekte fixed
1. **Slipp viewport-låsingen** (samme prinsipp som hvaerpeptider-prosjektet):
   - `html, body, #root` får `min-height: 100svh` og `height: auto` (ingen `height: 100%`).
   - Fjern intern `<main overflow-y: auto>` – la `body` scrolle naturlig.
2. **Bunnmenyen** rendres som `position: fixed; bottom: 0; left: 0; right: 0` direkte på body (via portal), med `padding-bottom: env(safe-area-inset-bottom)` slik at innholdet i pillen ikke havner under home-indicator, men selve menyens bakgrunn fyller helt ned.
3. **Innholds-spacer**: nederst i `<main>` legger vi `padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)` så siste innhold ikke gjemmes bak menyen.
4. **Fjern toppmeny-tabs** som ble lagt til i forrige iterasjon.
5. **Behold animasjonen** "skjul ved scroll-ned, vis ved scroll-opp" – men lytt nå på `window` scroll (som faktisk fyrer siden body scroller).

## Filer som endres
- `src/components/layout/AppLayout.tsx` – fjern top-tabs, gjeninnfør `<BottomNav>` portal, bytt scroll-target til `window`, fjern `min-h-[100svh]` på main-wrapper.
- `src/index.css`:
  - `html, body, #root`: `min-height: 100svh; height: auto;` (ingen flex-låsing).
  - Ny `.bottom-nav-fixed`-klasse: `position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom); background: app-bg;` slik at hele safe-area under pillen er fylt med samme farge – ser ut som menyen går helt ned.
  - Fjern `.top-tabs`-reglene.
  - `.app-content` får kun `padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)`.
- `src/components/debug/PwaDebugPanel.tsx` – ingen endring nødvendig (leter allerede etter `.bottom-nav`).

## Hvorfor stripa forsvinner nå
- Når `body` er det som scroller, regner iOS `position: fixed` mot **visual viewport**. Menyen følger derfor URL-bar-bevegelser presist.
- `padding-bottom: env(safe-area-inset-bottom)` på selve menyen gjør at menyens *bakgrunn* dekker home-indicator-området, mens *knappene* sitter trygt over.
- Ingen `100dvh`-låsing betyr ingen "feil" høyde-beregning når tastatur eller URL-bar dukker opp.

## Ikke berørt
- Desktop-sidebar, header, hamburger-meny, Hajolo-funksjonalitet, ruting, RLS, edge functions, DB.

## Risiko / kjente begrensninger
- Apple lar oss ikke plassere *interaktive* elementer direkte på home-indicator-stripen – det er derfor vi bruker `padding-bottom` på menyen i stedet for å gjøre den lavere. Dette er like nært bunnen som iOS tillater.
- Pull-to-refresh på `body` kan trigges – vi beholder `overscroll-behavior: none` på `html, body` for å unngå det.
