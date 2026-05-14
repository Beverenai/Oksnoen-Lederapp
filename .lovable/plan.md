## Hva er galt

To bugs gjør at advarsler forsvinner:

1. **`loadGrid` revaliderer ikke.** Når du klikker "Vis" på en plan (eller laster siden på nytt), forblir `warnings`-state tom og UI viser feilaktig "Ingen regelbrudd oppdaget".
2. **`revalidate-shift-schedule` ignorerer team-tildelinger.** Den teller bare `assignment_type='leader'`. Men generatoren lagrer mange vakter som hele team (Økt 1, Middag, osv.) — generator-valideringen teller hver leder i teamet, revalidate gjør det ikke. Resultat: 134 → 0 etter første revalidering, selv om planen ikke er endret.

## Fiks

### 1. `supabase/functions/revalidate-shift-schedule/index.ts`
Ekspander team-tildelinger til medlemmene før beregning:

- Bygg `teamMembers: Record<Team, Leader[]>` ved å gruppere aktive ledere på `team`-feltet (mapping: `'1'→team1`, `'2'→team2`, `'1f'→team1f`, `'2f'→team2f`).
- For hver assignment: hvis `assignment_type='team'` og `team_name` matcher en av de fire team-keys, loop over medlemmene og legg ett intervall per medlem inn i `work`-mappen.
- Hvis `assignment_type='leader'`: som i dag, ett intervall.
- Resten av valideringen (8t/dag, 11t-hvile, F-team-etter-21) er uendret og gir nå samme resultat som generatoren.

### 2. `src/pages/admin/ShiftPlanner.tsx` — `loadGrid`
Etter `setAssignments(...)`, kall `revalidate(id)` slik at advarsler alltid reflekterer den viste planen. `revalidate`-helperen finnes allerede.

## Berørte filer
- `supabase/functions/revalidate-shift-schedule/index.ts`
- `src/pages/admin/ShiftPlanner.tsx`
