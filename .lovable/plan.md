# Liggeliste (internt lederkart)

En intern funksjon under **Mer** der ledere kan registrere koblinger med andre ledere, og se et felles "liggekart" for perioden.

## Kjerneregel: gjensidig bekreftelse

En kobling opprettes som en **forespørsel** fra én leder til en annen. Den vises i det felles kartet først når den andre lederen har bekreftet den.

- Ubekreftede forespørsler er kun synlige for de to involverte.
- Den andre kan bekrefte, avslå eller ignorere. Avslåtte vises aldri for noen.
- Begge kan trekke tilbake en bekreftet kobling senere — da forsvinner den fra kartet.

Dette er ikke en teknisk detalj: det er det som gjør at ingen kan bli navngitt i en påstand de ikke har godtatt.

## Sider

**`/liggeliste`** (lenke som ny flis i Mer, seksjon "Spesial")

1. **Kartet** — alle bekreftede koblinger blant aktive ledere i perioden, vist som et nettverk/graf med profilbilder. Trykk på en leder for å se hvem hen er koblet til.
2. **Mine koblinger** — legg til ny (søk blant aktive ledere), se sendte forespørsler, bekreft innkommende, fjern eksisterende.
3. **Toppliste** — antall bekreftede koblinger per leder, og "kjeder" (hvem er koblet via flest ledd).

Innkommende forespørsler får et rødt badge på Mer-flisen, samme mønster som Postkasse.

## Tilgang

- Kun innloggede, aktive ledere i gjeldende periode. Deltakere finnes ikke i denne funksjonen i noen form.
- Admin kan slå funksjonen av globalt (som Lag/Ordleken), og kan slette enkeltkoblinger ved behov.
- Ingenting vises på hjemskjermen eller andre sider — funksjonen er isolert bak Mer.

## Teknisk

**Ny tabell `leader_hookups`**
- `leader_a_id`, `leader_b_id` (ledere, normalisert så a < b for å unngå duplikater)
- `period_id` (default aktiv periode via eksisterende trigger)
- `status`: `pending` | `confirmed` | `declined`
- `requested_by`, `confirmed_at`, `created_at`, `updated_at`
- Unik indeks på (period_id, leader_a_id, leader_b_id)

**RLS**
- `SELECT`: bekreftede rader synlige for alle innloggede ledere; `pending`/`declined` kun for de to involverte eller admin.
- `INSERT`: kun med seg selv som `requested_by` og som en av de to partene.
- `UPDATE`: kun motparten kan sette `confirmed`/`declined`; begge parter og admin kan slette.
- GRANT til `authenticated` og `service_role`.

**Nye filer**
- `src/hooks/useHookups.ts` — React Query-hooks for kart, egne koblinger, forespørsler, mutasjoner.
- `src/pages/Liggeliste.tsx` — tre faner (Kart / Mine / Toppliste).
- `src/components/liggeliste/HookupGraph.tsx` — nettverksvisning med avatarer.
- `src/components/liggeliste/AddHookupSheet.tsx` — søk og send forespørsel.

**Endringer**
- `src/App.tsx` — ny rute `/liggeliste`.
- `src/pages/More.tsx` — ny flis med badge for ventende forespørsler.
- `src/pages/admin/AdminSettings.tsx` — av/på-bryter (`app_config`-nøkkel `hookups_enabled`).
