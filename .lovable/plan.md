## Mål

1. Vis kjøkkenvakt som "Hele dagen" i stedet for klokkeslett (09–17), men behold 8t i timeoversikten.
2. Legg automatisk en merknad på kjøkkenvakt-tildelinger: *"Snakk med Kjøkkenet dagen før vakten din. Du skal følge kjøkkenet hele denne vakten"*.

## Endringer

### 1. Visning av tid — frontend kun, ingen DB-endring

`shift_types.start_time/end_time` forblir 09:00/17:00 i databasen (kolonnene er NOT NULL og `duration_hours = 8` brukes for timeberegning). Vi spesialbehandler kun rendering når `slug === 'kjokkenvakt'`.

Tre filer:

**`src/pages/MyShifts.tsx`** (rundt linje 200) — tid-cellen:
```tsx
{r.st.slug === 'kjokkenvakt'
  ? 'Hele dagen'
  : `${r.st.start_time?.slice(0,5)}–${r.st.end_time?.slice(0,5)}`}
```

**`src/pages/admin/ShiftPlanner.tsx`** (linje 657) — samme erstatning i grid-visningen.

**`src/lib/exportShiftScheduleXlsx.ts`** (`timeRange`, linje 38–40) — endres til å ta `ShiftType` og returnere `'Hele dagen'` for kjøkkenvakt-slug. Funksjonen kalles allerede med `st`, ingen kallesignatur endres.

### 2. Automatisk merknad på kjøkkenvakt

**`supabase/functions/generate-shift-schedule/index.ts`** (linje 538):
```ts
if (p.kjokken) pushLeader(
  d, dt, 'kjokkenvakt', p.kjokken, 'kjokkenvakt',
  'Snakk med Kjøkkenet dagen før vakten din. Du skal følge kjøkkenet hele denne vakten',
);
```

`pushLeader` tar allerede en valgfri `note`-parameter (linje 413, `note?: string | null`) og lagrer den i `shift_assignments.note`. Notatet vises automatisk i:
- Admin-grid (linje 704: `{a.note ? <span>{a.note}</span> : null}`)
- Min vakt — sjekk at note-rendering finnes; hvis ikke, legg den til i samme commit (vises under vakt-navnet).

Notatet vises også i Excel via `teamCellForShift` for individuelle ledere (linje 78: `${name} (${a.note})`).

### Backfill av eksisterende planer

Eksisterende publiserte planer får ikke notatet automatisk. Admin må regenerere perioden for å få merknaden inn — alternativt kan vi kjøre en engangs UPDATE:
```sql
UPDATE shift_assignments
SET note = 'Snakk med Kjøkkenet dagen før vakten din. Du skal følge kjøkkenet hele denne vakten'
WHERE shift_type_id IN (SELECT id FROM shift_types WHERE slug = 'kjokkenvakt')
  AND (note IS NULL OR note = '');
```

Jeg legger denne med som en migration så det er ryddig fra dag én.

### Uendret

- `shift_types`-tabellen.
- Timeberegning (`hoursMatrix`) bruker fortsatt `duration_hours = 8`.
- Kjøkken-fairness (max 1/leder/periode) er allerede på plass.

## Resultat

- Ledere ser "Hele dagen" + merknadsteksten på kjøkkenvakt-dagen sin.
- Excel-eksport viser samme.
- Eksisterende planer får merknaden via migrasjon.
