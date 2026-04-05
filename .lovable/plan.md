

## Codebase Refactor and Cleanup

This is a significant refactoring effort. Here's a pragmatic plan that delivers real value without breaking the app.

### 1. Remove `ComingSoon.tsx`

`ComingSoon` is only referenced within its own file — no imports anywhere. Safe to delete.

| File | Action |
|------|--------|
| `src/pages/ComingSoon.tsx` | Delete |

### 2. Group admin pages under `pages/admin/`

Move admin-specific pages into a subfolder. Update lazy imports in `App.tsx`.

| Current | New |
|---------|-----|
| `src/pages/Admin.tsx` | `src/pages/admin/Admin.tsx` |
| `src/pages/AdminSettings.tsx` | `src/pages/admin/AdminSettings.tsx` |
| `src/pages/ParticipantStats.tsx` | `src/pages/admin/ParticipantStats.tsx` |
| `src/pages/Checkout.tsx` | `src/pages/admin/Checkout.tsx` |

Update `App.tsx` lazy imports to point to `@/pages/admin/...`.

### 3. Extract reusable data hooks

The Supabase queries for leaders, participants, and cabins are repeated across 10+ files with varying select columns. Create hooks using **React Query** (already installed) that cover the most common patterns:

**New file: `src/hooks/useLeaders.ts`**
- `useLeaders()` — fetches all active leaders (used in Leaders, Fix, CheckoutTab, AdminSettings)
- `useAllLeaders()` — fetches all leaders including inactive (used in Admin)

**New file: `src/hooks/useParticipants.ts`**
- `useParticipants(cabinIds?)` — fetches participants with cabin join, optionally filtered by cabin
- `useParticipantCount()` — head-only count query

**New file: `src/hooks/useCabins.ts`**
- `useCabins()` — fetches all cabins ordered by sort_order

Each hook returns `{ data, isLoading, error, refetch }` via `useQuery`. Components that need specialized queries (e.g. checkout with pass_written fields) keep their inline queries — only the repeated common patterns get extracted.

### 4. Add TypeScript interfaces

**New file: `src/types/database.ts`**

Export convenience type aliases derived from the auto-generated Supabase types:

```typescript
import type { Tables } from '@/integrations/supabase/types';

export type Leader = Tables<'leaders'>;
export type Participant = Tables<'participants'>;
export type Cabin = Tables<'cabins'>;
export type Activity = Tables<'activities'>;
// ... etc for all tables
```

Update components to import from `@/types/database` instead of repeating `Tables<'...'>` inline.

### 5. Add `React.memo` to list item components

Wrap these list-item / card components in `React.memo`:

| Component | File |
|-----------|------|
| `VirtualizedParticipantList` item renderer | `src/components/passport/VirtualizedParticipantList.tsx` |
| Leader card in `LeaderListView` | `src/components/admin/LeaderListView.tsx` |
| `StyrkeproveBadges` | `src/components/passport/StyrkeproveBadges.tsx` |
| `ParticipantStatsCard` | `src/components/admin/ParticipantStatsCard.tsx` |

### 6. Remove unused imports and dead code

Scan all changed files for unused imports. Also:
- Remove `Index.tsx` if unused (check routes — not referenced in `App.tsx`)
- Clean up any `console.log` statements left from debugging

### Files changed summary

| Action | File |
|--------|------|
| Delete | `src/pages/ComingSoon.tsx` |
| Delete | `src/pages/Index.tsx` (if unused) |
| Move | 4 admin pages to `src/pages/admin/` |
| Create | `src/types/database.ts` |
| Create | `src/hooks/useLeaders.ts` |
| Create | `src/hooks/useParticipants.ts` |
| Create | `src/hooks/useCabins.ts` |
| Edit | `src/App.tsx` (update imports) |
| Edit | ~8-10 components to use new hooks and type imports |
| Edit | ~4 list components to add `React.memo` |

