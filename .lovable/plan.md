

## Speed, Optimization & Admin Layout Improvements

### Learnings from La Sala Homes' Control Centre

Their admin dashboard uses three smart patterns yours doesn't:

1. **Sidebar navigation with tab switching** — Instead of rendering everything on one scrollable page, they use a persistent sidebar (collapsible on mobile) with grouped nav items. Each section loads independently. Your admin page renders LeaderDashboard + HomeScreenConfig + Activities sheet all at once.

2. **State extracted to a custom hook** (`useControlCentreState`) — All admin state lives in one hook, keeping the page component thin (~160 lines vs your 860 lines).

3. **Searchable sidebar with keyword aliases** — Admins can quickly find any section with `/` keyboard shortcut and fuzzy search.

### Plan

#### 1. Admin layout: Sidebar + tab-based navigation

Restructure `/admin` to use a sidebar/tab pattern instead of one long page:

- Create `useAdminState` hook that extracts all state from `Admin.tsx` (leaders, homeConfig, sync, export)
- Split the admin page into sidebar tabs: **Lederoversikt** (default), **Hjemskjerm-konfig**, **Aktiviteter**, with the existing Settings page as a link
- On mobile: collapsible dropdown (like La Sala's) showing current tab name + chevron
- On desktop: sticky left sidebar (~200px) with grouped nav items
- Each tab renders lazily — only the active tab mounts

This cuts `Admin.tsx` from 860 lines to ~100 lines.

#### 2. Code splitting improvements

Current `manualChunks` is good but can be extended:

- Add `dnd` chunk for `@dnd-kit/*` (only used in admin home config)
- Add `charts` chunk for `recharts` (only used in stats pages)
- Lazy-load `@dnd-kit` imports inside the HomeConfigTab component so it's not pulled into the admin entry chunk
- Move `canvas-confetti` to dynamic import (only used on success events)

#### 3. Duplicate code reduction

- `LeaderDashboard.tsx` (558 lines) and `LeaderListView.tsx` (570 lines) share ~150 lines of identical logic: team styles, team filters, content fetching, role fetching, search/filter state
- Extract shared logic into `useLeaderDashboardData` hook
- Extract shared UI (search bar, team filter chips, stats line) into `LeaderFilters` component

#### 4. React Query consistency

`LeaderDashboard` and `LeaderListView` both do manual `useState` + `useEffect` + `supabase.from().select()` for content and roles, duplicating what React Query already does elsewhere. Replace with:

- `useLeaderContent()` hook using React Query
- `useLeaderRoles()` hook using React Query (calls `get_all_leader_roles` RPC)
- This also enables automatic cache invalidation and deduplication

#### 5. Memoization of heavy renders

The leader grid renders 30+ cards on every keystroke in the search field. Add:

- `React.memo` on the leader card component (extract from inline JSX)
- `useDeferredValue` on the search query to debounce filtering

#### 6. Image optimization

Leader avatars load full-size images. Add `loading="lazy"` to all avatar images not in the initial viewport (grid items beyond the first row).

### Files changed

| File | Change |
|------|--------|
| `src/pages/admin/Admin.tsx` | Rewrite to sidebar + tab layout (~100 lines) |
| `src/hooks/useAdminState.ts` | New — extracted admin state/logic |
| `src/hooks/useLeaderDashboardData.ts` | New — shared leader content + roles + filters |
| `src/components/admin/LeaderFilters.tsx` | New — shared search/filter UI |
| `src/components/admin/LeaderCard.tsx` | New — memoized card component |
| `src/components/admin/AdminSidebar.tsx` | New — sidebar navigation |
| `src/components/admin/HomeConfigTab.tsx` | New — extracted from Admin.tsx, lazy-loads dnd-kit |
| `src/components/admin/LeaderDashboard.tsx` | Simplify using shared hooks |
| `src/components/admin/LeaderListView.tsx` | Simplify using shared hooks |
| `vite.config.ts` | Add `dnd` and `charts` manual chunks |

### What does NOT change

- No functionality changes — all features remain identical
- No visual changes to individual components (cards, sheets, dialogs)
- No RLS/auth/edge function changes
- No new dependencies

### Expected impact

- Admin page initial JS: ~40% smaller (dnd-kit and recharts deferred)
- Admin page render: faster (memoized cards, deferred search)
- Codebase: ~300 fewer lines of duplicated logic
- Developer experience: each admin section is its own focused file

