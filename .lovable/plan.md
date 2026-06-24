## Endringer fra forrige iterasjon

### 1. Flytt periode-administrasjon inn i Admin → Innstillinger
- Slett toppknappen **«Gjenglemt»** på `/admin`.
- Slett ruten `/admin/gjenglemt` og siden `src/pages/admin/Gjenglemt.tsx`.
- Legg til nytt kort **«Gjenglemt»** i `src/pages/admin/AdminSettings.tsx` (`navItems`-listen, ikon `Shirt`) som åpner en ny tab i `AdminSettingsContent.tsx`.
- Den nye taben er en enkel komponent `GjenglemtSettingsTab` som kun viser periode-administrasjon (gjenbruker `PeriodManageSheet`-logikken som inline-skjema): liste over perioder, opprett ny periode (kun navn-felt + datoer), toggle offentlig, kopier lenke, åpne offentlig side, slett.

### 2. Ledere får «Gjenglemt» i appen
- Ny rute `/gjenglemt` (innen `ProtectedRoute`, tilgjengelig for alle innloggede ledere — ikke kun admin) → ny side `src/pages/Gjenglemt.tsx`.
- Siden viser: periodevelger øverst (auto = nyeste aktive), filtre (farge + plagg + status), bilde-galleri (gjenbruker `ItemGrid`), og en stor **«+ Nytt funn»**-knapp.
- Legg til entry i `leaderNavItems` (sidemeny) i `src/components/layout/AppLayout.tsx`: `{ to: '/gjenglemt', icon: Shirt, label: 'Gjenglemt' }`.
- `AddItemSheet` forenkles drastisk for ledere: kun **Bilde** (kamera/album) + **Notater** (fritekst) + **Lagre**. Ingen manuell plagg/farge-velger. Etter lagring kjøres AI-analyse i bakgrunnen.

### 3. AI-analyse av bilder for søk
- Ny tabell-kolonner på `gjenglemt_items`:
  - `notes text` (lederens fritekst-notat — erstatter `owner_name` + `comment` i den enklere flyten; beholder de eksisterende kolonnene som nullbare for bakoverkompatibilitet).
  - `ai_status text default 'pending'` (`pending` | `done` | `failed`).
  - `ai_description text` (kort tekstbeskrivelse fra AI, vises på offentlig side).
  - `ai_tags text[]` (frie søkeord: farger, materiale, mønster, merker hvis synlig).
- `garment_type` og `color` gjøres nullbare og fylles av AI (kan fortsatt overstyres manuelt fra admin-grid).
- Migrer den offentlige visningen `gjenglemt_public` til å inkludere `notes` (lederens notater er nyttige for å finne igjen — bekreft med bruker hvis dette skal være privat; jeg gjør det offentlig fordi det erstatter manuell beskrivelse).
- Ny edge-funksjon `analyze-gjenglemt`:
  - Input: `{ item_id, image_path }`.
  - Henter signert URL for bildet, sender til Lovable AI Gateway (`google/gemini-2.5-flash`) med structured output (Zod-skjema):
    ```ts
    { garment_type: enum(GARMENT_TYPES), color: enum(COLORS), description: string, tags: string[] }
    ```
  - Skriver tilbake til `gjenglemt_items` via service role, setter `ai_status='done'` (eller `'failed'`).
- Klient kaller `supabase.functions.invoke('analyze-gjenglemt', ...)` rett etter `insert`. UI viser «AI analyserer…»-badge på kort med `ai_status='pending'`.

### 4. Søk
- Offentlig + intern søkebar (`Input`) som gjør case-insensitiv match mot `garment_type`, `color`, `notes`, `ai_description` og `ai_tags`. På klient-siden (lokal filtrering på allerede-hentede rader) — enkelt nok for forventede volumer.
- Eksisterende farge/plagg-filtre beholdes.

## Tekniske detaljer

- Migrasjoner kjøres i én tur, deretter regenereres types før edge function og UI bruker de nye feltene.
- Edge function bruker `verify_jwt=false` (default) men leser ikke fra request-bruker — den krever bare `item_id` + verifiserer at item finnes.
- Bilder forblir i privat bøtte; edge function bruker service role for å lese signert URL.
- Ingen endring i offentlig rute `/gjenglemt/:slug`.

## Det vi IKKE gjør

- Ingen embeddings/vector-søk — fritekstmatch er nok.
- Ingen sletter av `owner_name`/`comment` (kolonnene står tomme i ny flyt).
- Ingen retry-kø for feilet AI — admin kan trykke «Analyser på nytt» fra grid.
