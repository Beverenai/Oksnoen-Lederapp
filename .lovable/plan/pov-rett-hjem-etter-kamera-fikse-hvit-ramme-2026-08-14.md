# POV: rett hjem etter kamera + fikse hvit ramme

## Hva som endres

1. **Lukk kamera → rett til hjemskjermen**
   Når du lukker engangskameraet i Øksnøen POV havner du i dag på POV-siden (bildet + "Ta bilde"-kortet). Etter endringen tar «lukk» deg direkte til hjemskjermen. Det samme gjelder tilbake-pilen øverst på POV-siden når kameraet ble åpnet automatisk — ingen mellomstopp.

2. **Ingen hvit ramme rundt siden**
   Den lyse toppbaren og de hvite kantene rundt innholdet kommer av at off-season-temaet bare er lagt på selve sideinnholdet, ikke på hele app-skallet. Temaet flyttes opp på app-rammen for off-season-brukere/-sider, så topp, sider og bunn er samme mørke bakgrunn hele veien til kantene.

## Teknisk

- `src/pages/Pov.tsx`: `onClose` på `DisposableCamera` navigerer til `/` (erstatter `setCameraOpen(false)`) når kameraet ble auto-åpnet; fjerner `-mx-4`/lokal `oks-offseason-bg` når temaet flyttes opp.
- `src/components/layout/AppLayout.tsx`: legg `oks-offseason-bg` (eller tilsvarende tema-klasse) på rot-div når `limited`/off-season er aktiv, slik at `bg-background`, mobil-header (`bg-card/95`) og bunnnav arver mørke tokens. Rot får også `min-h-[100dvh]` med mørk bakgrunn så safe-area-områdene ikke blir hvite.
- `src/pages/More.tsx`: fjern duplisert `oks-offseason-bg -mx-4` når temaet ligger på skallet.
- Ingen databaseendringer.
