# Dobbel X, off-season-bakgrunn og sletting av ledere

## 1. Dobbel «X» i lederkortet
Off-season-lederarket har en egen lukkeknapp i toppen, samtidig som selve ark-komponenten alltid tegner sitt eget kryss øverst til høyre. Derfor vises to kryss.

- Fjern den manuelle lukkeknappen i off-season-lederarket og behold den innebygde.
- Flytt ring/SMS-knappene litt inn til venstre så de ikke havner under krysset.
- Sjekk de andre arkene som viser ledere for samme dobbeltkryss.

## 2. Hvit bakgrunn i off-season
I off-season ligger det mørke temaet bare på app-skallet. Ark, dialoger og kort bruker fortsatt de lyse standardfargene, så alt som åpnes blir hvitt.

- Legg inn et off-season-fargescope som overstyrer bakgrunn, kort, ark og dialogflater med de mørke Øksnøen-fargene (natt/skogsgrønn, kremfarget tekst, gullaksenter).
- Bruk scopet på app-skallet og på ark/dialog-lagene, slik at lederkort, snusboks og lederpass åpnes mørkt i stedet for hvitt.
- Juster tekst-, kant- og skillelinjefarger for god kontrast.

## 3. Slette ledere (uten å slette data)
Ny «slettet»-status på ledere: lederen forsvinner fra appen for alle andre, men alt de har lagt inn (rapporter, hendelser, notater, gomla, historikk, bilder) blir liggende.

- Kun admin/superadmin kan slette, fra lederdetaljene i admin, med en bekreftelsesdialog som forklarer at data beholdes.
- Slettede ledere skjules overalt ledere listes: Ledere-siden, off-season-lista, Lederhuset, Klineliste, Tinder, vaktplan, slurker-søk, morder-leken, varslingsmottakere og admin-velgere.
- Slettede ledere mister tilgang til appen (kan ikke logge inn).
- Admin får en «Slettede ledere»-liste der lederen kan gjenopprettes.
- Periodearkiv og periode-øyeblikksbilder er uendret, så tidligere perioder viser lederen som før.

## Teknisk
- Migrering: `leaders.deleted_at timestamptz` + `deleted_by uuid` (ingen rader eller relatert data slettes), indeks på `deleted_at`.
- Alle spørringer mot `leaders` og relevante RPC-er filtreres med `deleted_at is null`; RLS oppdateres så bare admin ser slettede rader.
- Innloggingsflyten i `AuthContext` avviser ledere med `deleted_at` satt.
- `src/components/leaders/OffSeasonLeaderSheet.tsx`: fjern lokal `X`-knapp.
- `src/index.css`: nytt `.oks-offseason` token-scope, brukt i `AppLayout`, `sheet.tsx` og `dialog.tsx` når off-season er aktiv.