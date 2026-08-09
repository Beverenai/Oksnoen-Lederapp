# Kjøkken-modul + "Mer" på PC

## Hva du får

En egen **Kjøkken**-side i appen med all informasjonen fra de 10 dokumentene, strukturert som sjekklister og guider. En ny rolle **Kjøkken** som gir tilgang til siden — synlig kun for kjøkken-rollen og admin.

### Struktur på Kjøkken-siden

Siden får fane-/kortnavigasjon med disse seksjonene, hentet direkte fra dokumentene:

- **Kokke-rollen** — guide: ansvar, vaktplan i to team, hytteinndeling i matsal, allergioversikt, kjøkkenrapport
- **Gylne regler** — de viktigste reglene (varmt vann til lederbordet, aldri klor + salmiakk, matsal vaskes etter middag, grisene mates etter måltid osv.)
- **Frokost** — måltidsguide kl. 09.00 i riktig rekkefølge + "Frokost huskeliste" (hva som skal på hvert bord)
- **Middag** — kl. 14.00, allergitips + oppskrift "Skinkestek og fløtegratinerte poteter"
- **Kvelds** — kl. 19.00
- **Lederbordet** — hva som alltid skal stå fremme, forslag til ekstra pålegg og ekstra-retter
- **Kjøkkenvakt to-do** — vaske lederhuset, lederbordet, generelle oppgaver
- **Før du tar kvelden** — kveldsrutine-sjekkliste
- **Utvask av kjøkkenet** — den store avreise-lista, med "hvordan"-tips og hvem-felt fra Oppgavelista

Hver seksjon er enten en **sjekkliste** (avkrysningsbokser, valgfri "hvordan"-tekst under hvert punkt, og navn på den som krysset av) eller en **guide** (formatert tekst).

### Avkrysning

Avkrysninger lagres **per periode**. Ny periode = alle lister blanke igjen. Du ser hvem som krysset av og når, og fremdrift per liste (f.eks. "12/38 gjort").

### Redigering

Admin kan redigere alt direkte på siden: legge til/fjerne punkter, endre tekst, sortere, og legge til nye seksjoner. Kjøkken-rollen kan krysse av, men ikke redigere.

### Kjøkken-rollen

Ny rolle på lik linje med Nurse. Admin tildeler rollen til ledere i admin-panelet. Kjøkken-brukere ser Kjøkken-knappen i "Mer" og i menyen; vanlige ledere ser den ikke.

### "Mer"-knapp på PC

Sidemenyen på PC får en **Mer**-lenke nederst i navigasjonen som åpner samme rutenett-side som på mobil (`/mer`), tilpasset bredere skjerm (flere kolonner). Sidemenyen beholdes som i dag.

## Teknisk

- Migrasjon 1: legg `'kitchen'` til `app_role`-enumen (kjøres alene før den brukes).
- Migrasjon 2: `public.is_kitchen()` (security definer, samme mønster som `is_nurse()`), pluss tabeller:
  - `kitchen_sections` — slug, tittel, ikon, kind ('checklist' | 'guide'), body, sort_order
  - `kitchen_items` — section_id, label, hint ("hvordan"/middel), sort_order
  - `kitchen_item_checks` — item_id, period_id (default via `set_period_id_default`), checked_by, checked_at; unik på (item_id, period_id)
  - GRANT til `authenticated` + `service_role`; RLS: lesing for `is_kitchen() OR is_admin()`, avkrysning for samme, redigering av seksjoner/punkter kun `is_admin()`; `update_updated_at_column`-trigger.
- Data-seeding: alt innhold fra de opplastede dokumentene settes inn som seksjoner og punkter via insert-verktøyet. `Kjøkken.doc` konverteres til lesbart format først; hvis den kun dupliserer de andre dokumentene, hoppes den over.
- Frontend:
  - `src/pages/Kjokken.tsx` + `src/components/kitchen/KitchenSectionList.tsx`, `KitchenChecklist.tsx`, `KitchenSectionEditor.tsx` (admin)
  - `src/hooks/useKitchen.ts` — React Query, realtime-oppdatering, optimistisk avkrysning
  - `AuthContext`: `isKitchen` ved siden av `isNurse`
  - Rute `/kjokken` i `App.tsx` (beskyttet, kun kjøkken/admin)
  - `More.tsx`: Kjøkken-flis under "Spesial"; `AppLayout.tsx`: Kjøkken i sidemenyen + ny "Mer"-lenke på PC
  - Rollevelgeren i admin utvides med "Kjøkken" (`manage-roles`-funksjonen tar imot den nye rollen)

## Rekkefølge

1. Migrasjon: enum-verdi `kitchen`
2. Migrasjon: `is_kitchen()` + tre tabeller med RLS/grants
3. Seed alt dokumentinnhold
4. Rolle-støtte i AuthContext, admin-rollevelger og edge function
5. Kjøkken-side med sjekklister, guider og admin-redigering
6. Navigasjon: `/kjokken` i Mer + sidemeny, og "Mer" på PC