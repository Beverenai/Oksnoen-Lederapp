

## Fix: Fjern duplikat placeholder, behold permanent skriveområde øverst

### Problem
1. Det vises **to** placeholder-tekster — én manuell `div` (linje 803-809) OG CSS `::before` på `data-placeholder` (linje 832)
2. Placeholder-div forsvinner når innhold legges til — men brukeren vil ha en permanent "skriveområde"-linje øverst som alltid er synlig

### Løsning

**I `NurseReportEditor.tsx` (render-delen):**

1. **Fjern den manuelle placeholder-div** (linje 803-809) — den er redundant med CSS `::before` og skaper dobbel tekst
2. **Behold CSS `::before` placeholder** på den tomme editoren — dette er standard oppførsel og forsvinner når man begynner å skrive (riktig)
3. **Endre placeholder-teksten** til: `Legg til deltaker med "@navn"` — kortere og tydeligere
4. **Fjern `data-placeholder`-attributtet** fra editoren og bruk bare CSS `::before` basert på `:empty`
5. **Legg til en fast "instruksjons-linje"** over editoren (ikke inne i den) — en enkel liten tekst som alltid vises: `Legg til deltaker med @` — denne er ikke redigerbar, bare visuell veiledning

Resultatet: Én ren editor med én placeholder når tom, og en liten fast instruksjonstekst over som aldri forsvinner.

### Fil som endres

| Fil | Endring |
|-----|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Fjern duplikat placeholder-div, oppdater placeholder-tekst, legg til fast instruksjonslinje over editor |

