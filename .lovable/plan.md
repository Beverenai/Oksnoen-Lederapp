

## Fix: Login, Admin Access, and Leader Overview

### What's Actually Happening

Based on the investigation:
- **Login backend works** — edge function logs confirm successful login for your user (August), session tokens are issued
- **Your leader record is correct** — `auth_user_id` is linked, you have the `admin` role in `user_roles`, `profile_image_url` and `age` are set
- **Only 2 of 33 active leaders have been linked** to auth users — the system works but only for leaders who've logged in with the new auth flow

### Root Causes

1. **Incomplete leader object after login** — The `login()` function stores the leader returned by the edge function, but that object only has selected columns (missing `phone`, `created_at`, `updated_at`). This causes TypeScript type mismatches and potential rendering issues on pages that expect the full leader object.

2. **Roles may silently fail on reload** — `loadRolesViaRpc()` catches all errors and returns `[]`, so if `get_my_roles()` fails for any reason (timing, session not ready), `isAdmin` silently becomes `false` and you see "Ingen tilgang" on admin.

3. **No logging to diagnose** — Role loading failures are swallowed with `console.warn` but no actionable feedback.

### Fixes

#### 1. `src/contexts/AuthContext.tsx` — Fix login to load full leader

After `setSession()` succeeds, immediately call `loadLeaderFromSession(session.user.id)` to get the full leader row from the database (with `SELECT *`) instead of using the partial object from the edge function. This also re-runs `loadRolesViaRpc()` which ensures roles are loaded with an active session.

```
login() flow:
  1. Call phone-login edge function → get session tokens
  2. Call setSession() → establish Supabase auth
  3. Call loadLeaderFromSession() → get FULL leader + roles from DB
  4. Return success
```

Remove the current pattern of `setLeader(data.leader)` and `setIsAdmin(data.roles.includes('admin'))` in `login()` — these use partial/stale data.

#### 2. `src/contexts/AuthContext.tsx` — Add retry logic for role loading

If `loadRolesViaRpc()` returns empty but `loadLeaderFromSession` found a leader, add a small delay and retry once. This handles the race condition where the session may not be fully propagated yet.

#### 3. `supabase/functions/phone-login/index.ts` — Return full leader object

Change the SELECT query to `SELECT *` so the edge function returns all leader fields. Remove the manual column list. Still strip `auth_user_id` before sending to client.

### What stays the same
- The phone-number login UX is unchanged
- RLS policies remain secure (`authenticated` required everywhere)
- The `get_my_roles()` and `current_leader_id()` SECURITY DEFINER functions are correct
- Edge function still checks `is_active` before allowing login

### Files changed

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Fix `login()` to load full leader from DB after `setSession()`; add role-loading retry |
| `supabase/functions/phone-login/index.ts` | Select all leader columns; simplify response |

