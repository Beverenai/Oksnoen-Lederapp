## Mål

Tre endringer i lederpasset (`src/components/passport/LederPass.tsx`).

### 1. Tjenesteår blir siste side
Flytt siden `tjenestear` (med `ServiceHistoryEditor`) fra plass 2 til aller siste posisjon i siderekkefølgen. Ny rekkefølge:

```text
Forside → Legitimasjon → Lederopplysninger → Godkjenninger → Lederløftet → Stempler (1..n) → Tjenesteår
```

### 2. Snarvei når man ikke har stempler
Når lederen ikke har huket av noen år/perioder, viser «Stempler»-siden i dag bare en tekst om å bla tilbake. Erstattes med:
- kort forklarende tekst («Ingen tjenesteår registrert ennå»)
- en tydelig knapp «Velg år og perioder» som hopper direkte til siste side (Tjenesteår) via sidestaten
- knappen skjules når passet vises for en annen leder uten redigeringsrettigheter (kun lesetilgang) — da vises bare teksten

### 3. Flere stempler per side + automatisk ny side
Stempelrutenettet går fra 2 kolonner / 7 stempler til 3 kolonner / 12 stempler per side, med mindre stempelstørrelse (ca. 56 px) og tettere avstand slik at 12 får plass på 2:3-formatet uten scrolling. Overflyt fortsetter automatisk på nye sider (logikken finnes allerede via `chunk`), og teller-etiketten «Stempler 1/3» oppdateres av seg selv. År/periode-etiketten under hvert stempel beholdes i mindre skrift.

Sideindikator-punktene nederst begrenses så de ikke sprenger bredden når mange sider finnes (kompakt visning når antall sider er høyt).

### 4. Lederløftet — ny tekst
Erstatt dagens tekst med:

> «Jeg lover å ta vare på deltakerne, lederene og øya. Å gå foran med varme, oppmerksomhet og godt humør — og å bære Øksnøen-ånden videre.»

## Teknisk

- `STAMPS_PER_PAGE` 7 → 12, `grid-cols-2` → `grid-cols-3`, `PeriodStamp size` 72 → 56.
- Sidearrayet reorganiseres; en hjelpefunksjon/indeks brukes for «gå til Tjenesteår»-knappen (siste indeks) i stedet for hardkodet tall.
- Tekst i tom-tilstanden og `canEdit`-sjekken gjenbruker eksisterende `canEdit`.
- Ingen databaseendringer.

Verifiseres i mobil-preview med testdata for både 0, 7 og 20+ stempler.
