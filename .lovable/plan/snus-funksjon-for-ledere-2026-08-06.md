# Snus-funksjon for ledere

Ledere kan si om de snuser, velge hvilken boks de bruker, og andre ser en snus-indikator i lederlisten – så man vet hvem man kan bomme av.

## 1. Profil: snuser du?

På lederprofilen kommer en ny seksjon «Snus»:
- Bryter: Snuser du? Ja / Nei
- Ved «Ja» vises en velger for boks (merke + variant), åpnet i et ark på mobil
- Valgt boks vises som en roterbar 3D-boks (dra for å rotere), i stil med referansebildet
- Lagres automatisk (samme debounce-mønster som resten av appen)
- Ved «Nei» nullstilles valgt boks

## 2. Snus-katalog

Innebygd liste i koden, gruppert på merke med søkefelt. Start med de vanligste:
- **General** (White Portion, Mint, Original, Extra Strong m.fl.)
- **Skruf** (Super White No53 Fresh Mint, Slim Fresh, Nordic Nights m.fl.)
- **The Lab** (serier 1–6 nivåer)
- **Epok** (Ice Cool, Dark Mint, Blueberry m.fl.)
- I tillegg: Siberia, Loop, Odens, Lundgrens, Ettan, Knox, XR

Hver oppføring har merke, variant, smak, farge/aksentfarge, styrke (S1–S5) og hvit/brun – som brukes til å tegne boksen. «Finner du ikke din snus?» lar deg skrive inn fritekst-navn i stedet.

## 3. 3D-boksen

Boksen bygges i kode (ingen produktbilder), som en sylinder med:
- Topplokk med merkenavn, variant, styrkeprikker og farget bue
- Sidekant med gjentatt merketekst og styrkefelt
- Drag/swipe for å rotere, lett auto-rotasjon i ro, «Dra for å rotere»-hint
- Detaljrad under boksen: navn, smak, hvit/brun, styrke – som i referansen

## 4. Ledere-siden

- Liten snus-ikon-chip ved siden av lederens navn i lederlisten (kun når personen snuser), synlig for alle ledere
- I lederdetaljer vises boksen (liten 3D-visning) + merke/variant, slik at man ser hva de bruker
- Valgfritt filter «Snuser» i lederfiltrene

## Teknisk

- Migrasjon på `leaders`: `snus_user boolean not null default false`, `snus_product_id text`, `snus_custom_label text`. Ingen ny tabell – følger eksisterende oppdaterings-policyer for leaders (leder oppdaterer seg selv, admin alle).
- Ny fil `src/lib/snusCatalog.ts` med katalog + typer.
- Nye komponenter: `src/components/snus/SnusCan3D.tsx` (CSS 3D, drag-rotasjon), `src/components/snus/SnusPicker.tsx` (søk + karusell + «Velg denne»), `src/components/snus/SnusBadge.tsx` (chip i lederlisten).
- Integrasjon i `src/pages/Profile.tsx`, `src/pages/Leaders.tsx`, `src/components/leaders/LeaderDetailSheet.tsx`, `src/components/admin/LeaderFilters.tsx`.
- Alt med semantiske design-tokens, mobil-først, ingen hardkodede fargeklasser utenom boksens produktfarger.
