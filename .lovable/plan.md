## Mål
Flytt «Lederaktivering» og «Hjemskjerm-elementer» fra Admin-forsiden inn i Innstillinger som egne kort.

## Endringer

### 1. `src/pages/admin/AdminSettings.tsx`
- Legg to nye kort i `navItems`:
  - `activation` — «Lederaktivering», ikon `UserCog`, beskrivelse «Styr hvem som kan logge inn».
  - `home-config` — «Hjemskjerm», ikon `LayoutGrid`, beskrivelse «Tittel, ikon og synlighet».
- Legg tilsvarende `sectionLabels`-oppføringer.
- Last `home_screen_config` her ved behov (state for `homeConfig` + `localHomeConfig`) og hent ledere med roller (allerede tilgjengelig).
- Send nødvendige props videre til `AdminSettingsContent`.

### 2. `src/components/admin/settings/AdminSettingsContent.tsx`
- Utvid props med `isSuperAdmin`, `homeConfig`, `localHomeConfig`, `setLocalHomeConfig`, `setHomeConfig`, `onLeaderUpdated`.
- Nye case-grener:
  - `case 'activation'` → render `<LeaderActivationTab leaders={leaders} onLeaderUpdated={onLeaderUpdated} isSuperAdmin={isSuperAdmin} />`.
  - `case 'home-config'` → lazy-render `HomeConfigTab` med samme props som dagens Admin.tsx bruker.

### 3. `src/pages/admin/Admin.tsx`
- Fjern de to `Collapsible`-blokkene for «Lederaktivering» og «Hjemskjerm-elementer» og tilhørende state (`isHomeConfigOpen`, `isActivationOpen`).
- Behold lasting av `home_screen_config` siden `LeaderDashboard`/`LeaderListView` fortsatt bruker det.
- Fjern nå-ubrukte imports (`Collapsible*`, `HomeConfigSection`, `LeaderActivationTab`, `UserCog`, `Settings` brukt i Hjemskjerm-kortet osv. der relevant).

## Teknisk
- Ingen DB-endringer.
- `HomeConfigTab` lastes fortsatt med `lazy()` for å holde Innstillinger lett.
- Ingen endringer i RLS, edge functions eller andre moduler.
