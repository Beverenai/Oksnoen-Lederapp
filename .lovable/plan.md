## Mål

Ledere kan raskt ta bilde og registrere et gjenglemt plagg (med eiers navn, kommentar, plaggtype og farge). Admin oppretter leirperioder, og hver periode får en offentlig lenke (`app.oksnoen.com/gjenglemt/<periode>`) hvor besøkende kan bla og søke etter farge/plaggtype — uten navn eller kommentar.

## Brukerflyt

**Leder (innlogget):**
1. Åpner "Gjenglemt" fra admin-/deltager-siden.
2. Velger aktiv periode (forhåndsvalgt = nyeste).
3. Trykker "Legg til funn" → tar bilde (kamera eller upload) → fyller plaggtype, farge, evt. navn + kommentar → lagrer.
4. Ser liste over egne/alle funn i perioden, kan redigere/slette egne (admin alle), markere som "hentet".

**Admin:**
- Lager nye perioder (navn, start- og sluttdato, auto-generert slug).
- Aktiverer/deaktiverer offentlig lenke per periode.

**Offentlig besøkende (uten innlogging) på `/gjenglemt/<slug>`:**
- Ser galleri med bilde + plaggtype + farge + dato funnet.
- Filtrerer på farge og plaggtype, søker fritekst i plaggtype.
- Knapp "Kontakt leiren" (mailto/telefon fra app-config) for å hente.

## Datamodell

Tre nye tabeller i Lovable Cloud:

- **`gjenglemt_periods`** — `name`, `slug` (unik), `start_date`, `end_date`, `is_public` (bool).
- **`gjenglemt_items`** — `period_id`, `image_url`, `garment_type` (enum), `color` (enum), `owner_name` (nullable, privat), `comment` (nullable, privat), `status` ('uavhentet' | 'hentet'), `created_by` (leader id).
- **Storage-bucket `gjenglemt-images`** (offentlig lesning, kun innloggede ledere kan laste opp).

**Plaggtyper (enum, norske):** genser, t-skjorte, bukse, shorts, sokk, undertøy, jakke, lue, hansker, sko, badetøy, håndkle, drikkeflaske, briller, smykke, elektronikk, annet.

**Farger (enum):** svart, hvit, grå, rød, rosa, oransje, gul, grønn, blå, lilla, brun, beige, flerfarget.

## Sikkerhet (RLS)

- `gjenglemt_periods`: SELECT for `anon` kun der `is_public = true`; INSERT/UPDATE/DELETE kun admin.
- `gjenglemt_items`: 
  - `anon` SELECT på offentlige felt (bilde, plagg, farge, status, periode) via dedikert view `public.gjenglemt_public` — slik at navn/kommentar aldri lekker via PostgREST.
  - `authenticated` (alle ledere): SELECT alt, INSERT egne, UPDATE/DELETE egne; admin UPDATE/DELETE alle.
- Storage: public read på `gjenglemt-images/*`; write kun for authenticated.

## UI

**Admin-side `/admin/gjenglemt`:**
- Toppknapper: "Ny periode", periode-velger.
- Liste over funn i valgt periode med thumbnail, plagg, farge, eier (intern), status. Filtre: farge, plaggtype, status. Sletteknapp og "marker hentet".
- "Kopier offentlig lenke"-knapp per periode.

**Registreringssheet (mobilvennlig, glassmorphism slik resten av appen):**
- Stort bildefelt øverst (Capacitor Camera på native, file input på web — bruker eksisterende `capacitorCamera.ts`).
- Plaggtype-velger (chip-grid med ikoner).
- Fargevelger (swatch-grid med fargesirkler).
- Valgfritt: navn (tekst), kommentar (textarea).
- Lagre-knapp.

**Offentlig side `/gjenglemt/:slug`:**
- Header med periodenavn + datoer.
- Filterbar: fargesvatcher + plaggchips + statusfilter.
- Responsivt bilde-galleri (kort: bilde, plagg, farge-dot, dato). Klikk → lightbox.
- Tom-state og 404 hvis periode ikke finnes / ikke `is_public`.

## Tekniske detaljer

- Ruter i `src/App.tsx`: `/admin/gjenglemt` (admin) og `/gjenglemt/:slug` (public, uten AppLayout/auth-guard).
- Nye komponenter under `src/components/admin/gjenglemt/` (PeriodManager, ItemSheet, ItemGrid, Filters) og side `src/pages/admin/Gjenglemt.tsx` + `src/pages/PublicGjenglemt.tsx`.
- Hook `src/hooks/useGjenglemt.ts` med React Query: `usePeriods`, `useItems(periodId, filters)`, `useCreateItem`, `useUpdateItem`, `useDeleteItem`, `usePublicItems(slug)` (kaller view).
- Bilde-opplasting: komprimer med eksisterende `imageUtils.ts` før upload til `gjenglemt-images/<period-slug>/<uuid>.jpg`.
- Inngang fra eksisterende admin-dashboard (legges til som nytt kort på `/admin`).
- Offentlig SEO: `<title>` "Gjenglemt – <periode> | Øksnøen", meta description, canonical, ingen indeksering hvis `is_public=false`.

## Det vi IKKE bygger nå

- Ingen melding/booking til eier fra offentlig side (kun "Kontakt leiren"-mailto).
- Ingen automatisk varsling til foreldre.
- Ingen QR-kode-generator (lenken kan deles manuelt; kan legges til senere).
