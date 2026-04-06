

## RLS Policy Adjustments

After comparing the current policies with the requested access model, most policies are already correct. Four tables need updates:

### Changes needed

#### 1. Health tables — remove cabin leader access from SELECT

Currently `participant_health_info`, `participant_health_events`, and `participant_health_notes` allow assigned cabin leaders to SELECT. The request says **only admin and nurse** should have access. Remove the `EXISTS(... leader_cabins ...)` clause from all three SELECT policies.

**Migration SQL:**
```sql
-- Drop and recreate SELECT policies for all 3 health tables
-- New USING: (is_admin() OR is_nurse())
```

#### 2. cabin_reports — restrict writes to assigned leaders or admin

Currently INSERT and UPDATE use `true` (any authenticated user). Change to only allow leaders assigned to that cabin via `leader_cabins`, or admins.

**Migration SQL:**
```sql
-- INSERT WITH CHECK: is_admin() OR EXISTS(SELECT 1 FROM leader_cabins WHERE leader_id = current_leader_id() AND cabin_id = cabin_reports.cabin_id)
-- UPDATE USING: same condition
```

#### 3. fix_tasks — restrict UPDATE to admin only

Currently UPDATE uses `true`. Change to admin only.

**Migration SQL:**
```sql
-- UPDATE USING: is_admin()
```

#### 4. rope_controls — restrict UPDATE to own rows or admin

Currently UPDATE uses `true`. Change so leaders can only update their own controls, admins can update any.

**Migration SQL:**
```sql
-- UPDATE USING: (leader_id = current_leader_id()) OR is_admin()
```

### Already correct (no changes needed)

| Table | Status |
|-------|--------|
| `leaders` | ✅ SELECT all auth, UPDATE own/admin, INSERT/DELETE admin |
| `participants` | ✅ SELECT/UPDATE all auth (needed for passport), INSERT/DELETE admin |
| `user_roles` | ✅ SELECT own/admin, no client writes |
| `push_subscriptions` | ✅ Own rows only |
| `leader_cabins` | ✅ SELECT all auth, write admin only |
| `announcements`, `activities`, `stories`, etc. | ✅ SELECT all auth, write admin only |

### phone-login active check

Already implemented — the edge function checks `leader.is_active === false` and returns an error message.

### Files changed

| File | Change |
|------|--------|
| Database migration | Update 4 policy groups (health tables SELECT, cabin_reports write, fix_tasks UPDATE, rope_controls UPDATE) |

No client code changes needed — the app already respects these access patterns in its UI logic.

