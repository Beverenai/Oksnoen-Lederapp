

## Fix Login Race Condition

### Root Cause

The login backend works perfectly (verified with direct API calls). The problem is a **race condition** in `AuthContext.tsx`:

1. `login()` calls the edge function → gets leader data + session tokens
2. `login()` calls `supabase.auth.setSession()` → this triggers `onAuthStateChange('SIGNED_IN')`
3. The `onAuthStateChange` callback has a **stale closure** over `leader` (always `null` because dependency array is `[]`), so `!leader` is always true
4. It calls `loadLeaderFromSession()` which queries the database
5. If this query fails or returns null for any reason (timing, network), it calls **`supabase.auth.signOut()`** — which immediately logs the user out
6. Meanwhile `login()` returned `{ success: true }` and called `navigate('/')`, but the leader state was just wiped

Additionally, the first login attempt (visible in network logs at 10:25:41) hit an **old version** of the edge function that returned no `session` field — causing `data.session.access_token` to throw a TypeError.

### Fix

**File: `src/contexts/AuthContext.tsx`**

1. **Use a ref to track if login is in progress** — when `login()` is running, skip the `onAuthStateChange` `SIGNED_IN` handler (since `login()` already sets leader/roles from the API response)
2. **Remove the `signOut()` call in `loadLeaderFromSession`** — if the query fails, just log the error instead of nuking the session. This prevents the destructive race.
3. **Add a null-check for `data.session`** in `login()` — defensive guard against edge function returning without session tokens

Changes:
- Add `loginInProgressRef = useRef(false)` 
- Set it `true` before calling edge function, `false` after setting state
- In `onAuthStateChange`: skip `SIGNED_IN` handling when `loginInProgressRef.current` is true
- In `loadLeaderFromSession`: remove `await supabase.auth.signOut()` on failure, just return
- In `login()`: check `if (!data.session)` and return error before calling `setSession`

### Files changed

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Fix race condition with login ref guard; remove destructive signOut in loadLeaderFromSession; add defensive session check |

No backend or edge function changes needed — the backend is working correctly.

