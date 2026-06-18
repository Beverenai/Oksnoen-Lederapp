# Plan: Lås manuelle endringer, regenerér resten

Når du endrer en vakt manuelt skal den endringen "låses". Når du så trykker Generér på nytt, beholdes alle låste celler urørt, og resten av planen bygges opp rundt dem — slik at fairness, 8t-regel, 11t hvile, F-team etter 21, og kjøkken-cap fortsatt overholdes.

## Hva som bygges

### 1. Database
Ny kolonne `is_locked boolean default false` på `shift_assignments`. Settes til `true` automatisk når en rad opprettes/endres manuelt fra admin-grid.

### 2. Admin-grid (ShiftPlanner)
- Når du bytter leder i en celle → raden lagres med `is_locked = true`.
- Låste celler markeres visuelt (f.eks. liten 🔒-ikon eller blå ramme) så det er tydelig hva som er beskyttet.
- Ny knapp "Lås opp" på celle for å fjerne låsen hvis du vil at generatoren skal kunne overskrive den igjen.
- Knapp "Regenerér (behold låste)" ved siden av eksisterende generér-knapp.

### 3. Edge function `generate-shift-schedule`
Ny parameter `preserve_locked: boolean`. Når `true`:
1. Hent alle låste rader for `schedule_id`.
2. Slett kun de **ulåste** radene (i stedet for å slette alt).
3. Bygg `busy`-sett per dag fra de låste radene før vi velger nye ledere — så samme leder ikke får dobbel vakt.
4. Forhåndsutfyll tellerne (`dutyCount`, `kjokkenCount`, frokostByDay) fra låste rader, slik at fairness og kjøkken-cap fortsatt holder.
5. Hopp over duty-typer som allerede er fylt av låst rad den dagen (f.eks. hvis nattevakt er låst, ikke pick ny natt).
6. Sett inn de nye genererte radene sammen med de låste.

### 4. Validering
Etter regenerering kjøres `revalidate-shift-schedule` som før, og advarsler som oppstår pga. en låst rad merkes med "(låst manuelt)" så du ser hvilke som krever din vurdering.

## Teknisk

```text
ShiftPlanner (UI)
  ├─ endre celle ──► UPDATE shift_assignments SET leader_id=…, is_locked=true
  └─ "Regenerér (behold låste)" ──► invoke generate-shift-schedule { preserve_locked: true }

generate-shift-schedule
  ├─ load locked rows
  ├─ DELETE FROM shift_assignments WHERE schedule_id=… AND is_locked=false
  ├─ seed busy/dutyCount/kjokkenCount/frokostByDay from locked
  ├─ for each day & duty-slot:
  │     if locked covers slot → skip
  │     else → pick fairest, avoiding busy
  └─ insert new rows (is_locked=false)
```

Migrasjonen kommer som første steg (du godkjenner SQL-en), deretter kode-endringer i edge function og ShiftPlanner.
