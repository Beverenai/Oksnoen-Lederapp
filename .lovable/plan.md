# Leirskole: nytt design på hjem + admin

Grunnen til at designet ikke ser oppdatert ut: Leirskole kjører fortsatt på standard lys-tema med vanlige `Card`-blokker. Det finnes ingen `oks-leirskole-theme` i `src/index.css`, og `AppLayout` setter kun off-season-temaet (`accessMode === 'offseason'`). Admin-siden viser i tillegg fortsatt "Uker"-boksen med "Opprett uke" og synk mot Jobb-plattformen.

## 1. Mørkt iOS-tema for Leirskole
- Nytt `html.oks-leirskole-theme` i `src/index.css` — samme oppbygging som off-season (overstyrer semantiske tokens), men med teal/petrol aksent i stedet for rød/gull, pluss en `.oks-leirskole-bg` med myke radial-gradienter.
- `AppLayout` slår temaet på når `accessMode === 'leirskole'` (og av ved bytte), slik at også ark/dialoger i portaler blir mørke.
- Pill-look: avrundede glass-flater (`rounded-3xl`, subtil border, blur) brukt som felles klasser, ikke hardkodede farger.

## 2. Ny hjemskjerm (`src/pages/Leirskole.tsx`)
Ryddig, kort skjerm med tydelig hierarki:
1. **Ukeheader** — ukenavn, datoer, "aktiv nå"-pill, hilsen med fornavn.
2. **Denne økten skal du** — viktigste kort øverst: øktinfo fra admin + lest-kvittering.
3. **Neste vakt** — stor pill med tid, post, varighet, nedtelling.
4. **Mine vakter** — kompakt liste per dag med timer/dag mot maks 8t.
5. **Snarveier** — små pill-fliser til Vaktplan, Oppgaver, Ledere, Lederhuset.

Alt annet (full vaktplan for hele uka, oppgaveliste, ledere denne uken) flyttes til egne undersider `/leirskole/vaktplan`, `/leirskole/oppgaver` og eksisterende ledersiden, lenket fra "Mer".

## 3. Admin ser helt annerledes ut (`src/pages/admin/LeirskoleAdmin.tsx`)
- **Fjernes:** "Uker"-kortet med opprett-uke-skjema og hele synk-mot-Jobb-flyten (knapp, mutasjon og feilhåndtering). Aktiv uke velges automatisk ut fra dato som i dag.
- **Ny struktur** — dashboard i stedet for skjemastabel:
  - Statusstripe øverst: aktiv uke, antall på vakt nå, ledere i uka, timer fordelt, publisert/ikke publisert.
  - Ledergrid (kort med bilde, rolle, kompetanse-chips, timer) — dette er hovedflaten, med tapp for å tildele oppgave/aktivitet til én leder.
  - Vaktplan-kort: én "Generer vaktplan"-knapp + publiser/varsle.
  - Øktinfo-kort og oppgave-kort som kompakte pill-seksjoner.
- Ledere legges inn via eksisterende tilgangskort (velg blant ledere i appen), ikke import.

## Teknisk
- Ingen databaseendringer; eksisterende hooks i `src/hooks/useLeirskole.ts` gjenbrukes.
- Sletting av `syncFromJobb` i admin-siden; edge-funksjonen `sync-leirskole-jobb` blir stående ubrukt (kan slettes senere).
- Nye ruter for undersidene i `src/App.tsx` og lenker i `src/pages/More.tsx` (kun i leirskole-modus).
- Alle farger som design-tokens — ingen `bg-black`/`text-white` i komponentene.
