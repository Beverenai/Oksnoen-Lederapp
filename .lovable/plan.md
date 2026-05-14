## Problem 1 — Lag når man velger Admin/Sykepleier

Årsak (i `src/components/admin/LeaderDetailDialog.tsx`):
- Rolle-save useEffect har deps `[role, leader, onSaved, showError]`. Når rolle lagres → `onSaved()` → `AdminSettings.loadData()` → ny `leaders`-array → `leader`-prop får ny referanse → effekten kjører igjen selv om `role` ikke endret seg → ny edge-function-kall etter 500 ms → ny refetch → løkke. Hver klikk genererer et galopperende sett med `manage-roles`-kall.
- Samme problem for felt-auto-save (`saveLeaderFields` i deps får ny identitet ved hver refetch og trigger phantom-saves).

### Fix
- Rolle-save: endre deps til `[role, leader?.id]`; bruk refs for `onSaved` og `showError` (oppdater i egen useEffect). Hopp tidlig ut hvis `role === originalValuesRef.current.role`.
- Felt-auto-save: bytt `saveLeaderFields` i deps med rene primitiver, eller bruk `saveLeaderFieldsRef.current()` og dropp callbacken fra deps.
- I `AdminSettings.loadData`: drop refetch av `home_screen_config` på vanlige saves — eller eksponer en lettere `refreshLeaders()` som kun henter `leaders` + roller, og bruk den som `onSaved` for dialog.

## Problem 2 — Importer ledere via CSV / paste

I «Ledere»-kortet i `src/components/admin/settings/AdminSettingsContent.tsx`:
- Legg til en knapp «Importer ledere» ved siden av «Aktiver/Deaktiver alle».
- Knappen åpner en dialog med:
  - En `<textarea>` for innliming (én leder per linje).
  - Filvelger som godtar `.csv` / `.txt` og leser teksten inn i samme textarea.
  - Hjelpetekst: «Format: Navn, telefon — komma, semikolon eller tab fungerer. Header-rad støttes.»
- Parser:
  - Splitt på linjer; hopp over tomme + headerrad (om første linje har «navn»/«name»/«telefon»/«phone»).
  - Splitt på `,` `;` eller `\t`. Forvent `[navn, telefon]`.
  - Normaliser telefon (kun siffer + ledende `+`). Trim navn.
  - Valider: navn ≥ 2 tegn, telefon ≥ 8 siffer.
- Insert:
  - Hent eksisterende telefoner fra `leaders`-prop.
  - Filtrer ut duplikater før `supabase.from('leaders').insert(rows)`.
  - Ved race-konflikt (`23505`), behandle som duplikat.
- Resultat-popup: «X lagt til, Y duplikater hoppet over, Z ugyldige rader (vises i listen)».
- Etter import: kall samme refresh som vanlig `loadData()`.

Ingen DB-/RLS-endringer (`leaders.phone` er allerede UNIQUE; insert-policy er `is_admin()`).

## Filer som endres
- `src/components/admin/LeaderDetailDialog.tsx` — fix dep-loops på rolle og felt-save.
- `src/pages/admin/AdminSettings.tsx` — evt. lettere refresh-funksjon, koble import-handler.
- `src/components/admin/settings/AdminSettingsContent.tsx` — ny import-knapp + dialog + parse/insert.
