## Mål

På "Min vakt"-siden: når lederen har kjøkkenvakt en dag, vis kun kjøkkenvakt for den dagen — skjul alle andre vakter samme dag. Ingen endring i database, edge function eller adminvisning.

## Endring

Kun én fil: `src/pages/MyShifts.tsx`

Etter at `day.rows` er bygget per dag, sjekk om noen rad er kjøkkenvakt:

```ts
const hasKjokken = day.rows.some((r) => r.st.slug === 'kjokkenvakt');
const visibleRows = hasKjokken
  ? day.rows.filter((r) => r.st.slug === 'kjokkenvakt')
  : day.rows;
```

Bruk `visibleRows` i stedet for `day.rows` i `<ul>`-renderingen. Merknadsteksten ("Snakk med Kjøkkenet …") vises allerede via `r.note`.

## Uendret

- Admin-grid viser fortsatt alle vakter (slik at admin ser eventuelle konflikter).
- Excel-eksport, edge function og DB rørt ikke.
- Timeoversikten på admin-siden er uendret.
