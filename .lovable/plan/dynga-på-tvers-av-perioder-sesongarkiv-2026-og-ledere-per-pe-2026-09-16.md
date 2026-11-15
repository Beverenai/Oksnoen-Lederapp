# Dynga på tvers av perioder, sesongarkiv 2026 og ledere per periode

Tre ting: se Dynga for alle perioder samtidig, arkivere hele sommeren 2026 uten å miste noe, og styre hvilke perioder hver leder tilhører.

## 1. Dynga: «Alle perioder»

- Periodevelgeren i Dynga får et nytt valg «Alle perioder» øverst.
- Da vises alle kort fra alle perioder i samme tavle, gruppert i kolonnene, med et lite periodemerke (f.eks. «P2») på hvert kort.
- Søk/filter på navn fungerer som i dag, så du finner alle med f.eks. mobilbot uansett periode.
- Visningen er skrivebeskyttet (samme «Arkiv»-merke som når du ser en tidligere periode), fordi kortene hører til perioder som er ferdige.
- Deltakernavn og bilder på kort fra tidligere perioder må hentes fra sesongdataene, ellers står kortene tomme.

## 2. Arkiver sommerleir 2026

- Ny knapp «Arkiver sesongen 2026» i Periodearkiv (kun superadmin), med bekreftelse som viser hva som skjer.
- Ved arkivering:
  - Ledere per periode fryses (samme lagring som brukes i dag ved periodebytte), for hver periode i sesongen.
  - Alle perioder i sesongen merkes arkivert med tidspunkt.
  - Det lastes ned én komplett Excel-fil for hele sesongen (alle datasett, med periodekolonne) — samme innhold som «Hele sesongen»-eksporten i dag.
- Etterpå kan du fortsatt gå inn på hver enkelt periode i arkivet, og søke gjennom alle deltakere for hele sommeren via sesongvisningen.
- Ingenting slettes; arkivering låser bare og markerer.

## 3. Ledere lagres per periode

- I lederkortet/lederdetaljene kommer en seksjon «Perioder» der du velger hvilke perioder lederen jobber i (flervalg, med aktiv periode markert).
- Ny fane/kort i admin viser oversikt: hvilke ledere som er satt opp per periode, med antall.
- Når aktiv periode byttes: lederne som er satt opp for den nye perioden aktiveres automatisk, resten settes i off-season. Du får se antall før du bekrefter.
- Ledere uten noen periodetilknytning blir ikke automatisk deaktivert første gang — du får en advarsel om hvem som mangler oppsett.

## Teknisk

**Database**
- `period_leaders` finnes allerede (0 rader) med kolonner `period_id`, `leader_id`, `status`, `max_hours_per_day`, `notes` og admin-RLS. Brukes som kobling leder↔periode; ingen ny tabell nødvendig. Legger til unik indeks på (`period_id`, `leader_id`) hvis den mangler.
- Engangs-backfill via data-spørring: fyll `period_leaders` for 2026-periodene fra `period_leader_snapshots` (48 rader finnes) + dagens aktive ledere.
- `dynga_cards`/`dynga_columns` har allerede `is_admin()`-lesetilgang uten periodefilter, så ingen policyendring der. `participants` er derimot periodebegrenset i SELECT — kort fra andre perioder joiner derfor til null; løses ved å hente navn/bilde via `get_season_participants()` (finnes) og slå sammen i klienten.
- Ny RPC `archive_season(_season_year int)`: kaller `snapshot_period_leaders` per periode i året og setter `archived_at` på periodene. `periods.archived_at` finnes.
- Ny RPC `apply_period_leaders(_period_id uuid)`: setter `leaders.is_active` true for ledere i `period_leaders` for perioden, false for øvrige (unntatt superadmin/Bengt), returnerer antall.

**Frontend**
- `src/hooks/useDynga.ts`: `useDyngaColumns`/`useDyngaCards` tar `periodId === 'all'` → hopp over `.eq('period_id', ...)`; query keys inkluderer 'all'.
- `src/pages/admin/Dynga.tsx`: «Alle perioder»-valg, `readOnly` når valgt, periodenavn-map for badge.
- Nytt: `PeriodBadge` på `DyngaCard` (i `src/components/admin/dynga/`).
- `src/pages/admin/PeriodArchive.tsx`: knapp «Arkiver sesongen {år}» som kaller `archive_season` og deretter eksisterende `exportSeason()`.
- `src/components/admin/NursePeriodsTab.tsx`: ved periodebytte, kall `apply_period_leaders` etter snapshot, og vis antall aktiverte/deaktiverte i bekreftelsen.
- Nytt: `LeaderPeriodsCard` i lederdetaljene (`src/components/admin/LeaderDetailDialog.tsx`) med flervalg av perioder, samt en oversiktsseksjon i periodefanen.

**Utenfor omfang**
- Ingen endringer i Leirskole, lønnseksport eller design ellers.
