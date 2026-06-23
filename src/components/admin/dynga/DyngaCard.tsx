import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DyngaCardWithParticipant } from '@/hooks/useDynga';

interface Props {
  card: DyngaCardWithParticipant;
  onClick?: () => void;
  isOverlay?: boolean;
}

export function DyngaCard({ card, onClick, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isOverlay,
  });
  const p = card.participant;
  const name = p?.name || 'Ukjent';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'group bg-card border border-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
        isDragging && 'opacity-50',
        isOverlay && 'shadow-lg ring-2 ring-primary/40 rotate-1'
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="h-10 w-10 shrink-0">
          {p?.image_url ? <AvatarImage src={p.image_url} alt={name} /> : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {p?.cabins?.name || 'Uten hytte'}
          </div>
        </div>
        {card.comment_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <MessageSquare className="h-3.5 w-3.5" />
            {card.comment_count}
          </div>
        )}
      </div>
    </div>
  );
}
