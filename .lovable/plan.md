
## Fix phone login without undoing security

### What I found
- The backend login itself is likely succeeding: auth logs show a successful token/login event.
- `phone-login` already checks `is_active`, creates/maps the auth user, and returns session tokens.
- The real breakage is the app now has a mismatch between:
  1. the tightened RLS rules, and  
  2. client code that still reads protected tables directly after login.
- `AuthContext` is mostly on the right path (`leaders` + `get_my_roles()`), but several screens still query `user_roles` directly, and sensitive edge functions still need proper authenticated caller validation.

### Implementation plan

#### 1. Restore the login flow first
Keep the current UX exactly as-is: enter phone number only.

- Keep `phone-login` public
- Keep the `is_active` check before issuing a session
- Harden the response handling in `AuthContext.tsx` so login never gets stuck on a spinner:
  - fail clearly if session tokens are missing
  - surface real auth/profile loading errors
  - keep timeout + retry UI
  - make post-login bootstrap deterministic

Files:
- `supabase/functions/phone-login/index.ts`
- `src/contexts/AuthContext.tsx`
- `src/App.tsx`

#### 2. Make RLS match how the app actually works
I will not revert to insecure `USING (true)` policies.

I will align policies to the live app behavior:

- `leaders`
  - SELECT: authenticated users
  - UPDATE: own row or admin
  - INSERT/DELETE + active toggle management: admin only
- `user_roles`
  - direct SELECT: own row or admin only
  - no client INSERT/UPDATE/DELETE
- `participants`, `cabins`, `activities`, `session_activities`, `participant_activities`, `cabin_reports`
  - SELECT: authenticated users
  - writes: keep app-compatible restrictions
- health tables
  - read/write: nurse or admin only
- `push_subscriptions`
  - own rows only
- `leader_cabins`
  - SELECT: authenticated users
  - writes: admin only

Database work:
- add any missing `WITH CHECK` clauses so updates are secure as well as readable
- keep all policies scoped to `authenticated`

Files:
- new database migration in `supabase/migrations/...`

#### 3. Stop reading `user_roles` directly from the client where RLS should block it
This is the main architectural mismatch.

Right now these areas still query `user_roles` directly:
- `src/pages/Leaders.tsx`
- `src/pages/admin/Admin.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/components/admin/LeaderListView.tsx`
- `src/components/admin/LeaderDashboard.tsx`
- `src/components/admin/CabinAssignmentStatus.tsx`

Plan:
- keep `get_my_roles()` for auth bootstrap
- add a new minimal `SECURITY DEFINER` RPC for role metadata needed by the UI
- switch those pages/components to the RPC instead of raw `user_roles` queries

This preserves security while keeping the leaders directory/admin UI working.

#### 4. Secure the edge functions properly
The earlier change focused on config, but the real safe fix is authenticated caller validation inside the functions.

Plan:
- `phone-login`: remains public
- `manage-roles`: require authenticated caller + admin role
- `sync-leaders-export`
- `sync-leaders-import`
- `trigger-sync`
- `generate-pass`
- `push-admin-alert`

For each sensitive function:
- require `Authorization: Bearer ...`
- verify the token with claims lookup
- enforce role checks where needed
- only then use service-role operations internally

I’ll also align `supabase/config.toml` so only `phone-login` is intentionally public.

Files:
- `supabase/functions/*/index.ts`
- `supabase/config.toml`

#### 5. Lock down storage without breaking uploads
- Make `participant-images` private
- Update image access flow to use authenticated access / signed access instead of public URLs
- Verify participant photos still work in the relevant screens

Optional follow-up: review `fix-images` too, since it is also public today.

#### 6. Regression pass by role
After the fixes, I will verify these exact flows:

```text
Leader:
- log in with phone number
- reach home page
- see leaders list
- use passport/general participant flows
- cannot access admin or health data

Nurse:
- log in
- access health data
- no admin-only actions unless also admin

Admin:
- log in
- activate/deactivate leaders
- assign cabins
- load admin settings
- import/sync leaders
- send admin push notifications
```

### Expected result
- Phone-number login works again
- Security stays tight
- No anonymous access
- `user_roles` is no longer exposed directly to normal clients
- Admin and nurse behavior still works
- The app stops breaking immediately after login because post-login data loading is brought back in line with RLS

### Technical notes
- `user_roles` uses `leader_id`, not `user_id`, so RPCs/policies must follow that schema.
- The auth logs indicate the login token flow already works server-side; the remaining issue is app-side authorization/data loading after session creation.
- I will preserve the current “phone number only” login model, not switch this to email/password or SMS OTP.
