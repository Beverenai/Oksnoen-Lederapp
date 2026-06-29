
# Plan: Deltaker booking-info (admin)

## Hva som bygges

En ny admin-seksjon **"Booking-info"** der admin/superadmin kan laste opp Excel-fil (`.xlsx`) eller lime inn rader fra Excel. Dataen lagres knyttet til **aktiv periode** — bytter du periode, ser du en annen liste. Booking-info kobles automatisk til eksisterende deltakere (match på navn + fødselsdato) så deltakerbildet kan vises ved siden av. Informasjonen er **kun synlig for admin/superadmin** — ikke for ledere, nurse eller på passkontroll.

## Datamodell

Ny tabell `participant_bookings` med alle 30 kolonnene fra Excel-arket:

```text
id, period_id (FK periods), participant_id (FK participants, nullable),
reservation_code, reservation_number, status, period_label,
first_name, last_name, birth_date, gender, times_attended,
sweater_size, kiosk_money, friends, notes_info,
guardian_first_name, guardian_last_name, guardian_email, guardian_phone,
address, postal_code, postal_city,
price, discount, prepayment, payment_status, payment_reference,
invoiced_date, paid_date, cancelled_date, booking_time, seat_confirmed,
created_at, updated_at
```

- `period_id` settes automatisk til aktiv periode via trigger (samme mønster som dynga/gjenglemt).
- Unik nøkkel: `(period_id, reservation_code)` — re-import oppdaterer eksisterende rader (upsert).
- RLS: kun `is_admin()` kan SELECT/INSERT/UPDATE/DELETE. `service_role` får full tilgang.

## Auto-match til deltaker

Etter import kjøres matching i klienten:
1. Match på `lower(first_name+last_name)` + `birth_date` mot `participants` i samme periode.
2. Treff → setter `participant_id` så bilde/profil kan vises.
3. Ingen treff → rad vises i egen "Ikke matchet"-fane.

## UI

Lagt til som ny seksjon i `AdminSettingsContent.tsx` (key: `bookings`) med tre deler:

1. **Import-kort** med to faner:
   - **Last opp fil**: drag-and-drop `.xlsx`. Parses i nettleser med `xlsx`-bibliotek (allerede i prosjektet for shift-eksport). Viser preview (antall rader, periode-tag) før lagring.
   - **Lim inn**: textarea som godtar tab-separerte rader kopiert fra Excel. Samme header-mapping som filopplasting.
2. **Booking-liste** for aktiv periode:
   - Tabell med søk (navn, telefon, epost, reservasjonsnr).
   - Kolonner som vises: bilde (fra matchet deltaker), navn, fødselsdato, **foresatte navn**, **foresatte telefon** (klikkbart `tel:`), **foresatte epost** (klikkbart `mailto:`), status-badge.
   - Klikk på rad → sheet med **alle 30 felter** gruppert: Deltaker, Foresatte, Adresse, Betaling, Booking, Notater.
3. **"Ikke matchet"-fane** med rader uten `participant_id` så admin kan se hvem som mangler i deltakerlisten.

Realtime-abonnement på `periods` (`is_active`) sørger for at lista bytter automatisk når aktiv periode endres.

## Filer som endres / opprettes

- Migrering: ny tabell `participant_bookings` med GRANTs, RLS, trigger for `period_id` default + `updated_at`.
- Ny: `src/components/admin/BookingsTab.tsx` (hovedvisning).
- Ny: `src/components/admin/bookings/BookingImportCard.tsx` (fil + paste).
- Ny: `src/components/admin/bookings/BookingDetailSheet.tsx` (alle 30 felter).
- Ny: `src/hooks/useBookings.ts` (henter for aktiv periode, realtime).
- Oppdatert: `src/components/admin/settings/AdminSettingsContent.tsx` (case `bookings`).
- Oppdatert: `src/pages/admin/AdminSettings.tsx` (legge til menypunkt med ikon).

## Sikkerhet

- RLS låser tabellen til admin/superadmin via `is_admin()`.
- Ingen visning for ledere, nurse, eller publikum.
- Ingen kobling i passkontroll/leder-UI.
