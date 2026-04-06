

## Fjern offline-knappen, behold smart caching

### Problemet
Offline-modus-knappen er unødvendig fordi service workeren allerede cacher bilder automatisk med `CacheFirst`-strategi (7 dager). Data-caching via React Query holder data i minnet under økten.

### Endringer

**1. Fjern offline-knappen fra Admin.tsx**
- Fjern hele "Offline-modus"-kortet (linje 357-398)
- Fjern tilhørende state (`isPreloading`, `preloadProgress`, `preloadDone`) og `handlePreloadOffline`
- Fjern import av `preloadForOffline`, `WifiOff`, `Download` (om de ikke brukes andre steder)

**2. Slett `src/lib/offlinePreload.ts`**
- Filen brukes kun av offline-knappen og er ikke lenger nødvendig.

**3. Øk React Query gcTime for lengre data-hold**
- I `src/App.tsx`: øk `gcTime` fra 10 min til 30 min, slik at data holdes i minnet lenger mellom navigeringer.
- Bilder caches allerede automatisk av service workeren i 7 dager — ingen manuell nedlasting nødvendig.

### Hva som allerede fungerer (og beholdes)
- **Service Worker** cacher deltaker-bilder (`CacheFirst`, 7 dager, maks 500 bilder) — dette skjer automatisk når bilder lastes første gang.
- **JS-chunks** caches med `NetworkFirst` (1 dag) — ferske filer etter deploy, cached ved offline.
- **React Query** holder data i minnet under hele økten med `staleTime: 1 min`.

### Resultat
- Ledere trenger ikke gjøre noe spesielt — bilder og data caches automatisk ved første besøk.
- Ingen manuell "last ned offline"-knapp.
- Data holder seg i minnet lengre mellom sidenavigasjoner.

