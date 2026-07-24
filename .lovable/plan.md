Flytt "App-modus"-kortet (Aktiv/Inaktiv-toggle) fra hovedsiden i Innstillinger inn i "Periode"-seksjonen.

## Endringer

**`src/pages/admin/AdminSettings.tsx`**
- Fjern App-modus-kortet som vises på hovedskjermen for superadmin.
- Fjern nå ubrukte imports (`Power`, `useAppMode`, `setAppMode`) og `changingMode`-state + `toggleAppMode`-funksjonen herfra.

**`src/components/admin/NursePeriodsTab.tsx`**
- Legg til et nytt kort øverst (kun synlig for superadmin) med App-modus-toggle: viser nåværende status (Aktiv/Inaktiv), forklaring, og en knapp som bytter modus med samme bekreftelsesdialog som før.
- Bruk `useAppMode`/`setAppMode` og `useAuth().isSuperAdmin` her.
- Behold eksisterende periode-velger uendret.

Ingen databaseendringer. Ren UI-flytting.
