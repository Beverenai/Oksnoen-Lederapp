

## Nurse Rapport: Google Docs-style editor med deltaker-seksjoner

### Konsept

Bygge om NurseReportEditor til en ekte "Google Docs"-opplevelse:

- Ett stort redigerbart dokument (contentEditable) der nurse skriver fritt
- Når nurse skriver `@deltakernavn`, opprettes automatisk en visuell "ramme/boks" for den deltakeren i dokumentet
- All tekst som skrives inne i en deltaker-ramme lagres automatisk på den deltakeren (i `participant_health_notes`)
- Søkefelt i toppen: skriv deltakernavn → hopp direkte til den deltakerens seksjon i dokumentet
- Kan lime inn tekst med `@navn` og systemet strukturerer det automatisk i riktige deltaker-bokser
- Autolagring (debounced) til `nurse_reports.content`

```text
┌─────────────────────────────────────────────┐
│  Nurse Rapport    [Søk deltaker] [Lagre][PDF]│
│─────────────────────────────────────────────│
│                                              │
│  Fritekst her ovenfor...                     │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 👤 Ola Nordmann | Hytte 3 | 14 år   │   │
│  │──────────────────────────────────────│   │
│  │ 6. apr 15:30                         │   │
│  │ Vondt i kneet, ga ibuprofen          │   │
│  │                                      │   │
│  │ 6. apr 17:00                         │   │
│  │ Kneet er bedre nå                    │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Mer fritekst her...                         │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 👤 Kari Hansen | Hytte 1 | 13 år    │   │
│  │──────────────────────────────────────│   │
│  │ 6. apr 14:00                         │   │
│  │ Allergireaksjon, ga cetirizin        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Skriv fritt... bruk @ for å tagge]        │
└─────────────────────────────────────────────┘
```

### Teknisk plan

**1. Fullstendig omskriving av `NurseReportEditor.tsx`**

Ny tilnærming med `contentEditable` div:

- Dokumentet lagres som HTML-streng i `nurse_reports.content`
- Deltaker-seksjoner representeres som `<div class="participant-section" data-participant-id="uuid">` blokker
- Inne i hver seksjon: header med avatar + navn + hytte, og fritt redigerbart innhold under
- `@`-mention trigger: når bruker skriver `@`, vis popup med filtrerte deltakere. Ved valg settes en ny deltaker-seksjon inn (eller hopp til eksisterende seksjon for den deltakeren)
- Hver ny linje i en deltaker-seksjon får automatisk tidsstempel

**Søkefunksjon:**
- Input-felt i headeren
- Filtrerer deltakere som har seksjoner i dokumentet
- Ved klikk: `scrollIntoView()` til riktig `[data-participant-id]` element

**Autolagring:**
- `MutationObserver` eller `onInput` på contentEditable → debounced lagring av innerHTML til DB
- Ved manuell lagre: parse alle deltaker-seksjoner → sync innholdet til `participant_health_notes` per deltaker

**Paste-håndtering:**
- `onPaste` event: parse innlimt tekst for `@navn`-mønster
- For hver funnet `@navn`: opprett deltaker-seksjon og plasser teksten i riktig boks

**2. Sync til deltaker-dashboard (Nurse-fanen "Alle deltakere")**

Ved lagring:
- Parse alle `<div class="participant-section">` fra dokumentet
- For hver deltaker: ekstraher tekst-innholdet
- Upsert i `participant_health_notes` med `created_by = leader.id`
- Dette gjør at deltaker-detaljdialogen i "Alle deltakere"-taben automatisk viser nurse-notater

**3. PDF-eksport**

Samme som nå men basert på det nye HTML-dokumentet — kan åpne dokumentet direkte i nytt vindu med print-styling.

### Filer som endres

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Fullstendig omskriving: contentEditable doc-editor med deltaker-bokser, søk, paste-parsing |

### Hva som IKKE endres
- Database-tabeller (ingen migrasjoner)
- `Nurse.tsx` (tabs-struktur beholdes)
- RLS-policyer
- Eksisterende deltaker-dashboard i tab 1

