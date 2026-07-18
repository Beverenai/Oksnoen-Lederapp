
## 1. Poeng per gjennomført aktivitet i Lag

I dag får hvert lag +1 poeng per hemmelig-ord-match. Vi utvider slik at lag også får poeng for hver aktivitet en av deres deltakere gjennomfører i aktiv periode.

Endring i `src/components/stats/TeamsTab.tsx`:
- Utvid `teamPoints`-spørringen til også å hente rader fra `participant_activities` for aktiv periode.
- For hver aktivitet: +1 poeng til laget deltakeren er på.
- Legg poengene sammen med eksisterende ord-match-poeng, slik at trofé-badgen viser totalen.

## 2. Større og finere PDF-utskrift av hemmelige ord

Endring i `src/components/stats/SecretWordsTab.tsx` → `printPerCabin()`.

Nytt layout: **5–6 deltakere per A4-side**, hver deltaker som et tydelig "kort" atskilt med linje. Kortene grupperes fortsatt per hytte (ny side når ny hytte starter), sortert alfabetisk.

Hvert deltaker-kort inneholder:

```text
[FULLT NAVN]                        ← stor tittel

Velkommen til De Ti Stammene        ← subtitle
[●] Lag [nummer] – [Lagnavn]        ← farge-prikk + lagnavn

Her er ditt hemmelige ord:
      [ORDET]                       ← veldig stort, monospace

Finn en annen deltaker som har ordet som hører sammen
med ditt. Når dere tror dere har funnet hverandre,
gå til en leder som verifiserer paret i appen.
```

Teknisk:
- Hent `participant_teams` (id, name, slot, color) og slå sammen med tildelinger via `participants.team_id`.
- Print-CSS: A4 med 12mm marg, hvert kort `~50mm` høyt, `page-break-inside: avoid` slik at et kort aldri kuttes midt over.
- Ny hytte → `page-break-before: always` på første kort i hytten, med hytte-header øverst på siden.
- Font: navn ~20pt, ord ~48pt monospace, kropp ~10pt. Passer ca. 5 kort per side.

CSV-eksport og resten av fanen er uendret.
