

## Admin Innstillinger: Kabana-oversikt som landingsside

### Konsept
Samme mønster som ParticipantStats — erstatt de to radene med tab-knapper med et visuelt kort-grid. "Ledere" og "Deltakere" blir de to øverste og mest prominente kortene. Når man trykker på et kort, vises innholdet med tilbake-knapp.

### Navigasjonskortene (2-kolonne grid)

**Rad 1 (prominente, fulle bredde eller store):**
- **Ledere** (Users, blå) — "Administrer ledere og roller"
- **Deltakere** (Users, grønn) — "Importer og håndter deltakere"

**Rad 2+ (2-kolonne grid):**
- **Hytter** (Home, amber) — "Administrer hytter"
- **Vaktplan** (Calendar, purple) — "Sett opp vaktplan"
- **Aktiviteter** (Dumbbell, pink) — "Administrer aktiviteter"
- **Skjær** (MapIcon, teal) — "Skjæraktiviteter"
- **Historier** (BookOpen, orange) — "Administrer historier"
- **Push-varsler** (Bell, yellow) — "Send push-varsler"
- **Tau-kontroll** (Anchor, red) — "Tau-kontroll oppsett"
- **Synkronisering** (RefreshCw, cyan) — "Import/eksport fra Google Sheets"
- **Oppsett** (Settings, gray) — "Webhook-konfigurasjon"

### Navigasjon
- Bruk `activeSection` state (allerede finnes) — `null`/`''` = vis grid, ellers vis innhold
- Tilbake-knapp øverst som setter `activeSection` tilbake til `''`

### Teknisk

**Endringer i `src/pages/admin/AdminSettings.tsx`:**
- Erstatt `Tabs`/`TabsList`/`TabsTrigger` med et kort-grid (som i ParticipantStats)
- Legg til en "landing"-tilstand der `activeSection === ''` viser kortene
- Når `activeSection` har verdi, vis `AdminSettingsContent` med tilbake-knapp
- Ledere og Deltakere-kortene blir vist som fulle-bredde kort øverst

**Ingen endringer i `AdminSettingsContent`** — den fungerer allerede med `activeSection` switch.

### Filer som endres
- `src/pages/admin/AdminSettings.tsx` — eneste fil

### Resultat
- Landingssiden viser fargerike navigasjonskort i stedet for tab-rader
- Ledere og Deltakere er prominente øverst
- Trykk for å komme inn, tilbake-knapp for å gå ut
- Konsistent med ParticipantStats-designet

