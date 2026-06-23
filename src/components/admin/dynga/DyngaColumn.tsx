import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DyngaColumn as DyngaColumnT } from '@/hooks/useDynga';

const COLOR_CLASSES: Record<string, string> = {
  muted: 'bg-muted/40 border-border',
  green: 'bg-emerald-500/10 border-emerald-500/30',
  amber: 'bg-amber-500/10 border-amber-500/30',
  blue: 'bg-blue-500/10 border-blue-500/30',
  red: 'bg-red-500/10 border-red-500/30',
  purple: 'bg-purple-500/10 border-purple-500/30',
};

const DOT_CLASSES: Record<string, string> = {
  muted: 'bg-muted-foreground',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

interface Props {
  column: DyngaColumnT;
  count: number;
  children: React.ReactNode;
}

export function DyngaColumn({ column, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const colorClass = COLOR_CLASSES[column.color] || COLOR_CLASSES.muted;
  const dotClass = DOT_CLASSES[column.color] || DOT_CLASSES.muted;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-[280px] rounded-xl border backdrop-blur-sm flex flex-col snap-start',
        colorClass,
        isOver && 'ring-2 ring-primary/40'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
          <h3 className="font-semibold text-sm truncate">{column.title}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <div className="flex-1 min-h-[200px] p-2 space-y-2 overflow-y-auto max-h-[calc(100dvh-260px)]">
        {children}
        {count === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Slipp deltagere her</p>
        )}
      </div>
    </div>
  );
}
