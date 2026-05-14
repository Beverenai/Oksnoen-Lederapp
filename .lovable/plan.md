## Mål
Legge til «Tøm»-knapp som nullstiller daglige felt for ledere, både globalt (alle ledere) og per leder.

## Felter som tømmes
Settes til `NULL` i `leader_content`:
- `current_activity` (nåværende aktivitet)
- `extra_activity` (ekstra aktivitet)
- `personal_notes` (notat til lederen)
- `obs_message` (OBS)
- `extra_2`, `extra_3`, `extra_4`, `extra_5`

`extra_1` røres ikke (brukes til overnatting hovedfelt). Team, ministerpost, hytter, leirsteder etc. røres heller ikke.

## Endringer

### 1. Per leder – `src/components/admin/LeaderContentSheet.tsx`
- Ny «Tøm felter»-knapp øverst i sheet-en (ved siden av eksisterende handlinger).
- Bekreftelsesdialog: «Tøm alle daglige felt for {leder}? Kan ikke angres.»
- Ved bekreftelse: sett lokale state-verdier til `''`, kjør samme save-flyt som finnes i dag (skriver `null` til DB), nullstill `originalValuesRef`.
- Toast: «Felter tømt».

### 2. Global – `src/pages/admin/Admin.tsx`
- Ny «Tøm daglige felt»-knapp i admin-headeren (kun synlig for admin/superadmin).
- Bekreftelsesdialog med tydelig advarsel: «Dette tømmer aktivitet, ekstra aktivitet, notat, OBS og ekstra 2–5 for ALLE ledere. Kan ikke angres.»
- Kjører én Supabase update mot `leader_content` som setter de 8 feltene til `null` for alle rader.
- Invaliderer relevante React Query-cacher slik at admin-grid og leder-vy oppdateres umiddelbart.
- Toast med antall ledere som ble nullstilt.

### Teknisk
- Bruker eksisterende Supabase-klient og React Query-pattern.
- Trenger ingen DB-migrasjon (RLS på `leader_content` tillater allerede admin-update).
- Ingen endringer i edge functions, planlegger eller andre moduler.
