## Mål

1. Rydde +47 fra eksisterende ledere så telefon-pålogging og Sheet-sync matcher riktig.
2. Verifisere at admin kan oppdatere ledere manuelt (RLS).

## 1. Rydd opp telefon-numre i databasen

28 av 64 ledere har `+47` foran nummeret. `phone-login` edge-funksjonen normaliserer innkommende nummer ved å fjerne alt som ikke er siffer, men sammenligner deretter mot lagret `phone`-felt — så `+4791234567` (lagret) ≠ `91234567` (normalisert input) og innlogging feiler.

**Engangs-migrasjon** som rydder opp i `leaders.phone`:
- Fjern ledende `+47`, `0047`, `47` (kun når det etterfølges av 8 siffer).
- Fjern alle mellomrom.
- Resultat: alle nummer lagres som rene 8 sifre.

```text
+47 912 34 567  →  91234567
0047 91234567   →  91234567
4791234567      →  91234567
91234567        →  91234567 (uendret)
```

Dette gjør også at Google Sheet-sync (som matcher på siste 8 sifre) blir konsistent med innloggingsflyten.

## 2. Strip +47 også på lagring fra admin-UI

I `LeaderDetailDialog.tsx` og ny-leder-skjemaet i `AdminSettingsContent.tsx` legger jeg på samme normalisering før `phone` skrives til DB, slik at problemet ikke kommer tilbake hvis noen taster inn et nummer med +47 manuelt.

## 3. Verifiser admin-oppdatering

RLS-policy på `leaders`:
```text
UPDATE: id = current_leader_id() OR is_admin()
```
Dette er korrekt — admins kan oppdatere alle ledere. Jeg sjekker at lagre-knappen i `LeaderDetailDialog` faktisk treffer denne pathen (ingen bug i oppdaterings-payloaden), og at feilmeldinger vises tydelig hvis noe skulle feile (toast i stedet for stille fail).

## Hva jeg IKKE rører
- `auth.users` (telefon der bruker Supabase sitt eget format og brukes ikke som match-nøkkel).
- `is_active` toggle / aktiverings-flyt — ikke en del av denne oppgaven.
