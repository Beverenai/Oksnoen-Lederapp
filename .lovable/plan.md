

## Fix Safe Area Issues Across the Entire App

### Problem
Content and buttons are being cut off behind the iOS home indicator and screen edges. The `.app-content` class has `padding-bottom: calc(var(--nav-h) + var(--safe-b) + 24px)` but this isn't enough in all cases, and individual pages/dialogs with bottom actions don't account for safe areas.

### Changes

#### 1. `src/index.css` — Update `.app-content` and `.bottom-bar`

- Increase `.app-content` bottom padding to ensure enough clearance: `calc(var(--nav-h) + var(--safe-b) + 32px)` (was 24px extra)
- Update `.bottom-bar` to use `padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px))` so sticky bottom buttons clear the home indicator

#### 2. `src/components/passport/ParticipantDetailDialog.tsx` — Constrain dialog height and add safe bottom padding

- The `DialogContent` already has `max-h-[85vh]` and `overflow-y-auto` which is good
- Add `pb-safe` to the inner content `div.p-4` so the "Marker som ankommet" button isn't cut off
- The activity list (`ActivityManager`) renders as `flex-wrap` buttons — these are fine since the dialog scrolls

#### 3. `src/components/passport/ActivityManager.tsx` — Check for overflow

- Read this file to determine if the activity list needs max-height constraints

#### 4. `src/components/admin/LeaderDetailDialog.tsx` and `ParticipantEditDialog.tsx` — Bottom bar safe area

- These use `.bottom-bar` class which will be fixed in step 1

#### 5. `src/components/layout/AppLayout.tsx` — Root container

- The root `div` already has `pl-safe pr-safe` but **not** `pb-safe`. The bottom safe area is handled by `.app-content` and `.bottom-nav` separately, which is correct. No change needed here.
- `viewport-fit=cover` is already set in `index.html` (verified in the viewport meta tag)

### Files changed

| File | Change |
|------|--------|
| `src/index.css` | Increase `.app-content` bottom padding; improve `.bottom-bar` safe area padding |
| `src/components/passport/ParticipantDetailDialog.tsx` | Add `pb-safe` padding to inner content so bottom button isn't cut off |
| `src/components/admin/LeaderContentSheet.tsx` | Verify/add safe bottom padding to sheet content with bottom actions |

### What doesn't need changing
- `index.html` — already has `viewport-fit=cover`
- `.bottom-nav` — already has `bottom: calc(8px + env(safe-area-inset-bottom, 0px))`
- Root container — safe areas handled correctly per-section
- `ActivitySelector.tsx` — renders inside a scrollable dialog, no overflow issue

