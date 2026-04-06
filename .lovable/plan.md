

## Nurse Rapport-editor: Omskriving til deltaker-seksjon-basert design

### Konsept

Erstatt den nåværende freeform contentEditable-editoren med en strukturert, deltaker-basert rapport:

- Én sammenhengende rapport (ikke per dag)
- Nurse skriver `@deltaker` for å starte en ny seksjon for den deltakeren
- Hver seksjon viser deltakerens profilbilde, navn, hytte, og alle notater med automatisk tidsstempel
- Informasjonen lagres også på deltakeren (via `participant_health_notes`)
- PDF-eksport genererer en rute per deltaker

```text
┌─────────────────────────────────────┐
│  Nurse Rapport            [Lagre] [PDF] │
│─────────────────────────────────────│
│  Skriv @ for å legge til deltaker...│
│                                     │
│  ┌─ 👤 Ola Nordmann (Hytte 3) ────┐│
│  │  6. apr 15:30 — Vondt i kneet  ││
│  │  6. apr 16:00 — Fikk ibuprofen ││
│  │  [+ Legg til notat]            ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─ 👤 Kari Hansen (Hytte 1) ─────┐│
│  │  6. apr 14:00 — Allergireaksjon││
│  │  [+ Legg til notat]            ││
│  └─────────────────────────────────┘│
│                                     │
│  Skriv @ for å legge til deltaker...│
└─────────────────────────────────────┘
```

### Teknisk plan

**1. Redesign `NurseReportEditor.tsx` — fullstendig omskriving**

Ny datamodell i state:
- `sections: { participantId, notes: { text, timestamp }[] }[]`
- Én input i bunnen med `@`-trigger for å legge til ny deltaker-seksjon
- Hvert deltaker-kort har en "legg til notat"-input
- Profilbilde vises i `@`-popup og i deltaker-kortet (via `Avatar`/`AvatarImage` med `participant.image_url`)

Lagring:
- Henter eksisterende data fra `nurse_report_mentions` ved oppstart
- Ved lagring: upsert `nurse_reports.content` (JSON med alle seksjoner), synk til `nurse_report_mentions` og `participant_health_notes`
- Tidsstempel settes automatisk på hvert notat

**2. `@`-mention popup med profilbilde**

- Vis `Avatar` med `image_url` i autocompletlisten
- Vis `Avatar` i deltaker-seksjonsheaderen

**3. PDF-eksport**

- Generer HTML med én rute per deltaker
- Inkluder profilbilde, navn, hytte, alder, og alle tidsstemplede notater

**4. Database: Ingen endringer**

Eksisterende tabeller `nurse_reports` og `nurse_report_mentions` dekker behovet. `content`-feltet lagrer JSON i stedet for HTML.

### Filer som endres

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Fullstendig omskriving: deltaker-seksjon-basert editor med profilbilder, tidsstemplede notater, @-popup med avatar |
| `src/pages/Nurse.tsx` | Oppdater `participants`-prop til å inkludere `image_url` |

### Hva som IKKE endres

- Database-skjema (nurse_reports, nurse_report_mentions)
- Eksisterende deltakerliste-tab
- RLS-policyer
- Andre sider/komponenter

