## Fjern n8n-synkronisering (behold kun Lim inn)

Synk-knapper, edge-funksjoner og webhook-konfigurasjon fjernes helt. Lim inn-funksjonen tar over som eneste import-vei. Offline-køen (`useBackgroundSync`) er separat og blir værende.

### 1. `src/pages/admin/Admin.tsx`
- Fjerne `triggerSync`, `loadDirtyCount`, `loadLastSyncTime`, `loadExportWebhookUrl`, `formatSyncTime`.
- Fjerne all sync-state: `isSyncing`, `lastSyncSuccess`, `lastSyncTime`, `storedExportWebhookUrl`, `dirtyCount`.
- Fjerne hele "Synk med Sheet"-knappen og tidsstempel-visningen i headeren.
- Fjerne ubrukte imports (`RefreshCw`, `Check` hvis ikke brukt andre steder).

### 2. `src/pages/admin/AdminSettings.tsx`
- Fjerne nav-kortene `sync` og `setup` fra `navItems` + tilhørende `sectionLabels`-oppføringer.
- Fjerne all sync/eksport/webhook-state og -funksjoner: `triggerSync`, `triggerExport`, `cancelPendingExport`, `syncLeaderCabins`, `loadWebhookUrl`, `loadExportWebhookUrl`, `loadLastSyncTime`, `loadLastExportTime`, `saveWebhookUrl`, `saveExportWebhookUrl`, alle relaterte useState/useRef-er.
- Fjerne tilhørende props som sendes til `<AdminSettingsContent>`.
- Beholde leder-CRUD, deaktiver/aktiver-funksjoner uendret.

### 3. `src/components/admin/settings/AdminSettingsContent.tsx`
- Fjerne `case 'sync'` og `case 'setup'`-blokker.
- Fjerne tilhørende props fra `AdminSettingsContentProps` (sync, export, setup, webhook, syncError, formatSyncTime, cabinStatusRef, etc.).
- Fjerne ubrukte imports: `SyncErrorDetails`, `RefreshCw`, `Upload`, `FileSpreadsheet`, `CheckCircle2`, `CabinAssignmentStatus`.

### 4. Slett filer
- `src/components/admin/SyncErrorDetails.tsx`
- `supabase/functions/trigger-export/index.ts` (mappen)
- `supabase/functions/trigger-sync/index.ts` (mappen) — hvis den finnes
- `supabase/functions/sync-leaders-import/index.ts` (mappen)

### 5. La være i fred
- `useBackgroundSync` (offline-kø, urelatert)
- `last_synced_at` / `last_app_edit_at` DB-kolonner (brukes fortsatt av Lim inn for å markere når data ble overskrevet)
- `app_config`-rader med gamle webhook URLs blir liggende uten effekt — kan ryddes manuelt i DB hvis ønsket

Ingen DB-migrasjoner nødvendig.
