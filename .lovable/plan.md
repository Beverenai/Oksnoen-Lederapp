

## Security Overhaul: RLS + Auth + Edge Functions

### Core Problem

The app has **no Supabase Auth integration**. Authentication is purely localStorage-based: the `phone-login` edge function looks up a leader by phone and returns their ID, which the client stores in `localStorage`. All Supabase client queries use the anon key with no auth session. Combined with `USING (true)` RLS policies, **anyone with the anon key can read, write, and delete all data** — including children's health records.

### Architecture Change Required

To make RLS work, we need `auth.uid()` — which requires actual Supabase Auth sessions. The plan:

1. **`phone-login` creates real Supabase Auth users** — on first login, create an auth user (email: `{leader_id}@internal.app`, auto-generated password). On subsequent logins, sign them in. Store the mapping in a new `auth_user_id` column on `leaders`.
2. **Client uses Supabase Auth sessions** — after login, call `supabase.auth.setSession()` with the tokens returned by `phone-login`. All subsequent queries are authenticated.
3. **RLS policies use `auth.uid()`** — link to `leaders.auth_user_id` to determine who the current leader is.

### Changes

#### 1. Database migration

```sql
-- Add auth_user_id to leaders
ALTER TABLE public.leaders ADD COLUMN auth_user_id uuid UNIQUE;

-- Create a helper function to get the current leader_id from auth.uid()
CREATE OR REPLACE FUNCTION public.current_leader_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.leaders WHERE auth_user_id = auth.uid()
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(public.current_leader_id(), 'admin')
$$;

-- Helper: check if current user is nurse
CREATE OR REPLACE FUNCTION public.is_nurse()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(public.current_leader_id(), 'nurse')
$$;
```

#### 2. RLS policies (drop all `USING (true)`, replace with proper policies)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `leaders` | Any authenticated user | Admin only | Own row OR admin | Admin only |
| `participants` | Authenticated leaders | Admin only | Leaders with cabin assignment OR admin | Admin only |
| `participant_health_info` | Admin, nurse, or assigned cabin leader | Admin or nurse | Admin or nurse | Admin or nurse |
| `participant_health_events` | Admin, nurse, or assigned cabin leader | Admin or nurse | Admin or nurse | Admin or nurse |
| `participant_health_notes` | Admin, nurse, or assigned cabin leader | Admin or nurse | Admin or nurse | Admin or nurse |
| `user_roles` | Authenticated (read own) OR admin (read all) | **No client access** — server only | **No client access** | **No client access** |
| `leader_content` | Authenticated | Authenticated (own) | Own row OR admin | Admin only |
| `leader_cabins` | Authenticated | Admin only | Admin only | Admin only |
| `cabins` | Authenticated | Admin only | Admin only | Admin only |
| `activities` | Authenticated | Admin only | Admin only | Admin only |
| `participant_activities` | Authenticated | Authenticated | Authenticated | Authenticated |
| `fix_tasks` | Authenticated | Authenticated | Authenticated | Admin only |
| `announcements` | Authenticated | Admin only | Admin only | Admin only |
| `app_config` | Authenticated | Admin only | Admin only | Admin only |
| `stories` | Authenticated | Admin only | Admin only | Admin only |
| `rope_controls` | Authenticated | Authenticated | Authenticated | Admin only |
| `cabin_reports` | Authenticated | Authenticated | Authenticated | Admin only |
| `push_subscriptions` | Own rows | Authenticated (own) | Own rows | Own rows |
| `home_screen_config` | Authenticated | Admin only | Admin only | Admin only |
| `room_capacity`, `room_swaps`, `session_activities`, `extra_fields_config` | Authenticated | Admin only | Admin only | Admin only |

"Assigned cabin leader" = leader whose `leader_cabins` entry matches the participant's `cabin_id`.

#### 3. `phone-login` edge function

Update to:
1. Look up leader by phone (existing logic)
2. Check if `auth_user_id` exists on the leader
3. If not: call `supabase.auth.admin.createUser()` with a generated email/password, store the `auth_user_id` on the leader
4. Sign in with `supabase.auth.admin.generateLink({ type: 'magiclink' })` or use `signInWithPassword` with a deterministic password derived from a server secret + leader_id
5. Return the session tokens (`access_token`, `refresh_token`) alongside leader data
6. Enable auto-confirm for these programmatic signups (via `cloud--configure_auth`)

#### 4. `AuthContext.tsx`

- After `phone-login` returns, call `supabase.auth.setSession({ access_token, refresh_token })`
- On app load, check `supabase.auth.getSession()` instead of `localStorage.leaderId`
- Subscribe to `onAuthStateChange` for session refresh
- On logout, call `supabase.auth.signOut()`
- Keep `leader` state, but derive it from the auth session

#### 5. `user_roles` — server-only writes

- Remove client-side `INSERT`/`UPDATE`/`DELETE` on `user_roles`
- Create a new edge function `manage-roles` that admins call to assign/remove roles
- The function verifies the caller is an admin before making changes

#### 6. Admin pages that write `user_roles`

- `AdminSettings.tsx` currently does `supabase.from('user_roles').insert(...)` — replace with `supabase.functions.invoke('manage-roles', ...)`

#### 7. Edge functions — JWT verification

Update `supabase/config.toml`:
- **Keep `verify_jwt = false`**: `phone-login` only (public endpoint)
- **Remove `verify_jwt = false`** from all other functions (they'll default to verifying JWT)
- Each protected function validates the caller using `getClaims()` or checks the auth header

#### 8. Storage — `participant-images` bucket

Make the bucket private (require auth). Update the app to use signed URLs or authenticated access for images.

### Files changed

| File | Change |
|------|--------|
| Migration SQL | Add `auth_user_id` column, helper functions, replace ALL RLS policies |
| `supabase/config.toml` | Remove `verify_jwt = false` from all except `phone-login` |
| `supabase/functions/phone-login/index.ts` | Create auth user + return session tokens |
| `supabase/functions/manage-roles/index.ts` | New function for admin role management |
| `src/contexts/AuthContext.tsx` | Use Supabase Auth sessions |
| `src/pages/admin/AdminSettings.tsx` | Use `manage-roles` edge function instead of direct `user_roles` writes |
| All edge functions | Add `getClaims()` validation where missing |
| Storage bucket config | Make `participant-images` private via migration |

### Risk & Sequencing

This is a **breaking change** — all existing logged-in users will need to re-login after deployment. The migration must:
1. Deploy the database migration first (add column, create functions, update RLS)
2. Deploy the updated `phone-login` edge function
3. Deploy the updated client code
4. All other edge functions must be deployed with JWT validation

Existing `localStorage.leaderId` sessions will stop working — users simply log in again via phone and get a real auth session.

### What this does NOT change

- The phone-number-based login UX stays the same (enter phone → logged in)
- No email/password signup forms needed
- The leader experience is unchanged — just more secure behind the scenes

