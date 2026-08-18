# POV: lagre til iPhone + ekte filtre, og ingen doble Tinder-matcher

## 1. Lagre bilder til iPhone (bilder-appen)

I dag brukes `<a download>`, som Safari/iOS ignorerer — bildet åpnes i stedet for å lagres.

- Ny hjelpefil `src/lib/savePhoto.ts`:
  - Native app (Capacitor): skriv filen til cache med Filesystem og åpne iOS-delearket via Share → «Lagre bilde» legger det i Bilder.
  - Safari/PWA: `navigator.share({ files: [...] })` når det støttes (gir samme «Lagre bilde»-valg), ellers fall tilbake til nedlasting som i dag.
- I fullskjermvisningen byttes nedlastingsikonet til «Lagre»-knapp som bruker dette.
- «Alle»-knappen blir «Lagre alle»: deler bildene i puljer (10 om gangen) i ett delareal per pulje, med fremdriftstekst, så hele filmen kan lagres til Bilder på noen få trykk.
- Lang-trykk på bilde i rutenettet fungerer også (bildet vises som vanlig `<img>`, ingen endring nødvendig).

## 2. Filtrene virker faktisk på bildene

Årsak: bildet «utvikles» med `ctx.filter` på canvas, som Safari på iPhone ikke støtter — filteret forsvinner stille, og bildet lagres uten look (bare vignett + datostempel).

- Utvid `src/lib/povFilters.ts` med en tallbasert beskrivelse per filter (metning, kontrast, lysstyrke, fargevri, tint, korn, vignett).
- I `DisposableCamera` legges en støttesjekk for `ctx.filter`. Uten støtte kjøres samme look manuelt over pikslene (fargematrise + tint + korn), så resultatet blir likt det du ser i søkeren på både iPhone og Android.
- Søkeren beholder CSS-filteret (det virker), og filtervalget vises tydeligere med navn under utløseren.
- Fortsatt to filtre: FXN og FQS.

## 3. Ingen doble matcher på Øksnøen Tinder

- Databasefunksjonen `swipe_leader` gir i dag «Det er match!» hver gang du sveiper ja på noen du alt har match med. Den endres til å kun melde match når matchen faktisk er ny (ny rad opprettet).
- Sveipebunken (`useLeaderSwipes`) resirkulerer aldri ledere du har likt eller matchet med — også når bunken nullstilles for uendelig sveiping.
- Matchlisten dedupliserer per leder, så samme person aldri kan stå to ganger.

## 4. Varslinger

- Ny edge-funksjon `push-match`: når en ny match oppstår, får den andre lederen push («Du har match med …») med lenke rett inn i Tinder-matchene.
- Nye meldinger i match-chatten gir push til motparten (samme mønster som postkasse-svar), slik at chatten ikke blir stille.
- Varslene dukker også opp i varsellisten på hjem (bruker allerede matcher og meldinger).

## Teknisk kort
- Nye/endrede filer: `src/lib/savePhoto.ts`, `src/lib/povFilters.ts`, `src/components/pov/DisposableCamera.tsx`, `src/components/pov/PovGrid.tsx`, `src/pages/Pov.tsx`, `src/hooks/useLeaderSwipes.ts`, `src/hooks/useMatchChat.ts`, `supabase/functions/push-match/index.ts`.
- Én migrasjon: oppdatert `swipe_leader` (returnerer kun `true` ved ny match).
- Nye bilder får riktig look; bilder som alt er tatt kan ikke etterfiltreres.
