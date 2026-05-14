## Problem

Timer-tabellen i ShiftPlanner viser ~16 t/dag for ledere som har en egen-vakt (kjøkkenvakt, morgenvakt, nattevakt, bingsvakt, sanitas, frokostvakt). Tallet er feil fordi varigheter summeres rått — også når egen-vakten tidsmessig overlapper med team-vakter som vedkommende egentlig er ekskludert fra.

Generator-koden i `supabase/functions/generate-shift-schedule/index.ts` håndterer dette korrekt i `recordWork` (eksluderer leder fra team-vakter de er trukket ut av). Men `shift_assignments`-radene i databasen lagrer ikke ekskluderingslisten — bare `team_name` — så UI-tabellen ekspanderer hele teamet og dobbelttoler.

Med 8 dager (6 normale dager) er problemet mer synlig fordi det er flere normaldager hvor mønsteret repeteres.

## Løsning

Bytt fra "summer varigheter" til "summer union av tidsintervaller" per (leder, dag) i `hoursMatrix`. Da blir overlappende vakter telt som ett sammenhengende intervall, og dobbelttellingen forsvinner uten at generator/DB-modellen må endres.

### Detaljer

I `src/pages/admin/ShiftPlanner.tsx`, i `hoursMatrix`-useMemo:

1. For hver `assignment` bygg et tidsintervall `{startAbs, endAbs}` på samme måte som edge-funksjonen (`shiftInterval`): minutter siden midnatt, og hvis `end <= start` → krysser midnatt → +24t.
2. Per (`leader_id`, `day_index`), samle alle intervaller (både fra `assignment_type='leader'` og fra team-ekspansjon).
3. Slå sammen overlappende/kantliggende intervaller (sort + merge).
4. Sum union-lengden i timer.

Resultat: kjøkkenvakt (09–17) som overlapper med vekking/frokost/pm1/økt1/middag/pm2/økt2 teller ~09–19 ≈ 10t, ikke 16t. Morgenvakt (06–08:30) som "ekskluderer" seg selv fra vekking/frokost forblir korrekt fordi disse uansett er sekvensielle.

Ingen endringer i edge-funksjonene — kun UI-beregning.

### Filer som endres

- `src/pages/admin/ShiftPlanner.tsx` — `hoursMatrix` useMemo (~linje 267–297)

### Verifisering

- Sjekk at en bingsF-leder som er kjøkkenvakt viser ~10 t (ikke 16).
- Sjekk at en team1-leder som er nattevakt på normaldag viser ~13 t (06–01 med pauser → union ca 13 t arbeidstid: pm1+økt1+pm2+økt2 dekkes ikke for morning18, så reelt: pm1 0.25 + økt1 3 + middag/legging utelatt + pm2 0.25 + nattevakt 5.5 ≈ men union…). Forventet rundt 8–9 t for en typisk leder uten egen-vakt.
- Sumkolonnen "Sum dag" gir mening (ca antall ledere × 8).
