# Off-season for inaktive ledere

## Slik er det i dag (verifisert)

Inaktive ledere kan logge inn og får «begrenset tilgang». 94 av 129 ledere er i dag inaktive, så dette gjelder de fleste.

Det de får nå:
- **Hjem**: kun lederpasset i fullskjerm — ingen andre innganger.
- **Bunnmeny**: Hjem, Ledersnakk, Mer.
- **Mer**: Min profil, Lederpass, Ledersnakk, Klineliste (kun når admin-bryteren `hookups_enabled` er på — den er på nå), Logg ut.
- Alt annet blokkeres av rutevakten: `/`, `/chat`, `/profile`, `/mer`, `/lederpass`, `/klineliste` er de eneste tillatte sidene.

Svakheter: hjem-siden gir ingen vei videre uten å gå via Mer, snus-funksjonen ligger skjult inne på profilen, og Klineliste forsvinner helt hvis admin slår av bryteren.

## Hva vi bygger

### 1. Ny off-season hjem-side (hub)
Erstatter dagens «bare passet»-visning med en enkel, morsom forside:
- Hilsen med fornavn og en «Off-season»-merkelapp.
- Lederpasset som stort kort øverst (trykk = åpne i fullskjerm som i dag).
- Rad med hurtighandlinger i samme stil som i sesong: **snus-boksen din** (3D), **Klineliste** (badge for ventende forespørsler), **Ledersnakk**.
- «Snus brothers»-listen fungerer også off-season.

### 2. Snus som egen off-season-flate
Snusvalg og «snus brothers» får en egen side `/snus`, slik at det er ett trykk unna i stedet for gjemt i profilen. Profilen beholder samme funksjon som nå.

### 3. Klineliste alltid tilgjengelig off-season
Klinelista vises for inaktive ledere uavhengig av `hookups_enabled` (admin kan fortsatt skru den av for aktive ledere i sesong). Kartet bruker allerede både aktive og inaktive ledere.

### 4. Lederpass med tjenestehistorikk
Passet er hovedattraksjonen off-season — vi sikrer at stempler og tjenestehistorikk vises riktig også når lederen ikke er aktiv i inneværende periode.

### 5. Mer-menyen ryddes
Off-season-menyen får seksjonen «Off-season» med: Lederpass, Klineliste, Snus, Ledersnakk, Min profil — pluss Logg ut.

## Teknisk

- `src/lib/limitedAccess.ts`: legg `/snus` til whitelisten.
- `src/pages/Home.tsx`: bytt off-season-grenen fra ren `LederPass fill` til ny `OffSeasonHome`-komponent (`src/components/home/OffSeasonHome.tsx`) som gjenbruker `HomeQuickActions`, `SnusCan3D` og `useIncomingHookupCount`.
- Ny side `src/pages/SnusPage.tsx` som gjenbruker eksisterende snus-komponenter og profilens lagringslogikk; rute registreres i `src/App.tsx`.
- `src/pages/Klineliste.tsx` og `src/pages/More.tsx`: behandle `isLimitedAccess` som «alltid på» for klinelista.
- Ingen databaseendringer, ingen endringer i innlogging eller tilgangsregler utover `/snus`.

## Utenfor omfang

Morderleken, Gomla, hendelser, nurse/kjøkken og andre driftsfunksjoner forblir stengt off-season.