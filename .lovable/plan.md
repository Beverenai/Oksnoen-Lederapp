

## Nurse Rapport: Freeform "ark"-opplevelse med @-mention

### Konsept

Erstatt den nåværende strukturerte card/input-modellen med en enkel skriveflate — som et Google Doc. Nurse skriver fritt i en stor textarea. Når hun skriver `@` dukker det opp en deltakerliste. Ved valg settes `@Navn` inline i teksten. Hver linje som inneholder en `@mention` knyttes til den deltakeren.

Arket viser alt kronologisk nedover. Bak kulissene grupperes innhold per deltaker for lagring og PDF-eksport.

```text
┌──────────────────────────────────────────┐
│  Nurse Rapport              [Lagre] [PDF]│
│──────────────────────────────────────────│
│                                          │
│  6. apr 15:30                            │
│  Ga ibuprofen til @Ola Nordmann for      │
│  vondt i kneet. Skal følges opp.         │
│                                          │
│  6. apr 16:00                            │
│  @Kari Hansen hadde allergireaksjon.     │
│  Ga cetirizin.                           │
│                                          │
│  6. apr 17:00                            │
│  @Ola Nordmann sier kneet er bedre nå.   │
│                                          │
│  [skriv her... @ for å nevne deltaker]   │
└──────────────────────────────────────────┘
```

### Datamodell

Bytt fra `sections[]` til en flat liste med linjer:

```typescript
interface ReportLine {
  id: string;           // unik ID per linje
  text: string;         // "Ga ibuprofen til @Ola Nordmann for vondt i kneet"
  mentionIds: string[]; // participant IDs nevnt i denne linjen
  timestamp: string;    // auto-satt ved opprettelse
}
```

Lagres som JSON-array i `nurse_reports.content`. Ved eksport/sync grupperes linjer per `mentionId`.

### Teknisk plan

**`src/components/nurse/NurseReportEditor.tsx` — fullstendig omskriving**

1. **Skriveflate**: Én stor textarea/input i bunnen. Nurse skriver en linje, trykker Enter → linjen legges til i `lines[]` med automatisk tidsstempel og eventuelle mention-IDer parset fra teksten
2. **@-mention popup**: Når bruker skriver `@` i input-feltet, vis filtrert deltakerliste med profilbilder (samme popup som nå, men trigget inline i skrivefeltet)
3. **Visning**: Alle linjer rendres kronologisk nedover. `@Navn` vises som en highlighted/styled span med profilbilde-chip. Tidsstempel vises som en liten header når dato/tid endrer seg
4. **Samme deltaker = samles automatisk**: I PDF-eksport og i sync til `participant_health_notes` grupperes alle linjer som nevner en deltaker
5. **Sletting**: Swipe/hover for å slette enkeltlinjer
6. **Autolagring**: Debounced som nå (2 sek)

**Visning av linjer:**
- Hver linje vises med tidsstempel til venstre
- `@Navn` i teksten rendres som en liten badge/chip med profilbilde + navn
- Gir en "chat/logg"-følelse — som å skrive i et ark

**PDF-eksport:**
- Samme som nå men data samles fra `lines` → grupper per deltaker → generer HTML

### Filer som endres

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Fullstendig omskriving: flat linje-basert editor med inline @-mentions |

### Hva som IKKE endres
- Database-tabeller (samme JSON i `nurse_reports.content`)
- RLS-policyer
- `Nurse.tsx` tabs-struktur
- Sync-logikk til `participant_health_notes` (bare tilpasset ny datamodell)

