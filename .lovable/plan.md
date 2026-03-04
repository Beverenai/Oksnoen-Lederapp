

## Fix: Toast Safe Area + Bottom Nav Position

### 1. Toast overlapping Dynamic Island

The Sonner toaster in `src/components/ui/sonner.tsx` uses `position="top-center"` but has no offset for the iOS safe area. Sonner supports an `offset` prop that controls the distance from the edge.

**File: `src/components/ui/sonner.tsx`**
- Add `offset="calc(env(safe-area-inset-top, 0px) + 12px)"` prop to the `<Sonner>` component, or use the `style` prop with `--offset` CSS variable.
- Alternatively, add a `top` style via `toastOptions.style` to push toasts below the Dynamic Island.

Since Sonner's `offset` prop accepts a string, the simplest fix:
```tsx
<Sonner
  offset="calc(env(safe-area-inset-top, 0px) + 12px)"
  ...
/>
```

### 2. Bottom nav too low

Current CSS has `bottom: 8px` with `padding-bottom: env(safe-area-inset-bottom)` which adds padding *inside* the nav, pushing the height taller but keeping it at 8px from the screen bottom. The problem is the nav background doesn't extend to the screen edge — the pill floats but sits too low.

**Fix in `src/index.css` `.bottom-nav`:**
- Change `bottom: 8px` → `bottom: calc(8px + env(safe-area-inset-bottom, 0px))`
- Remove `padding-bottom: env(safe-area-inset-bottom)` — the safe area offset should lift the entire nav up, not pad inside it (since it's a floating pill, not edge-to-edge)

This keeps the floating pill design but positions it above the home indicator instead of overlapping it.

### Files changed

| File | Change |
|------|--------|
| `src/components/ui/sonner.tsx` | Add `offset` prop for safe area top |
| `src/index.css` | Move bottom-nav up using safe-area in `bottom`, remove internal padding-bottom |

