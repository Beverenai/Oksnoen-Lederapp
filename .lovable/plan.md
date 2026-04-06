

## Fix RLS + AuthContext to Work Together

### Analysis

The current RLS policies mostly work because all helper functions (`is_admin()`, `is_nurse()`, `current_leader_id()`, `has_role()`) are `SECURITY DEFINER` and bypass RLS. The main issues are:

1. Several SELECT policies use `USING (true)` instead of explicit `auth.role() = 'authenticated'` — allows anon access
2. `user_roles` table uses `leader_id` (not `user_id`), so the RPC function needs to match this schema
3. AuthContext has no timeout — hangs forever if session refresh fails
4. No error state shown to users when auth fails

### Changes

#### 1. Database migration — tighten all policies

Replace every `USING (true)` with `USING (auth.role() = 'authenticated')` on SELECT policies across all tables. Also create a `get_my_roles()` RPC function.

Tables affected (SELECT policy update only — write policies are already correct):
- `leaders`, `participants`, `cabins`, `activities`, `session_activities`, `participant_activities`, `cabin_reports`, `announcements`, `home_screen_config`, `app_config`, `fix_tasks`, `rope_controls`, `leader_content`, `stories`, `leader_cabins`, `room_swaps`, `extra_fields_config`, `room_capacity`

New RPC function:
```sql
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role FROM public.user_roles ur
  WHERE ur.leader_id = public.current_leader_id()
$$;
```

This bypasses RLS entirely, so role checks always work regardless of `user_roles` policies.

#### 2. `src/contexts/AuthContext.tsx` — timeout + error handling + use RPC

- Add 8-second timeout to `initAuth` — if it exceeds, force `isLoading = false` and set an `authError` state
- Add `authError` state exposed via context so the UI can show a retry button
- Replace direct `user_roles` query with `supabase.rpc('get_my_roles')` call
- Add console breadcrumbs for debugging

#### 3. No changes needed

- `phone-login` edge function — already correct, uses service_role key
- Write policies on most tables — already correctly restricted
- Health table policies — already restricted to admin/nurse only

### Files changed

| File | Change |
|------|--------|
| Database migration | Update ~18 SELECT policies from `true` to `auth.role() = 'authenticated'`; create `get_my_roles()` RPC |
| `src/contexts/AuthContext.tsx` | Add timeout, error state, use `get_my_roles()` RPC, add debug logging |

