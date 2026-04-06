

## Fiks: ParticipantStatsCard henger på skeleton forever

### Problemet
Samme mønster som Home/Profile: `ParticipantStatsCard` bruker `useState`/`useEffect` med `Promise.all` mot Supabase, men har ingen timeout eller feilhåndtering som avbryter loading-tilstanden. Hvis en av forespørslene henger (token-refresh, tregt nettverk), sitter `isLoading` fast på `true`.

### Endring i `src/components/admin/ParticipantStatsCard.tsx`

**1. Legg til timeout på datahenting (linje 63-80)**
- Wrap `Promise.all` i en `Promise.race` med 10-sekunders timeout
- Ved timeout eller feil: sett `isLoading = false` og vis feilmelding med retry-knapp

**2. Legg til error-state (linje 44-51)**
- Ny `const [error, setError] = useState<string | null>(null)`
- Ved feil: `setError('Kunne ikke laste data')`

**3. Vis feilmelding i stedet for evig skeleton (linje 157-175)**
- Hvis `error` og ikke `isLoading`: vis kort med feilmelding og «Prøv igjen»-knapp som kaller `loadData()`
- Behold skeleton kun mens `isLoading` er `true`

### Filer som endres
- `src/components/admin/ParticipantStatsCard.tsx`

### Resultat
- Siden henger aldri på evig skeleton
- Brukeren ser feilmelding med retry-knapp etter 10 sekunder
- Ingen andre sider påvirkes

