# Admin Dashboard — total oversikt over perioden

Ny startside for admin: `/admin/dashboard`, tilgjengelig som «Dashboard»-knapp øverst på Admin-siden og i «Mer» → Admin. Ett skjermbilde som samler det viktigste for den aktive perioden, uten å flytte noen eksisterende funksjoner.

## Innhold (kort som kan trykkes videre)

1. **Toppstripe / nøkkeltall** — antall deltagere i leir nå (minus «har dratt hjem»), ankomne vs. ikke ankomne, antall aktive ledere, dagens dato + periodenavn.
2. **Bursdager i dag** — deltagere som har bursdag i dag (og de neste 3 dagene som «kommer snart»), med bilde, alder, hytte og lag. Trykk → deltagerkort.
   Merk: ledere har ingen fødselsdato i databasen, så bursdager gjelder kun deltagere.
3. **Nyeste hendelser** — de 5 siste hendelsene med deltagerbilde, type og tid. Trykk → hendelsen/deltageren. Lenke til Hendelser.
4. **Notater** — de siste admin-notatene i komprimert form, med knapp som åpner det eksisterende notatpanelet.
5. **Nurse-status** — nye/uleste nurse-rapporter og deltagere med «viktig info»-flagg.
6. **Fix** — antall åpne Fix-saker + de 3 nyeste. Trykk → /fix.
7. **Postkasse** — antall ubesvarte meldinger + nyeste. Trykk → admin-innboks.
8. **Denne økten** — hvilke aktiviteter som kjører nå, hvilke to lag som har kjøkkentjeneste, og antall ledere uten aktivitet.
9. **Oppdrag** — aktive deltakeroppdrag som ikke er lest/tatt.

## Layout

Telefon (én kolonne, viktigst først):
```text
[ Nøkkeltall: i leir / ankomne / ledere ]
[ 🎂 Bursdager i dag ]
[ Denne økten + kjøkkentjeneste ]
[ Nyeste hendelser ]
[ Nurse | Fix ]  (to små kort side om side)
[ Postkasse | Oppdrag ]
[ Notater ]
```

PC (12-kolonners rutenett):
```text
+-----------------------------+--------------------+
| Nøkkeltall (4 tall i rad)                        |
+-----------------------------+--------------------+
| Nyeste hendelser            | Bursdager i dag    |
| Denne økten / kjøkken       | Nurse-status       |
| Notater                     | Fix / Postkasse    |
+-----------------------------+--------------------+
```

Stil følger appen: glassmorphism-kort, semantiske tokens, tydelige tall, ingen nye farger. Pull-to-refresh på mobil, realtime/refetch på hendelser og notater.

## Teknisk

- Ny side `src/pages/admin/AdminDashboard.tsx` + rute `/admin/dashboard` i `App.tsx` (admin/superadmin/nurse-relevante kort skjules etter rolle).
- Ny hook `src/hooks/useAdminDashboard.ts` som gjør parallelle spørringer scoped til `get_active_period_id()`: deltagere (bursdag/ankomst/hjemreise), `participant_incidents`, `admin_notes`, `nurse_reports`, `fix_tasks`, `mailbox_messages`, `participant_tasks`, `session_activities`, `team_kitchen_duty`.
- Gjenbruker eksisterende komponenter: `ParticipantDetailDialog`, `AdminNotesPanel`, `TeamBadge`, thumbnails for bilder.
- Små presentasjonskomponenter i `src/components/admin/dashboard/` (StatTile, BirthdayCard, RecentIncidents, NotesPreview, MiniListCard) for å holde filene små.
- Ingen databaseendringer; kun lesing gjennom eksisterende RLS-policyer.
