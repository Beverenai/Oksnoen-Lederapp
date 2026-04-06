

## Fiks: Multi-deltaker rombytte + korrekt ledige senger

### Problem 1: "6/6 ledig" er feil
Mange deltakere har `room = NULL` eller tom streng i databasen, men dropdown-listen viser bare "høyre"/"venstre". Når systemet sjekker belegg for "høyre", finner det 0 deltakere der (fordi de er registrert med `room = NULL`), og viser derfor "6/6 ledig". Tallet viser **ledige** senger, ikke belegg — men det er misvisende fordi deltakerne mangler rom-tilordning.

**Fiks:** Vis `X/Y` som "X opptatt av Y" i stedet for "X ledig". Og tell deltakere som har `cabin_id` men `room = NULL` som "uten rom" — vis disse separat per hytte slik at admin ser hvem som mangler rom.

### Problem 2: Bare én deltaker om gangen
Brukeren vil legge til flere deltakere i ett rombytte-sett, og godkjenne alle samtidig.

**Fiks:** Endre skjemaet til en "handlekurv"-modell:
- Søk og velg deltaker → legg til i en lokal liste (ikke lagret i DB ennå)
- Velg mål-rom (felles for alle, eller per deltaker)
- Trykk "Legg til X rombytter" → alle lagres som separate `room_swaps`-rader
- Godkjenning fungerer som før (batch-select + godkjenn)

### Endringer i `src/components/stats/RoomSwapTab.tsx`

**A. Multi-select deltakere:**
- Endre `selectedParticipant` fra `Participant | null` til `Participant[]`
- Når bruker velger en deltaker fra søk, legg til i listen (ikke erstatt)
- Vis alle valgte deltakere med X-knapp for å fjerne enkeltvis
- Søkefeltet tømmes etter valg, klar for neste søk

**B. Korrekt belegg-visning:**
- Endre badge fra "X/Y ledig" til "X/Y opptatt" med farge basert på kapasitet
- Grønn badge = plass ledig, rød = fullt eller overfylt
- Ikke blokker rombytte til fulle rom (admin vet at de bytter noen bort samtidig)

**C. handleAddSwap → handleAddSwaps:**
- Iterér over alle valgte deltakere og opprett én `room_swaps`-rad per deltaker
- Tøm listen etter lagring

### Filer som endres
- `src/components/stats/RoomSwapTab.tsx` — eneste fil

### Resultat
- Admin kan velge 1-N deltakere, velge mål-rom, og legge alle inn som rombytter
- Belegg vises korrekt som "opptatt/total" i stedet for misvisende "ledig"
- Ingen blokkering ved fullt rom

