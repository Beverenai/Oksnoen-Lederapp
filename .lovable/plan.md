## Endringer

### 1. `src/pages/admin/Admin.tsx` — bytt header-knapper
- Fjern "Lim inn"- og "Tøm"-knappene (linje 229–247).
- Erstatt med én **"Synk"**-knapp (`RefreshCw`-ikon, viser `Loader2` mens den kjører).
- Knappen leser `app_config.google_sheet_sync` og kaller `supabase.functions.invoke('sync-leaders-from-sheet', { body: { spreadsheetId, range, dryRun: false } })` direkte.
- Toast viser `X oppdatert · Y feilet · Z ikke matchet`, deretter `loadData()` + `rqClient.invalidateQueries()`.
- Hvis ingen config lagret: feilmelding "Konfigurer Google Sheet i Innstillinger først".
- Fjern `PasteLeaderContentSheet`-import + render, `AlertDialog`-import + render, `handleClearAllDailyFields`, og state `isPasteSheetOpen` / `isClearAllOpen` / `isClearingAll` (erstattes med `isSyncing`).
- Fjern ikonimporter `ClipboardPaste`, `Eraser`; legg til `RefreshCw`.

### 2. `src/components/admin/GoogleSheetSyncTab.tsx` — legg til Lim inn + Tøm
- Last `leaders` (id, name, phone) ved mount for å gi til `PasteLeaderContentSheet`.
- Nytt `<Card>` "Manuelle verktøy" under den eksisterende sync-cardet:
  - **"Lim inn rader"** (`ClipboardPaste`) → åpner `<PasteLeaderContentSheet>` (samme komponent, `onSaved` = reload leaders).
  - **"Tøm daglige felt for alle ledere"** (`Eraser`, destructive) → åpner `<AlertDialog>` med samme tekst og samme update-spørring mot `leader_content` som lå i `Admin.tsx`.
- Importer `PasteLeaderContentSheet`, `AlertDialog*`, `ClipboardPaste`, `Eraser`, `hapticSuccess/Error`.

## Ikke endret
- `PasteLeaderContentSheet`-komponent
- `sync-leaders-from-sheet` edge function
- Andre admin-sider, RLS, design tokens

## Filer
- `src/pages/admin/Admin.tsx` (rediger)
- `src/components/admin/GoogleSheetSyncTab.tsx` (rediger)
