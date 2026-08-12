import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashCardProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children: ReactNode;
}

export function DashCard({ title, icon, badge, actionLabel, onAction, className, children }: DashCardProps) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-border/60 bg-card/70 backdrop-blur shadow-sm p-4',
        className,
      )}
    >
      <header className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
        {badge}
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="ml-auto flex items-center gap-0.5 text-xs font-medium text-muted-foreground active:opacity-70"
          >
            {actionLabel ?? 'Se alle'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-1">{text}</p>;
}