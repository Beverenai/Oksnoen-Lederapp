## Mål

Flytte ankomst- og avreise-blokkene ut av hovedarket og inn i hvert sitt eget regneark i den genererte Excel-filen.

## Endringer

Kun én fil: `src/lib/exportShiftScheduleXlsx.ts`

### Nye ark-struktur

I dag genereres alt på ett ark `Periode N` i denne rekkefølgen:
1. Tittel
2. Normaldager (header + 4 team-rader per dag)
3. Asterisk-fotnoter
4. "Ankomst (Lørdag)"-blokk
5. "Avreise (Lørdag)"-blokk

Ny struktur — tre ark per periode:

```text
[ Periode N ]   ← normaldager + asterisk-fotnoter (uendret innhold)
[ Ankomst  ]   ← samme blokk som før, men på eget ark
[ Avreise  ]   ← samme blokk som før, men på eget ark
```

### Implementasjon

1. Behold hovedarket `Periode N` som det er, men fjern alt fra og med `===== ARRIVAL BLOCK =====` og nedover.
2. Legg til to nye worksheets:
   - `wb.addWorksheet('Ankomst')`
   - `wb.addWorksheet('Avreise')`
3. På hvert nye ark:
   - Sett `defaultColWidth = 16` og kolonnebredder for kolonne 1 + alle vakt-kolonner.
   - Skriv tittel-rad ("Ankomst (Lørdag) — Periode N / Y" / tilsvarende for avreise) merget over kolonnene, samme styling som dagens blokk-tittel.
   - Kall `writeSpecialBlock(...)` med `startRow = 3`, slik at funksjonen skriver header (Vakt/Tid/Timer) + 4 team-rader på det aktuelle arket.
4. `writeSpecialBlock` trenger ingen endringer — den tar allerede `ws` som parameter.

### Uendret

- Datamodell, sammenslåing av sammenhengende celler, farger og fonter er som før.
- Hovedarket beholder normaldagene og fotnotene nederst.
- Filnavn på nedlastingen er uendret.

## Resultat

Excel-filen får tre faner nederst: `Periode N`, `Ankomst`, `Avreise` — hver med sin egen oversiktlige tabell.
