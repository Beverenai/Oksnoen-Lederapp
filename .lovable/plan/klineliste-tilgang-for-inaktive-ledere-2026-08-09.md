# Klineliste + tilgang for inaktive ledere

## 1. Liggeliste blir Klineliste
- Ny rute `/klineliste`, gammel `/liggeliste` redirecter dit, så gamle lenker ikke knekker.
- Alle synlige tekster byttes: sidetittel, Mer-knappen, admin-toggelen og toast-meldinger ("Klineliste aktivert/deaktivert").
- Filer/mapper (`pages/Liggeliste.tsx`, `components/liggeliste/*`) døpes om. Databasetabellen `leader_hookups` og `hookups_enabled`-toggelen beholder navnene sine (ingen migrasjon nødvendig).

## 2. Inaktive ledere får begrenset tilgang
I dag blir ledere med `is_active = false` logget ut med "Kontoen din ble deaktivert". Det endres til en begrenset off-season-tilgang, samme prinsipp som når hele appen settes inaktiv.

Inaktive ledere kan bruke:
- Hjem (forenklet visning uten vakter/økt-innhold)
- Ledersnakk (chat)
- Profil, inkludert snus-funksjonen (velge boks, snus brothers)
- Klineliste
- Lederpass

Alt annet (passkontroll, ledere, hendelser, admin, kjøkken, gomla osv.) er utilgjengelig og redirectes til Hjem.

Bunnmenyen for disse brukerne viser bare Hjem, Ledersnakk og Mer, og Mer-siden viser kun de tillatte knappene (Lederpass, Klineliste, Profil).

Superadmin og aktive ledere merker ingen forskjell.

## Teknisk
- `AuthContext`: fjern hard utlogging ved `is_active === false`; sett i stedet `isLimitedAccess = true` og eksponer det i konteksten. Behold utlogging kun når lederprofil mangler.
- Ny felles hvitliste (`src/lib/limitedAccess.ts`) med tillatte ruter: `/`, `/chat`, `/profile`, `/klineliste`, `/lederpass`. Brukes både av inaktiv app-modus og inaktive ledere, så reglene ikke divergerer.
- `ProtectedRoute` i `App.tsx`: bruk hvitlisten når `mode === 'inactive'` eller `isLimitedAccess`, for alle unntatt superadmin.
- `AppLayout`: `inactiveForUser` utvides med `isLimitedAccess` (bunnmeny + skjulte elementer).
- `More.tsx`: filtrer knappene mot hvitlisten ved begrenset tilgang.
- `Home.tsx`: samme betingelse for den forenklede off-season-visningen.
- Klinekartet skal også vise inaktive ledere, slik at kartet ikke krymper utenom sesong.