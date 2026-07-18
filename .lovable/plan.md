## Mål
I Ambassadører-fanen (Admin → Deltakerstatistikk → Ambassadører) vise genserstørrelse for hver deltaker, slik at man kan planlegge ambassadør-genserene.

## Endring
Kun `src/components/stats/AmbassadorsTab.tsx`:

1. Utvid Supabase-spørringen til å joine `participant_sweaters` filtrert på aktiv periode:
   - Hent `bought_size`, `bought_on_camp`, `picked_up_size`, `picked_up`, `preordered_size`.
2. Beregn "effektiv størrelse" per deltaker med prioritet:
   1. `bought_size` hvis `bought_on_camp = true`
   2. ellers `picked_up_size` hvis `picked_up = true`
   3. ellers `preordered_size`
   4. ellers "—"
3. Vis størrelsen som en egen `Badge` ved siden av "X år"-badgen på hvert kort, med liten label-tekst (f.eks. "Str. L" eller kilde-ikon: 🛒 kjøpt / 📦 hentet / 📋 forhåndsbestilt via tooltip/farge).
4. Legg til en oppsummering øverst i "Nye ambassadører"-seksjonen som teller antall per størrelse (XS/S/M/L/XL/XXL + Ukjent), så man raskt ser hvor mange gensere som trengs.

## Utenfor scope
- Ingen endringer i genser-modulen eller DB-skjema.
- Veteraner får også samme visning (samme kode-sti).
