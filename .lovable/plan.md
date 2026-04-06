
## Plan for å fikse at data “forsvinner” tilfeldig

### Hva som mest sannsynlig skjer
Jeg ser tre ting i koden som sammen kan gi akkurat dette problemet:

1. `src/main.tsx` registrerer service worker hver gang på web.
2. `src/App.tsx` bruker global React Query-persist til `localStorage`.
3. Samme `QueryClient` kjører `networkMode: 'offlineFirst'` for alle queries.

Det betyr at appen har flere cache-lag samtidig. Når ett lag blir utdatert eller en forespørsel skjer i feil øyeblikk, kan appen vise tom eller gammel data til neste refresh.

### Mål
Gjør appen “live først” igjen, så ledere, hytter, profil og admin alltid hentes ferskt når du åpner siden eller kommer tilbake til den.

### Implementasjonsplan

#### 1. Fjern blokkeringen som hindrer stabil testing
- Rydd opp i de siste `showSuccess`-referansene i `LeaderContentSheet.tsx` så prosjektet bygger rent.
- Dette er bare en nødvendig opprydding før cache-fiksen kan leveres trygt.

#### 2. Skru ned aggressiv caching globalt
- I `src/App.tsx`:
  - fjern global `networkMode: 'offlineFirst'`
  - bruk vanlig online/network-atferd som standard
  - behold heller offline-logikk bare der det faktisk trengs
- Vurder å slå av eller kraftig begrense `PersistQueryClientProvider` for live-data.

#### 3. Slutt å persistere kritisk live-data i `localStorage`
- I `src/lib/queryPersistence.ts` / `src/App.tsx`:
  - ikke persister queries som gjelder:
    - `leaders`
    - `cabins`
    - `leader-content`
    - `app_config`
    - `home_screen_config`
    - profil-relatert data
- Alternativt: midlertidig skru av hele query-persist til vi har bekreftet stabil drift.

#### 4. Hindre service worker fra å forstyrre preview og vanlig webbruk
- I `src/main.tsx` og `src/lib/registerSW.ts`:
  - ikke registrer service worker i preview/iframe
  - vurder å deaktivere service worker helt på web foreløpig hvis dere ikke aktivt trenger offline i denne fasen
  - legg inn opprydding av gamle registreringer/cacher i preview
- Dette er spesielt viktig siden service workers lett lager “spøkelses-cache”.

#### 5. Gjør kritiske datahooks mer robuste
- Oppdater hooks som `useLeaders`, `useCabins`, `useLeaderContent` og lignende til å:
  - refetche ved reconnect
  - refetche ved window focus
  - hente på nytt når siden åpnes igjen
  - bruke kortere `staleTime` eller `refetchOnMount: 'always'` for adminkritiske data
- Målet er at appen ikke sitter fast på gammel/tom cache.

#### 6. Behold siste gyldige data i stedet for å “falle til tomt”
- På sider som `src/pages/admin/Admin.tsx`:
  - ikke overskriv state med tom visning ved midlertidig feil
  - vis heller “kunne ikke oppdatere” + retry
  - behold forrige gyldige innhold på skjermen
- Det gjør at brukeren ikke opplever at alt plutselig blir borte.

#### 7. Legg inn tydelig revalidering når man navigerer mellom sider
- Når man går tilbake til Admin, Profil, Passkontroll osv.:
  - invalider/refetch relevante queries
  - spesielt etter lagring eller når ark/dialoger lukkes
- Dette sikrer at endringer og lister er synkronisert uten manuell refresh.

#### 8. Legg til en enkel “hard refresh data”-mekanisme i appen
- Legg inn en trygg intern funksjon som kan:
  - tømme query-cache
  - eventuelt tømme persistert cache
  - hente fersk data på nytt
- Nyttig både for brukeren og for videre feilsøking.

### Filer jeg forventer å berøre
- `src/App.tsx`
- `src/main.tsx`
- `src/lib/queryPersistence.ts`
- `src/lib/registerSW.ts`
- `src/hooks/useLeaders.ts`
- `src/hooks/useCabins.ts`
- `src/hooks/useLeaderDashboardData.ts`
- `src/pages/admin/Admin.tsx`
- eventuelt flere datahooks som bruker samme mønster

### Teknisk detalj
Dette ser mindre ut som et databaseproblem og mer som et frontend-cacheproblem. Den største risikoen akkurat nå er kombinasjonen av:
- service worker
- persistert query-cache
- global `offlineFirst`

Den kombinasjonen er fin for offline-apps, men den passer dårlig når dere trenger at admin, profiler, ledere og hytter alltid viser ferske data.

### Forventet resultat etter fix
- Admin viser ledere og hytter stabilt
- Profil og andre sider mister ikke data tilfeldig
- Navigasjon mellom sider gir ikke “tom app”
- Refresh skal ikke lenger være nødvendig for å få data tilbake
