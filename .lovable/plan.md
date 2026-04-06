

## Fiks: Romvalg er hardkodet til "høyre/venstre" — men mange hytter bruker andre romnavn

### Rotårsak

Koden hardkoder romalternativer til `['høyre', 'venstre']` (linje 127). Men i databasen har deltakerne mange forskjellige romnavn:

- **Seileren** har rom som "Maui", "Seilern Hawaii", "Waikikii", osv.
- **Bedewins**, **Fyrtårnet**, **Fiskebua**, osv. har deltakere med `room = NULL` (43 deltakere totalt) — disse hyttene bruker kanskje ikke rom-inndelingen i det hele tatt.

Når dropdown kun viser "høyre"/"venstre" per hytte, matcher ingen av Seilerens faktiske romnavn, og belegg vises som 0. De 43 deltakerne uten rom er i hytter som ikke har "høyre/venstre"-oppsett.

### Løsning

Bygg rom-dropdown **dynamisk** fra faktisk data i stedet for å hardkode:

1. Hent alle unike `(cabin_id, room)`-kombinasjoner fra `participants`-tabellen + `room_capacity`-tabellen
2. For hver hytte, vis de faktiske rommene som finnes (f.eks. "Seileren Maui", "Seileren Hawaii", eller "Bedewins høyre/venstre")
3. Hytter der alle deltakere har `room = NULL` — vis hytten uten rom-underinndeling (bare "Bedewins")

### Endringer i `src/components/stats/RoomSwapTab.tsx`

**A. Dynamisk roomOptions (linje 122-138):**
- I stedet for `['høyre', 'venstre'].forEach(...)`, samle alle unike rom-verdier per hytte fra participants + room_capacity
- For hytter uten rom-data: vis én entry uten rom-suffix
- For hytter med rom: vis én entry per unikt rom

**B. Korrekt belegg-telling (linje 112-120):**
- Tell belegg for alle rom-verdier, ikke bare "høyre"/"venstre"
- Inkluder deltakere med `room = NULL` i tellen for hytter uten rom-inndeling

**C. Target room-valg:**
- Når admin velger en hytte uten rom-inndeling, sett `to_room = null`
- Når admin velger et spesifikt rom, sett `to_room` til det faktiske romnavnet

### Filer som endres
- `src/components/stats/RoomSwapTab.tsx` — eneste fil

### Resultat
- Dropdown viser faktiske rom fra databasen (Maui, Waikikii, høyre, venstre, osv.)
- Belegg vises korrekt for alle rom
- "X uten rom" forsvinner for hytter som rett og slett ikke bruker rom-inndeling

