## Problem
På mobilen ser ledere ikke den aktive perioden på `/gjenglemt`. Periode 1 er aktiv i databasen og har innhold, så dette er en frontend-presentasjons-issue: perioden auto-velges via et React-effekt etter at hele perioder-listen er hentet, og hvis lista er forsinket eller cachen er gammel, ender man opp uten valgt periode (knappen "Nytt funn" disablet, ingen badge, tom grid).

## Hva vi gjør

1. **Hent aktiv periode direkte (ikke avled fra lista).**
   - Bruk RPC `get_active_period_id()` i en egen liten hook `useActivePeriod()` som returnerer `{ id, name, slug, is_public }` for kun den aktive perioden.
   - Gjør `useGjenglemtPeriods()` overflødig for leder-siden — kun admin trenger hele lista (brukes ikke på `/gjenglemt`).

2. **Forenkle `src/pages/Gjenglemt.tsx`.**
   - Fjern `periodId`-state og auto-select-effekten.
   - Sett `currentPeriod` rett fra `useActivePeriod()`.
   - Vis tydelig "Ingen aktiv periode" hvis admin ikke har valgt en (i stedet for tom side).
   - Behold badge "Aktiv: Periode X" + offentlig lenke-knapper.

3. **Bedre lastetilstander på mobil.**
   - Skeleton/spinner mens aktiv periode hentes, så siden aldri ser tom ut.
   - "Nytt funn"-knapp disabled kun under lasting, ikke når currentPeriod er null pga. race.

4. **Cache-bust.**
   - Bump query-key til `['active-period']` for å unngå at gammel PWA-cache holder på tom liste.
   - Liten kommentar om at brukere må refreshe appen én gang etter ny deploy (PWA).

## Filer som endres
- `src/hooks/useGjenglemt.ts` — legg til `useActivePeriod()` hook (RPC kall).
- `src/pages/Gjenglemt.tsx` — rip out periode-state, bruk `useActivePeriod()` direkte, bedre tom/lastetilstand.

Ingen database-endringer. Ingen ny RLS. Bare frontend.
