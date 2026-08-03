import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';

export type QuickAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Visually highlight the button (filled with primary) */
  active?: boolean;
  /** Small dot in the corner */
  badge?: boolean;
  tone?: 'default' | 'danger';
};

/**
 * Row of round quick-action buttons on the home screen.
 * Wraps to a new line so more actions can be added later.
 */
export function HomeQuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start justify-center gap-5">
      {actions.map((a) => (
        <div key={a.key} className="flex flex-col items-center gap-1.5 w-16">
          <button
            type="button"
            aria-label={a.label}
            onClick={() => {
              hapticImpact('light');
              a.onClick();
            }}
            className={cn(
              'relative w-14 h-14 rounded-full flex items-center justify-center border shadow-sm transition-all active:scale-90',
              a.active
                ? 'bg-primary text-primary-foreground border-primary/40 shadow-md'
                : a.tone === 'danger'
                  ? 'bg-card text-destructive border-destructive/25'
                  : 'bg-card text-foreground border-border/60',
            )}
          >
            <a.icon className="w-6 h-6" strokeWidth={2.2} />
            {a.badge && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </button>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-tight text-center leading-tight',
              a.active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {a.label}
          </span>
        </div>
      ))}
    </div>
  );
}