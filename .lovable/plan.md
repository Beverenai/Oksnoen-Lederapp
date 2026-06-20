## Mål

1. Ledere skal kunne se hva de andre lederne holder på med (aktivitet) på `/ledere`-siden.
2. Listen skal scrolle jevnt – ingen "frys" når man scroller ned og raskt opp igjen.

## Problem 1 — Aktivitet vises ikke for andre

Siden bruker allerede `leader.content?.current_activity`, men RLS på `public.leader_content` er:

```
USING (leader_id = current_leader_id() OR is_admin())
```

Vanlige ledere får derfor bare sin egen rad tilbake → aktivitetslinjen er tom for alle andre. Vi må eksponere aktivitetsfeltene (men ikke private felter som `personal_notes`, `obs_message`, `has_read`, push-tokens osv.) til alle innloggede ledere.

### Løsning (DB)

Lag en kolonne-begrenset visning og bruk den i Ledere-fetch:

```sql
CREATE OR REPLACE VIEW public.leader_activities_public
WITH (security_invoker = true) AS
SELECT leader_id, current_activity, extra_activity, updated_at
FROM public.leader_content;

GRANT SELECT ON public.leader_activities_public TO authenticated;
```

Pluss en ekstra RLS-policy på `leader_content` som tillater `SELECT` for `authenticated` *kun gjennom* viewet — enkleste vei: legge til en ekstra SELECT-policy som tillater alle authenticated, og la viewet velge ut de "trygge" kolonnene. Men da lekker andre kolonner via direkte tabell-spørring. Derfor:

- Behold dagens strenge `leader_content_select`-policy.
- Lag viewet som `SECURITY DEFINER` (ikke `security_invoker`) eid av en rolle som kan lese tabellen, slik at viewet bypasser RLS på de utvalgte kolonnene.

```sql
CREATE OR REPLACE VIEW public.leader_activities_public AS
SELECT leader_id, current_activity, extra_activity, updated_at
FROM public.leader_content;

ALTER VIEW public.leader_activities_public OWNER TO postgres;
GRANT SELECT ON public.leader_activities_public TO authenticated;
```

### Løsning (frontend)

I `src/pages/Leaders.tsx`:
- Bytt `from('leader_content').select('*')` → `from('leader_activities_public').select('leader_id, current_activity, extra_activity')`.
- `LeaderWithContent.content` blir kun de offentlige feltene her (resten brukes ikke på denne siden uansett — `has_read`/`obs_message`/`personal_notes` leses ikke i kortet for andre ledere).
- Type-cast lokalt siden viewet ikke ligger i typegen.

Admin-dashboardet (`useLeaderDashboardData`) er uendret — det fortsetter å bruke `leader_content` direkte (admins har full tilgang via `is_admin()`).

## Problem 2 — Hakkete scroll

Tre årsaker, fjernes alle:

1. **Re-renders på hele listen** ved scroll (ingen memoisering). Pakk lederkortet inn i en egen `LeaderRow`-komponent med `React.memo`.
2. **`animate-pulse` på grønn prikk** for hver synlig leder + **`ring-4 ring-offset-2`** på avatarer = mange composited layers. Vi fjerner ikke effekten, men slår av `animate-pulse` (statisk grønn prikk holder) og setter `will-change: transform` av (default, men sjekk at den ikke er satt).
3. **Layout-trashing ved hurtig scroll** fordi alle ~80 kort render samtidig. Legg på CSS `content-visibility: auto; contain-intrinsic-size: 96px 96px;` på hvert kort så off-screen kort skipper layout/paint.

### Endringer

- Ny `src/components/leaders/LeaderRow.tsx` (memoisert) som rendrer eksisterende markup. Bruker stabile callbacks (`onSelect(leader)`, `onCall(phone)`).
- `Leaders.tsx`: map `filteredAndSortedLeaders` til `<LeaderRow>` med `key={leader.id}`. Separator-logikken beholdes i parent.
- Fjern `animate-pulse` fra grønn aktivitets-prikk.
- Legg til Tailwind-klasser `[content-visibility:auto] [contain-intrinsic-size:96px]` på kort-wrapperen.

## Tekniske detaljer

- Migration oppretter viewet og GRANT.
- `Leaders.tsx`: ett spørringsbytte + render-refaktor. Sortering/filtrering uendret.
- Ingen endringer i admin-flyten, push, eller andre sider.

## Filer som endres

```
supabase/migrations/<ts>_leader_activities_public_view.sql   (ny)
src/pages/Leaders.tsx
src/components/leaders/LeaderRow.tsx                          (ny)
```

## Verifisering

- Logg inn som vanlig leder → se andre lederes `current_activity` på `/ledere`.
- Scroll opp/ned raskt på mobil-preview → ingen merkbar frys.
- Admin-dashboardet viser fortsatt obs/notater/lest-status uendret.
