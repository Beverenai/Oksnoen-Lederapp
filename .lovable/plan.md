# Ny mobilmeny: scrollbar tabs øverst

## Mål
- Erstatte dagens bunnmeny på telefon med en horisontal scrollbar tab-bar rett under headeren (à la Twitter/Instagram).
- Få plass til alle hovedsidene (Hjem, Passkontor, Hajolo/Nurse, Ledere, Fix, Admin/Dashboard m.m.) uten å klemme inn 5 ikoner.
- Frigjøre hele bunnen av skjermen — ingen meny som ligger «for høyt» med tom safe-area under.

## Slik blir det
```
┌─────────────────────────────┐
│ ← / logo    navn   [Meny]  │  ← header (uendret, kollapser ved scroll)
├─────────────────────────────┤
│ Hjem  Passkontor  Hajolo …│  ← NY scrollbar tab-bar (sklir med headeren)
├─────────────────────────────┤
│                             │
│        innhold              │
│                             │
│                             │
│                             │  ← hele bunnen er nå innhold
└─────────────────────────────┘
```

- Aktiv tab får primary-farge underline + bold tekst, inaktive er muted.
- Tab-baren scroller horisontalt og auto-scroller slik at aktiv tab alltid er synlig.
- Tab-baren følger headeren: synlig øverst og når man scroller opp, skjules ved scroll ned (samme `headerVisible`-state som i dag).
- Hamburger-menyen beholdes for sjeldnere sider (Min profil, Viktig info, Skjær, Historier, Vaktplan, Tau Kontroll, Deltagere, Admin-undersider).

## Tabs per rolle
Samme logikk som dagens `getBottomNavItems`, men flatere og med flere ikoner siden vi ikke er begrenset til 5:

- **Admin/Superadmin:** Hjem · Passkontor · Dashboard · Ledere · Fix · Deltagere
- **Nurse:** Hjem · Passkontor · Nurse · Ledere · Fix
- **Vanlig leder:** Hjem · Passkontor · Hajolo · Ledere · Fix

Hajolo beholder sin spesialoppførsel (rød ring når uleste, confetti, tooltip), bare flyttet til tab-baren.

## Filer som endres
- `src/components/layout/AppLayout.tsx`
  - Fjern `BottomNav`-renderingen, `getBottomNavItems`-bruken nederst, og `visualViewport`-hacket for `.bottom-nav` (ikke lenger relevant).
  - Behold `BottomNavItem`-typen og `getBottomNavItems()` for tabs-listen (gi nytt navn `getTopTabs`).
  - Legg til en ny komponent `<TopTabBar>` rendret rett under headeren — `position: fixed`, `top: calc(56px + var(--safe-top))`, samme `transform`-animasjon som headeren, `overflow-x-auto`, `scrollbar-hide`.
  - Innhold-containerens `padding-top` blir `calc(56px + var(--safe-top) + 44px)` (header + tab-bar) i stedet for bare `56px + safe-top`.
  - Fjern `padding-bottom: env(safe-area-inset-bottom) + 64px` fra main; ny verdi blir bare `var(--safe-bottom)`.
- `src/index.css`
  - Slett/forenkle `.bottom-nav`-reglene.
  - Legg til `.scrollbar-hide` utility hvis den ikke finnes.
  - Legg til `.top-tabs`-stil (glassmorphism-bg, border-b).
- `src/components/debug/PwaDebugPanel.tsx`
  - Oppdater referanser til `bottom-nav` (kun tekst/labels).

## Logikk for aktiv tab + auto-scroll
- Bruk `useLocation()` for å finne aktiv path.
- I `useEffect` på `location.pathname`: finn aktivt tab-element via ref og kall `scrollIntoView({ inline: 'center', behavior: 'smooth' })`.

## Hva som IKKE endres
- Desktop-sidebar (`lg:`-breakpoint) er uendret.
- Hamburger-meny / drawer er uendret.
- Header (logo + navn + meny-knapp + scroll-collapse) er uendret.
- Hajolo-knappens funksjonalitet, confetti og tooltip beholdes — bare visuelt flyttet.
- Ingen DB-, RLS-, eller routing-endringer.

## Risiko / detaljer
- Tab-baren må ligge UNDER headeren i z-index (header `z-50`, tabs `z-40`) så header-skygge ikke skjæres av tabs.
- Når headeren skjules ved scroll, må tabs også skjules samtidig (samme `transform`).
- iOS PWA safe-area: tab-baren trenger ingen `safe-area-inset-bottom`-håndtering siden den nå er på toppen — det fjerner hele klassen av PWA-bugs som plaget bunnav.