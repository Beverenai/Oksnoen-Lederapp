

## Plan: Utsjekk-toggle i Admin + "Se som bruker"-modus

### Oppgave 4: Utsjekk-knapp styres av admin

**Status:** Mesteparten er allerede implementert. `CheckoutTab` har toggle, `Passport.tsx` leser `checkoutEnabled` via `useQuery` og skjuler checkout-knappen. Det som mangler:

**Endringer:**

| Fil | Endring |
|-----|--------|
| `src/pages/Passport.tsx` | Legg til `refetchInterval: 30000` på `checkout-enabled` query for raskere oppdatering. Legg til Supabase Realtime subscription på `app_config` for umiddelbar oppdatering. |
| `src/pages/admin/Admin.tsx` | Legg til en enkel utsjekk-status badge/toggle i header-området (henter `checkout_enabled` fra `app_config`). Toggle oppdaterer `app_config`. Gir admin rask oversikt uten å navigere til checkout-siden. |

Realtime-subscription i Passport.tsx lytter på `app_config`-tabellen og invaliderer `checkout-enabled` query ved endring.

---

### Oppgave 5: Admin "Se som bruker"

**Arkitektur:** Ren client-side visningsoverstyrning. Ingen sesjonsbytte. Admin sin Supabase-sesjon brukes hele tiden.

**Endringer:**

| Fil | Endring |
|-----|--------|
| `src/contexts/AuthContext.tsx` | Legg til `viewAsLeader: Leader \| null`, `setViewAsLeader`, og `effectiveLeader` (computed: `viewAsLeader ?? leader`). Eksporter alle tre. |
| `src/components/layout/AppLayout.tsx` | Vis banner øverst når `viewAsLeader` er satt: "Du ser appen som [Navn] — Avslutt". Klikk "Avslutt" → `setViewAsLeader(null)` + naviger til `/admin`. |
| `src/components/admin/LeaderDashboard.tsx` | Legg til "Se som"-knapp i `LeaderCard` (kun for admin). Klikk → `setViewAsLeader(leader)` + naviger til `/`. |
| `src/components/admin/LeaderListView.tsx` | Samme "Se som"-knapp i listevisning. |
| `src/pages/Home.tsx` | Erstatt `leader.id` med `effectiveLeader.id` i alle data-spørringer (leader_content, leader_cabins, fix_tasks, rope_controls). |
| `src/pages/MyCabins.tsx` | Bruk `effectiveLeader.id` for leader_cabins-spørring. |
| `src/pages/Passport.tsx` | Bruk `effectiveLeader` for filtrering av "mine hytter". |
| `src/pages/Profile.tsx` | Vis `effectiveLeader` sin profil. Gjør read-only når `viewAsLeader` er satt. |
| `src/pages/Schedule.tsx` | Bruk `effectiveLeader` for vaktfiltrering (hvis relevant). |

**Hva endres IKKE:**
- `isAdmin`/`isSuperAdmin` forblir uendret — admin-panel alltid tilgjengelig
- RLS bruker admin sin sesjon — ingen sikkerhetsrisiko
- Bunnmeny forblir uendret
- Push-varsler påvirkes ikke
- Skriveoperasjoner (oppdatering av data) bruker fortsatt ekte `leader`, ikke `effectiveLeader`

**Banner-design:** Fast posisjonert, gul/oransje bakgrunn, vises over alt innhold med z-index. Inkluderer øye-ikon, ledernavn, og "Avslutt"-knapp.

