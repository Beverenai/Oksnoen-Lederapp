

## Fix: Cabin list not scrollable in Popover

### Problem
The cabin list inside the Popover dropdown can't be scrolled. The parent `SheetContent` (which itself is scrollable) is likely capturing touch/wheel events before they reach the inner `max-h-60 overflow-y-auto` div. This is a common issue with nested scrollable containers inside sheets/dialogs.

### Solution
Two changes to `src/components/admin/LeaderContentSheet.tsx`:

1. **Add `onWheel` stop-propagation** on the scrollable cabin list div to prevent the sheet from stealing wheel events
2. **Add `touch-action: auto` and `overscroll-behavior: contain`** CSS to isolate touch scrolling on the list
3. **Increase specificity** by adding `overflow-y: scroll` (instead of `auto`) to ensure the browser always treats it as a scroll container

### Change

In the cabin list `<div className="max-h-60 overflow-y-auto p-1">` (line 565), replace with:

```tsx
<div 
  className="max-h-60 overflow-y-scroll p-1 overscroll-contain"
  onWheel={(e) => e.stopPropagation()}
  onTouchMove={(e) => e.stopPropagation()}
>
```

This prevents the parent sheet from intercepting scroll events meant for the cabin list.

### Files changed
| File | Change |
|------|--------|
| `src/components/admin/LeaderContentSheet.tsx` | Add event propagation stops + overscroll-contain on cabin list div |

