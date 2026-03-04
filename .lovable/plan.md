

## iOS Native Layout Fix - Safe Areas & Overflow

### Problem
Several layout issues when running via Capacitor on iOS:
1. Header/bottom nav don't fully respect safe areas
2. Bottom nav cut off by home indicator
3. Content cards overflow horizontally
4. StatusBar style not set correctly on startup

### Changes

#### 1. `index.html` - Viewport meta tag
Already has `viewport-fit=cover` - no change needed.

#### 2. `src/main.tsx` - StatusBar default to Dark
Change the StatusBar initialization to explicitly set `Style.Dark` on startup (the theme hook will override later, but this prevents a flash of wrong style).

#### 3. `src/index.css` - Bottom nav & content overflow fixes

- **`.bottom-nav`**: Add `padding-bottom: env(safe-area-inset-bottom)` so the tab bar content sits above the home indicator. Adjust `bottom` from `calc(8px + var(--safe-b))` to just `8px` since padding now handles the safe area internally, or keep the current approach but ensure the nav pills are above the indicator.
- **`.app-content`**: Add `overflow-x: hidden` to prevent horizontal overflow from cards.
- Add a global `overflow-x: hidden` on the scroll containers.

#### 4. `src/components/layout/AppLayout.tsx` - Three fixes

| Line | Current | Change |
|------|---------|--------|
| 395 | Root div | Add `pl-safe pr-safe` for left/right safe areas |
| 633 | `<nav className="lg:hidden bottom-nav">` | Add `pb-safe` class for bottom safe area padding inside the nav |
| 767 | `<main>` className | Add `overflow-x-hidden` to prevent card overflow |
| 778 | Content wrapper `<div className="p-4 lg:p-6">` | No change needed |

### Detailed changes

**`src/index.css`** - Update `.bottom-nav`:
- Change `bottom: calc(8px + var(--safe-b))` to `bottom: 8px` 
- Add `padding-bottom: env(safe-area-inset-bottom)` so internal content respects the home indicator
- This way the floating pill extends down to cover the home indicator area

**`src/index.css`** - Update `.app-content`:
- Add `overflow-x: hidden` to prevent horizontal bleed

**`src/components/layout/AppLayout.tsx`**:
- Line 767 main: add `overflow-x-hidden`
- Line 633 nav: the bottom-nav CSS class already handles positioning; add inline padding for safe area

**`src/main.tsx`**:
- Import `Style` and set `StatusBar.setStyle({ style: Style.Dark })` during init

### Files changed

| File | What |
|------|------|
| `src/index.css` | Bottom nav safe area padding, app-content overflow-x |
| `src/components/layout/AppLayout.tsx` | overflow-x-hidden on main, safe area classes |
| `src/main.tsx` | Set StatusBar style to Dark on init |

