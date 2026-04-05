
Problemet er reelt: den forrige fiksen la bare til litt ekstra bunn-padding, men løste ikke selve årsaken til at innhold fortsatt havner utenfor synlig område på iPhone.

Hva som faktisk er galt
- `ParticipantDetailDialog` bruker fortsatt vanlig `DialogContent` også på mobil, altså en sentrert modal med `max-h-[85vh]`. Det gir ikke en ekte mobiltilpasset “sheet” som bruker hele tilgjengelige høyden trygt.
- I `ActivityManager` velges mobilvariant ut fra `pointer: coarse` / touch-detektering. På iOS/Capacitor kan dette bli upålitelig, slik at aktivitetslisten fortsatt kan åpnes som en høy popover i stedet for en trygg drawer.
- Popover-listen har bare `max-h-[60vh]`, men tar ikke hensyn til safe area, dialoghøyde eller knappen under. Derfor ser vi nøyaktig det på skjermbildet: listen dekker for mye, og “Legg til aktivitet” / nederste handling havner for lavt.
- Global `.app-content`-padding hjelper ikke nok for overlays/dialoger, fordi disse lever utenfor vanlig side-scroll.

Plan for å fikse dette ordentlig

1. Gjør deltakerdetaljer mobilvennlig på ordentlig
- Bytt `ParticipantDetailDialog` fra ren `Dialog` til prosjektets `ResponsiveDialog`.
- På mobil skal den åpnes som en bottom sheet / drawer med fast maksimal høyde og intern scroll.
- På desktop kan den fortsatt være vanlig dialog.

2. Tving aktivitetsvelgeren til trygg mobil-adferd
- Erstatt dagens touch-detektering i `ActivityManager` med `useIsMobile()` slik resten av prosjektet bruker.
- På mobil: alltid `Drawer`.
- På desktop: `Popover`.
- Dette fjerner usikkerheten som gjør at iPhone kan få feil variant.

3. Begrens høyden på aktivitetslisten riktig
- Gi mobil-drawer i `ActivityManager` en høyde som tar hensyn til safe area, f.eks. `max-h-[calc(100dvh-...)]`.
- Gjør selve listen scrollable inni drawer/popup, ikke la hele komponenten vokse.
- Gi popover-innhold en trygg `max-height` som også trekker fra safe-area og litt luft nederst.

4. Flytt safe-area-padding til riktig sted
- I `ParticipantDetailDialog`: legg `pb-safe`/ekstra bunn-padding på selve scroll-innholdet, ikke bare en spacer helt til slutt.
- I `Dialog`/`Drawer`-innhold: behold safe-area nederst, men sørg for at handlingsknapper ligger i scrollbart område eller i en sticky footer som bruker `.bottom-bar`.
- Dette gjør at “Marker som ankommet”, “Lagre notater” og lignende alltid kan scrolle helt opp over home-indikatoren.

5. Stram inn generelle overlay-komponenter
- Oppdater `src/components/ui/drawer.tsx` så drawer-innhold på mobil alltid respekterer bottom safe area.
- Oppdater `src/components/ui/select.tsx` / eventuelt `popover.tsx` med bedre max-height for lange menyer, så dropdowns ikke kan renne ut av skjermen.
- Målet er at lange lister alltid scroller internt.

6. Verifiser berørte steder
Jeg ville implementert og sjekket spesielt disse:
- `src/components/passport/ParticipantDetailDialog.tsx`
- `src/components/passport/ActivityManager.tsx`
- `src/components/ui/responsive-dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/select.tsx`
- eventuelt `src/components/ui/popover.tsx` for høydebegrensning

Forventet resultat
- Deltakerdialogen på `/passport` åpnes trygt på iPhone.
- Aktivitetslisten blir scrollbar inne i en mobil-sheet, ikke en for høy overlay.
- “Legg til aktivitet”, “Lagre notater” og “Marker som ankommet” blir synlige og tilgjengelige over home-indikatoren.
- Lange dropdowns/lister kan ikke lenger vokse utenfor skjermen.

Tekniske detaljer
- Rotårsaken er ikke manglende `viewport-fit=cover`; den er allerede riktig satt.
- Rotårsaken er heller ikke bare manglende `pb-safe`; problemet ligger i feil mobil-overlay-type og manglende høydebegrensning på lange lister.
- Den mest robuste løsningen er å bruke `ResponsiveDialog` + `useIsMobile()` konsekvent for alle store mobile overlays i Passport-flyten.
