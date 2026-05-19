## Hyttefilter + custom aktivitet i masseregistrering

**Fil:** `src/components/passport/BulkActivityRegistration.tsx`

### 1. Custom aktivitet
Legg til en "Egendefinert"-rad nederst i `<Select>` for aktivitet. Når valgt, vises et `<Input>` der lederen skriver inn fritt navn på aktiviteten (validert: trimmet, 1–60 tegn).

Endringer:
- Ny state: `const [isCustom, setIsCustom] = useState(false)` og `const [customName, setCustomName] = useState('')`.
- `Select.onValueChange`: hvis verdien er `'__custom__'` → `setIsCustom(true); setSelectedActivity('')`. Ellers → `setIsCustom(false); setSelectedActivity(value)`.
- Når `isCustom`, render `<Input placeholder="Skriv aktivitetsnavn..." maxLength={60} value={customName} onChange={...}>` rett under selecten. `selectedActivity` settes (debounced via onChange) til `customName.trim()`.
- `handleSubmit` bruker `selectedActivity` som før — siden tekststrengen lagres direkte i `participant_activities.activity`, krever det ingen DB-endring.
- Filter "har gjort allerede" overhopper custom-treff bare hvis navnet er identisk (case-insensitive) — eksisterende logikk dekker dette.

### 2. Hyttefilter
Legg en `<Select>` for hytte ved siden av søkefeltet (eller over deltakerlisten).

- Beregn `availableCabins` via `useMemo`: unike `participant.cabins?.name` fra inputlisten, sortert med `localeCompare('nb')`.
- Ny state: `const [cabinFilter, setCabinFilter] = useState<string>('all')`.
- Select-verdier: `"all"` (Alle hytter) + én rad per hytte + `"none"` (Uten hytte).
- I `filteredParticipants`: legg til `matchesCabin`:
  ```
  const matchesCabin =
    cabinFilter === 'all' ||
    (cabinFilter === 'none' && !p.cabins?.name) ||
    p.cabins?.name === cabinFilter;
  ```
- Vises som chip-row over deltakerlisten, justert med søkefeltet. Bruker eksisterende `<Select>`-komponent.

### Layout-rekkefølge i kortet
1. Aktivitet-velger (med "Egendefinert"-rad)
2. Input for custom navn (kun hvis valgt)
3. Søk (deltaker)
4. Hyttefilter-select
5. "Velg alle / Fjern valg"
6. Deltakerliste
7. Registrer-knapp (bruker `selectedActivity` direkte)

### Ikke berørt
- DB-skjema (`participant_activities.activity` er fri tekst), RLS, andre sider, `PassportActivity.tsx`-wrapperen.