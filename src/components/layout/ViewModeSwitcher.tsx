import { Sparkles, Sun, Tent, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessMode, type ViewMode } from '@/hooks/useViewMode';

const OPTIONS: { value: ViewMode; label: string; icon: typeof Sun }[] = [
  { value: 'auto', label: 'Automatisk', icon: Wand2 },
  { value: 'full', label: 'Full app', icon: Sparkles },
  { value: 'offseason', label: 'Off-season', icon: Sun },
  { value: 'leirskole', label: 'Leirskole', icon: Tent },
];

/** Lar admin/superadmin bytte mellom app-versjonene. */
export default function ViewModeSwitcher({ className }: { className?: string }) {
  const { viewMode, setViewMode, canSwitch } = useAccessMode();
  if (!canSwitch) return null;

  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl', className)}>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Vis app som
      </p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = viewMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setViewMode(value)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-white/5 text-foreground/80 hover:bg-white/10',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
