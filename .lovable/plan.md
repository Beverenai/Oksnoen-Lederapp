

## Fix: Vis fullt romnavn (hytte + side) i deltagerdetaljer

### Problem
Når en leder trykker på en deltager vises bare "Rom høyre" eller "Rom venstre" uten hyttenavn. Det bør stå f.eks. "Babord Høyre" eller "Beritbu bak Venstre".

### Datastruktur
- De fleste hytter har `room` = "høyre" / "venstre"
- Seileren har fulle romnavn (Seilern Hawaii, Maui, etc.)
- Hyttenavnet finnes allerede i `participant.cabin.name`

### Løsning
Lag en hjelpefunksjon `formatFullRoom(cabinName, room)` som:
- Hvis `room` er "høyre" eller "venstre": returner `"{cabinName} {Room}"`  (med stor forbokstav)
- Ellers: returner `room` som det er (allerede fullt navn)

Oppdater alle steder som viser rom:

| Fil | Linje | Nåværende | Nytt |
|-----|-------|-----------|------|
| `src/components/passport/ParticipantDetailDialog.tsx` | ~290 | `Rom {participant.room}` | `formatFullRoom(cabin.name, room)` |
| `src/components/checkout/CheckoutDetailDialog.tsx` | ~342 | `{participant.room}` | `formatFullRoom(cabin.name, room)` |
| `src/pages/MyCabins.tsx` | ~497 | `Rom: {participant.room}` | `formatFullRoom(cabin.name, room)` |
| `src/pages/ImportantInfo.tsx` | ~241 | `{participant.room}` | `formatFullRoom(cabin.name, room)` |

Hjelpefunksjonen legges i `src/lib/utils.ts` eller inline der den brukes:
```typescript
function formatFullRoom(cabinName: string | null, room: string | null): string | null {
  if (!room) return null;
  const lower = room.toLowerCase();
  if (lower === 'høyre' || lower === 'venstre') {
    const capitalized = room.charAt(0).toUpperCase() + room.slice(1).toLowerCase();
    return cabinName ? `${cabinName} ${capitalized}` : capitalized;
  }
  return room;
}
```

