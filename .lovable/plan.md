

## Fiks: Sider som henger på skeleton/loading uten å laste

### Problemet
Home og Profile bruker manuell `useState`/`useEffect`-basert datahenting. Hvis en Supabase-forespørsel henger (f.eks. ved token-refresh eller nettverkstreg), sitter `isLoading` fast på `true` — og brukeren ser bare skjeletter som aldri forsvinner. Det finnes ingen timeout eller feilhåndtering som avbryter lastingen.

I tillegg har Home.tsx en bug: `loadData` har `leader` som dependency i `useCallback`, men `useEffect` lytter på `effectiveLeader`. Dette kan gi mismatches.

### Endringer

#### 1. Legg til timeout på lasting i Profile.tsx
- Hvis `loadProfile` ikke fullfører innen 8 sekunder, sett `isLoading = false` og vis en retry-knapp i stedet for evig skeleton.
- Vis profilen med det vi har (eller en feilmelding med retry).

#### 2. Legg til timeout på lasting i Home.tsx
- Samme mønster: timeout etter 8 sekunder → vis feilmelding med retry-knapp.
- Fiks dependency-bug: `loadData` bør bruke `effectiveLeader` (ikke `leader`) som dependency i `useCallback`.

#### 3. Ikke vis evig skeleton — vis retry ved feil
- Begge sider: erstatt den evige skeleton-visningen med en tilstand som skiller mellom "laster første gang" og "lasting feilet".
- Ved feil: vis en kort melding ("Kunne ikke laste data") med en "Prøv igjen"-knapp.
- Behold skeleton kun for de første 1-2 sekundene av normal lasting.

#### 4. Fallback: vis sist kjente data
- Hvis `effectiveLeader` finnes men forespørselen feiler, vis i det minste lederens navn og grunnleggende info fra `effectiveLeader`-konteksten i stedet for en blank side.

### Filer som endres
- `src/pages/Home.tsx`
- `src/pages/Profile.tsx`

### Resultat
- Sidene henger aldri på evig skeleton
- Brukeren ser alltid noe nyttig, selv om nettverket er tregt
- Retry-knapp gjør det enkelt å prøve på nytt uten å måtte refreshe hele appen

