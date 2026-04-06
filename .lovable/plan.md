

## Nurse-side: To tabs med rapport-editor og @-mention

### Oversikt

Nurse-siden får to hovedtabs:
1. **Alle deltakere** — eksisterende deltakerliste (uendret funksjonalitet)
2. **Rapport** — en Google Docs-lignende editor der nurse skriver daglig rapport, kan @-nevne deltakere, og eksportere som PDF

Når nurse skriver `@` i editoren dukker en autocompletelist med deltakere opp. Ved valg settes fullt navn som en markert lenke/tag. Alt som skrives om en deltager mellom @-mentions lagres også på deltagerens helsenotater (synlig for nurse/admin). Rapporten kan eksporteres som PDF med en egen seksjon per nevnt deltaker.

### Teknisk plan

**1. Ny tabell: `nurse_reports`**

```sql
CREATE TABLE public.nurse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.nurse_reports ENABLE ROW LEVEL SECURITY;

-- Kun nurse/admin kan lese og skrive
CREATE POLICY "nurse_reports_select" ON public.nurse_reports
  FOR SELECT TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_insert" ON public.nurse_reports
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_update" ON public.nurse_reports
  FOR UPDATE TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_delete" ON public.nurse_reports
  FOR DELETE TO authenticated USING (is_admin() OR is_nurse());
```

**2. Ny tabell: `nurse_report_mentions`**

Kobler mention-tekst fra rapport til deltaker, slik at vi kan vise per-deltaker info og eksportere per deltaker.

```sql
CREATE TABLE public.nurse_report_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.nurse_reports(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  mention_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.nurse_report_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentions_select" ON public.nurse_report_mentions
  FOR SELECT TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "mentions_insert" ON public.nurse_report_mentions
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_nurse());
CREATE POLICY "mentions_update" ON public.nurse_report_mentions
  FOR UPDATE TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "mentions_delete" ON public.nurse_report_mentions
  FOR DELETE TO authenticated USING (is_admin() OR is_nurse());
```

**3. `src/pages/Nurse.tsx` — omstrukturering**

Wrap hele innholdet i to top-level tabs:

```text
<Tabs defaultValue="participants">
  <TabsList>
    <TabsTrigger value="participants">Alle deltakere</TabsTrigger>
    <TabsTrigger value="report">Rapport</TabsTrigger>
  </TabsList>
  <TabsContent value="participants">
    ... eksisterende deltakerliste, search, cards, detail dialog ...
  </TabsContent>
  <TabsContent value="report">
    <NurseReportEditor participants={participants} />
  </TabsContent>
</Tabs>
```

**4. `src/components/nurse/NurseReportEditor.tsx` — ny komponent**

- Stort `<textarea>` (eller contentEditable div) med @-mention autocomplete
- Når bruker skriver `@`, fang opp tekst etter @ og vis filtrert deltakerliste i en absolutt-posisjonert popup
- Ved klikk på deltaker: sett inn `@Fornavn Etternavn` som markert tekst
- Autolagring til `nurse_reports`-tabellen (debounced, f.eks. 2 sek)
- Knapp for å lagre (manuell)
- Knapp for å eksportere rapport som PDF

**@-mention mekanikk (uten tunge avhengigheter):**
- Bruk en `contentEditable` div
- Lytt på `onInput`, finn siste `@`-posisjon
- Vis popup med filtrerte deltakere
- Ved valg: sett inn en `<span class="mention" data-participant-id="xxx">@Navn</span>`
- Parse mentions fra HTML for lagring

**5. Lagring av mention-data på deltaker**

Når rapporten lagres:
- Parse alle `<span class="mention">` fra innholdet
- For hver unik deltaker: finn teksten som følger etter mention-taggen (frem til neste mention eller slutt)
- Upsert i `nurse_report_mentions` med `report_id`, `participant_id`, og `mention_text`
- I tillegg legges teksten til i `participant_health_notes` for deltakeren (synlig for nurse/admin via eksisterende RLS)

**6. PDF-eksport**

- Parse rapporten og grupper per nevnt deltaker
- Generer HTML med en seksjon per deltaker (navn, hytte, alder + all tekst som nevner dem)
- Åpne i nytt vindu med `window.print()` for PDF (samme mønster som eksisterende eksport)

### Filer som endres

| Fil | Endring |
|-----|---------|
| `src/pages/Nurse.tsx` | Wrap i 2 top-level tabs, flytt deltakerliste inn i tab 1 |
| `src/components/nurse/NurseReportEditor.tsx` | Ny: rapport-editor med @-mention, autolagring, PDF-eksport |
| Migration | Nye tabeller `nurse_reports` og `nurse_report_mentions` med RLS |

### Hva som IKKE endres

- Eksisterende deltakerkort, detail-dialog, helsenotater, hendelseslogg
- Eksisterende RLS-policyer
- Auth/roller
- Eksisterende eksportfunksjonalitet (HTML/CSV)

