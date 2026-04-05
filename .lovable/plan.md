

## Already Implemented — Minor Adjustments Needed

The app **already has** a persistent bottom tab bar navigation and a mobile header. Here's what exists vs. what you're requesting:

### Current State

| Feature | Status |
|---------|--------|
| Bottom tab bar with 5 tabs | ✅ Already exists (lines 631-761 of AppLayout.tsx) |
| Home tab (House icon) | ✅ Present |
| Passport tab (custom PassIcon) | ✅ Present |
| Leaders tab (Users icon) | ✅ Present |
| Active tab highlighted with green | ✅ `text-primary` uses Oksnøen green |
| iOS safe area on bottom nav | ✅ `.bottom-nav` CSS handles this |
| Lucide icons | ✅ Already using Lucide |

### What's Different from Your Request

1. **Tabs are role-based** — The 5 tabs change depending on whether the user is admin, nurse, or regular leader. Regular leaders get: Home, Leaders, Hajolo (center action button), Passport, Fix. You're requesting: Home, Passport, Schedule, Leaders, Profile.

2. **No Schedule tab** in the bottom bar — Schedule is only in the side menu.

3. **No Profile tab** in the bottom bar — Profile is accessed via the hamburger menu.

4. **No back-arrow button** on sub-pages — The header shows a logo and hamburger menu, not a back button.

### Proposed Changes

#### 1. Update `getBottomNavItems()` in `AppLayout.tsx`

Change the default (non-admin, non-nurse) bottom nav to:
- Home (Home icon)
- Passport (PassIcon)
- Schedule (Calendar icon) — or keep Hajolo as center
- Leaders (Users icon)
- Profile (User icon)

For admin/nurse, keep their specialized layouts but swap Fix for Profile.

#### 2. Add back-arrow to mobile header on sub-pages

In the mobile header section (~line 411-440), detect if the current route is not `/` (home). If on a sub-page, show a `ChevronLeft` / `ArrowLeft` back button on the left side instead of (or alongside) the logo. Tapping it calls `navigate(-1)`.

Sub-pages = any route other than the 5 main tab routes.

#### 3. Files changed

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Update `getBottomNavItems()` for all roles; add back button logic to mobile header |

No CSS changes needed — the bottom nav styling and safe areas are already handled.

