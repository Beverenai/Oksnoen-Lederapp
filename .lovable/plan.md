
## Mål

Rydde opp i mobilnavigasjonen. I dag har bunnraden 5 knapper inkludert Hajolo som knapt brukes, og en hamburger-meny med mange sjelden brukte destinasjoner. Vi bytter til 4 faste tabs og flytter alt annet til én ny "Mer"-side.

## Ny bunnrad (mobil)

Samme for alle roller — enkelt og forutsigbart:

```text
[ Hjem ]   [ Passkontroll ]   [ Ledere ]   [ Mer ]
```

- Hajolo-knappen fjernes fra bunnraden.
- Hamburger-menyen i toppen fjernes på mobil — "Mer"-tabben erstatter den.
- Inaktiv-modus beholdes uendret (kun Hjem + Ledersnakk).

## Ny side: `/mer`

Én stillegående grid-side med alle destinasjoner som ikke er i bunnraden. Layouten følger eksisterende glassmorphism/kort-stil (Kabana-grid) fra Admin-innstillinger.

Seksjoner, i denne rekkefølgen, med kort som viser ikon + navn:

- **Min side** — Min Profil, Din Hytte, Min vakt
- **Ledelse** — Tau Kontroll, Gjenglemt, Gensere (kun når sweaters_enabled), Vaktplan (kun når schedule_image finnes)
- **Innhold** — Viktig info, FIX, Skjær (admin), Historier (admin)
- **Spesial** — Nurse (nurse), Deltagerstatistikk (admin/nurse), Admin Dashboard (admin)
- **Konto** — Logg ut

Kortene har liten "ny/uleste"-prikk hvis relevant (f.eks. Viktig info hvis ulest). Ingen kategori-header uten kort — tomme seksjoner skjules.

## Hajolo — hva skjer med selve funksjonen?

Selve "Hajolo — bekreft lest"-logikken (leader_content.has_read, konfetti, tooltip) fjernes fra bunnraden. Vi lar handlingen leve videre der den allerede finnes (Hjem-skjermens Viktig info-kort/hendelser), slik at ingen backend-atferd endres. Ingen ny plassering av selve knappen — brukeren har bekreftet at Hajolo ikke brukes.

## Endringer per fil

- `src/components/layout/AppLayout.tsx`
  - `getBottomNavItems`: erstattes med én felles liste `[Hjem, Passkontroll, Ledere, Mer]` for alle roller (unntatt inaktiv-modus).
  - Fjern Hajolo-knapp, tooltip, `showHajoloSuccess`, `handleHajoloClick`, `handleDismissTooltip`, `has_seen_hajolo_tooltip`-lesing/skriving relatert til bunnrad.
  - Fjern hamburger-trigger og mobile drawer-innhold. Behold header (logo + eventuelle admin-hurtigknapper som QuickNotificationSheet).
  - `NavGroup`/`NavLinkItem` og gruppestate flyttes ut av layouten og gjenbrukes på /mer.
- `src/pages/More.tsx` (ny)
  - Rendrer seksjonene beskrevet over som kort-grid, med samme role/feature-flag-gating som dagens hamburger.
  - Bruker eksisterende hooks: `useAuth`, `useSweatersEnabled`, `useCheckoutEnabled`, `useAppMode`, samt `app_config.schedule_image_url`.
- `src/App.tsx`
  - Ny rute `/mer` → `<More />` (leader-beskyttet, som resten).
- `src/components/layout/AppLayout.tsx` — legg `/mer` inn i `bottomNavItems` som fjerde tab (`Grid` eller `LayoutGrid` ikon fra lucide, label "Mer").

## Ting som ikke endres

- Backend, RLS, tabeller, edge functions.
- Selve destinasjonssidene (Passkontroll, Ledere, Nurse, Admin, osv.).
- Design-tokens, farger, glass-stil, safe-area-håndtering.
- Inaktiv-modus (Hjem + Ledersnakk fortsatt).
- Desktop-layout (bunnraden vises som i dag — bare 4 knapper nå).

## Åpne spørsmål jeg antar svar på (si fra hvis du vil noe annet)

- Admin får Ledere som fast tab (ikke Dashboard). Dashboard flyttes til /mer under Spesial.
- Nurse får Ledere som fast tab (ikke Nurse). Nurse-siden flyttes til /mer under Spesial.
- Hvis du heller vil at admin/nurse skal se sin rolle-tab (Dashboard/Nurse) i bunnraden i stedet for Ledere, sier du bare fra så bytter jeg tredje slot per rolle.
