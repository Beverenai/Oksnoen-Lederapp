## Mål
Sync fra Google Sheet skal speile arket: alle felter som er knyttet til hver leder via telefonnummer skal oppdateres — inkludert tomme celler som **tømmer** feltet i appen. Ledere som ikke finnes i arket forblir urørt.

## Endring i `supabase/functions/sync-leaders-from-sheet/index.ts`

### 1. Match KUN på telefon
Fjern fallback til navne-match. Hvis raden ikke har telefon som matcher en aktiv leder → legges i `unmatched` og hoppes over.

Begrunnelse: telefon er stabil nøkkel, navn endres / dupliseres. Bruker bekreftet "knyttet til telefonr".

### 2. Tom celle = tøm felt (for alle synkede kolonner)
I dag: linje 165 dropper tomme verdier (`if (v) vals[key] = v`). Endres til å beholde dem som `null`.

For hver matchet leder, for hver kolonne som finnes i sheet-headeren:
- Celle har verdi → sett feltet til verdien
- Celle er tom → sett feltet til `null`
- Kolonne finnes ikke i sheet → la feltet være urørt

Gjelder begge tabeller:
- **`leader_content`**: `current_activity`, `extra_activity` (Ansvar), `personal_notes` (Notater), `personal_message` (Til deg), `obs_message` (OBS!), `extra_1`–`extra_5`
- **`leaders`**: `cabin` (Hytte Ansvar), `ministerpost`, `team`
- **`phone`** og **`name`**: aldri tømmes (phone er match-nøkkel og NOT NULL; name er NOT NULL)

### 3. Insert vs update for `leader_content`
Hvis leder mangler `leader_content`-rad og raden i sheet bare har tomme verdier → ikke opprett tom rad (unngå støy). Bare oppdater hvis rad finnes, eller insert hvis minst én verdi er ikke-null.

### 4. Ledere ikke i sheet
Ingen endring — de forblir urørt (bekreftet av bruker).

### 5. Response
Returner som før: `saved`, `failed`, `unmatched`, `unknownHeaders`, `lastSyncAt`. Toast i Admin-UI fungerer uendret.

## Ikke endret
- Frontend (`Admin.tsx` "Synk"-knapp, `GoogleSheetSyncTab.tsx` manuelle verktøy)
- RLS, autentisering, admin-sjekk
- HEADER_ALIASES (samme kolonne-navn støttes)
- `last_synced_at`-stempel
