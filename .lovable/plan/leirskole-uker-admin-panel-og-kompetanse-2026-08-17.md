# Leirskole: uker, admin-panel og kompetanse

## 1. Hvorfor ukene ikke vises (må verifiseres først)
De seks ukene ligger i basen (Uke 34 t.o.m. Uke 37), og Leirskole-admin har et "Uker"-kort som lister dem. Årsaken til at du ikke ser dem er derfor ikke bekreftet ennå. To ting sjekkes som første steg:

- Alle seks ukene står som aktive samtidig (de ble lagt inn med aktiv-flagget satt). Det gjør "aktiv uke"-logikken tvetydig og kan gi rar visning.
- Hvilken side du faktisk ser: i leirskole-modus kan du havne på det vanlige admin-panelet (Lederoversikt) i stedet for `/admin/leirskole`.

Tiltak: rydd så kun én uke er aktiv (uke velges automatisk ut fra dato), og sørg for at admin-inngangen i leirskole-modus alltid åpner Leirskole-admin.

## 2. Leirskole-admin får samme type panel
Bygg et leirskole-lederpanel i samme stil som Lederoversikt (kortgrid med bilde, navn, badge, søk, grid/liste-bryter, antall "X av Y ledere"):

- Kort per leder som jobber uken: profilbilde, navn, rolle-/timebadge, kompetanse som små chips, og handlinger (se detaljer / rediger).
- Søkefelt og filter (alle / mangler kompetanse / over timer).
- Øverst: valgt uke med datoer, antall ledere og publiseringsstatus.
- Resten av dagens kort (vaktplan-generator, øktinfo, oppgaver, timer per leder) beholdes under panelet.

## 3. Kompetanse for leirskole-ledere
Faste kompetanser: Tube, Klatring, Rappellering, Kanotur, Båtkjøring, Badevakt.

- Lederen får en kompetanse-skjerm første gang de logger inn i leirskole-modus (kan ikke hoppes over uten å velge, men kan endres senere fra Profil/Mer).
- Valgt kompetanse vises som chips på lederkortene i Leirskole-admin, og admin kan overstyre.
- Vaktplan-generatoren kan senere bruke kompetanse som krav per post (ikke del av denne leveransen).

## 4. Aktivere ledere for denne uken (Uke 34, 17.-21. aug)
Legges inn som leirskole-staff + får leirskole-rolle:
Jakob Porter, Sofia Hole, Mats Frantsen, Conrad Leren Hamang, Clara Bergvall, Olivia Eskeland, Fie Dahl Landrø, Hedda Nordan, Fredrik Tollerud.

Uavklart: "Karoline" finnes ikke med det navnet. Nærmeste treff er Caroline Røthe Skjaker — bekreft om det er henne, ellers legges hun ikke inn.

## Teknisk
- Migrering: `leaders.leirskole_competencies text[]` (eller kolonne på `leirskole_staff` hvis kompetansen skal være per uke — velger leder-nivå siden den er personlig). Ingen nye tilgangsregler utover eksisterende leirskole-policyer.
- Dataoppdatering: sett kun én uke aktiv; insert i `leirskole_staff` for Uke 34 + `user_roles` (leirskole) for de nevnte lederne.
- Ny komponent `LeirskoleStaffPanel.tsx` (gjenbruker mønsteret fra `LeaderDashboard`/`LeaderListView`) satt inn i `src/pages/admin/LeirskoleAdmin.tsx`.
- Ny `LeirskoleCompetenceSheet.tsx` + hook i `src/hooks/useLeirskole.ts`, trigget fra `src/pages/Leirskole.tsx` når kompetanse mangler, og tilgjengelig fra Mer/Profil.
