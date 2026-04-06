

## Fix: iOS PWA Layout, Scroll-ytelse og Pull-to-Refresh

### Problem
1. Svart stripe nederst — appen fyller ikke hele skjermen
2. Komponenter strekker seg utenfor skjermbredden
3. Scroll er laggy pga CSS transforms ved touch
4. Pull-to-refresh henger i evigheter (ingen timeout)

### Endringer

| Fil | Endring |
|-----|--------|
| `src/index.css` | Fjern `:active` transform-blokk (linje 36-41). Legg til `html, body, #root` fullscreen-regler med `min-height: 100dvh`, `overflow-x: hidden`, `max-width: 100vw`. Legg til global `box-sizing: border-box`. |
| `src/components/layout/AppLayout.tsx` | Ytre div (linje 399): legg til `max-w-full`. Main content (linje 794): legg til `max-w-full`. Fjern `active:scale-95` fra alle 5 bunnav-knapper (linje 679, 727, 744, 763) — behold kun `active:opacity-70`. |
| `src/components/ui/button.tsx` | Fjern `active:scale-[0.98]` fra buttonVariants base-klasse. |
| `src/pages/Passport.tsx` | Fjern `active:scale-[0.98] active:opacity-90 transition-transform` fra utsjekk-knappen (linje 446). |
| `src/hooks/usePullToRefresh.ts` | Legg til 8s timeout i `handleTouchEnd`: `setTimeout(() => setIsRefreshing(false), 8000)` med `clearTimeout` i finally. |
| `src/components/ui/pull-indicator.tsx` | Legg til smooth collapse-animasjon: når `!isPulling && !isRefreshing`, sett `height: 0` med `transition-all duration-300` i stedet for å returnere `null` umiddelbart. |

### Detaljer

**Index.css** — Ny global regel øverst:
```css
*, *::before, *::after { box-sizing: border-box; }
html, body, #root {
  height: 100%;
  min-height: 100dvh;
  min-height: -webkit-fill-available;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}
```

**Pull-to-refresh timeout:**
```ts
const handleTouchEnd = useCallback(async () => {
  if (!isPulling || isRefreshing) return;
  if (pullProgress >= 100) {
    setIsRefreshing(true);
    const timeout = setTimeout(() => setIsRefreshing(false), 8000);
    try {
      await onRefresh();
      hapticSuccess();
    } catch (e) {
      console.error('Pull-to-refresh failed:', e);
    } finally {
      clearTimeout(timeout);
      setIsRefreshing(false);
    }
  }
  setIsPulling(false);
  setPullProgress(0);
  startY.current = 0;
}, [...]);
```

**PullIndicator** — Alltid render, men collapse med CSS:
```tsx
export function PullIndicator({ isPulling, isRefreshing, pullProgress }) {
  const visible = isPulling || isRefreshing;
  return (
    <div 
      className="flex items-center justify-center overflow-hidden transition-all duration-300"
      style={{ 
        height: visible ? `${Math.min(pullProgress * 0.6, 60)}px` : '0px',
        opacity: visible ? pullProgress / 100 : 0
      }}
    >
      ...
    </div>
  );
}
```

### Hva endres IKKE
- Ingen funksjonalitet endres
- Bunnnavigasjon, hamburgermeny og side-out forblir som før
- Kun layout, ytelse og bugfiks

