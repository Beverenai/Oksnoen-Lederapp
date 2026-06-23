## Dynga — Kanban-tavle for deltageroppførsel

En admin-only Kanban-tavle der du kan dra deltagerkort mellom tilpassbare kolonner og føre en datert kommentartråd per deltager. Helt separat fra resten av appen — ingenting lekker til pass, sykepleier eller Viktig Info.

### Database (ny migrering)

Tre nye tabeller, alle med RLS som kun tillater admin/superadmin (`public.is_admin()`):

- **`dynga_columns`** — `id`, `title`, `color` (hex/token), `sort_order`, `created_at`
- **`dynga_cards`** — `id`, `participant_id` (FK → participants, unique), `column_id` (FK → dynga_columns), `sort_order`, `created_at`, `updated_at`
- **`dynga_comments`** — `id`, `card_id` (FK → dynga_cards, on delete cascade), `leader_id` (FK → leaders), `body` (text), `created_at`

GRANT til `authenticated` og `service_role`. Policies: alle fire (SELECT/INSERT/UPDATE/DELETE) krever `public.is_admin()`. Standard 4 kolonner seedes: "Observasjon", "Positivt", "Advarsel", "Oppfølging" — admin kan endre/slette/legge til.

### Ny side: `/admin/dynga`

Rute lagt til i `App.tsx` bak admin-guard. Lenke i Admin-dashboardet (kabana-grid-stil som resten av admin-innstillinger).

Layout:

```text
┌─────────────────────────────────────────────────────────┐
│  Dynga                       [+ Legg til deltager] [⚙]  │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│Observasj.│ Positivt │ Advarsel │Oppfølging│ + Ny kolonne│
│ ┌──────┐ │ ┌──────┐ │          │          │             │
│ │ 👤   │ │ │ 👤   │ │          │          │             │
│ │ Navn │ │ │ Navn │ │          │          │             │
│ │ 💬 3 │ │ │ 💬 1 │ │          │          │             │
│ └──────┘ │ └──────┘ │          │          │             │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

- Horisontal scroll på mobil, kolonner ca. 280px brede.
- Deltagerkort viser `image_url` (Avatar med fallback til initialer), fullt navn, hytte (liten muted tekst), kommentar-teller med ikon.
- Drag-and-drop mellom kolonner og innen kolonne — bruker `@dnd-kit/core` + `@dnd-kit/sortable` (allerede vanlig i shadcn-stacker; installeres hvis ikke til stede).
- "+ Legg til deltager"-knapp åpner sheet med søkbar liste over alle deltagere som ikke allerede er på tavla → velg én eller flere, legges i første kolonne.
- Tannhjul ⚙ åpner kolonnehåndtering: rediger tittel/farge, slett (med bekreftelse — kort flyttes til første gjenværende kolonne), legg til ny, drag for å endre rekkefølge.

### Kortdetaljer — sheet

Trykk på kort → høyre-sheet (Sheet-komponent) med:

- Avatar + fullt navn + hytte øverst
- Knapp "Fjern fra Dynga" (sletter card + alle kommentarer)
- Kommentartråd: kronologisk liste, hver kommentar viser leder-navn, relativ tid (`date-fns formatDistanceToNow` med nb), og body. Egne kommentarer kan slettes; admin kan slette alle.
- Tekstfelt nederst + "Legg til kommentar"-knapp. Lagrer med `leader_id = effectiveLeader.id`.

### Datalag

Ny hook `src/hooks/useDynga.ts` med React Query:
- `useDyngaColumns()`, `useDyngaCards()` (joiner participants + cabin + comment-count), `useDyngaComments(cardId)`
- Mutations for move-card, add-card, remove-card, add/edit/delete kolonne, add/delete kommentar — alle invaliderer relevante queries.
- Realtime-kanal på alle tre tabeller (samme mønster som checkout-config) → flere admins ser endringer live.

### Filer som opprettes

- `supabase/migrations/<timestamp>_dynga.sql`
- `src/pages/admin/Dynga.tsx`
- `src/components/admin/dynga/DyngaBoard.tsx` (DnD-kontekst + kolonnegrid)
- `src/components/admin/dynga/DyngaColumn.tsx`
- `src/components/admin/dynga/DyngaCard.tsx`
- `src/components/admin/dynga/DyngaCardSheet.tsx` (detalj + kommentartråd)
- `src/components/admin/dynga/AddParticipantsSheet.tsx`
- `src/components/admin/dynga/ManageColumnsSheet.tsx`
- `src/hooks/useDynga.ts`

### Filer som endres

- `src/App.tsx` — rute `/admin/dynga`
- `src/components/admin/settings/AdminSettingsContent.tsx` (eller tilsvarende admin-grid) — kort som lenker til Dynga
- `package.json` — `@dnd-kit/core`, `@dnd-kit/sortable` hvis ikke allerede installert

### Tekniske detaljer

- Mobile-first: kolonner blir horisontalt scrollbare på smale skjermer; sheets brukes overalt for å unngå modale dialoger.
- Glassmorphism-stil i tråd med resten av admin (semantiske tokens, ingen hardkodede farger).
- Sort-order håndteres med heltall — ved drag oppdateres kun de berørte radene via batch-update.
- Kommentarsletting begrenses til egen kommentar med mindre `is_superadmin()` — håndteres i UI; RLS tillater admin å slette alt.
