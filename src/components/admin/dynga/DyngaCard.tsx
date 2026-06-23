import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  const [imageOpen, setImageOpen] = useState(false);
  const p = card.participant;
  const name = p?.name || 'Ukjent';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const openSheet = () => {
    if (isDragging) return;
    onClick?.();
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          if (isDragging) return;
          e.stopPropagation();
          openSheet();
        }}
        className={cn(
          'group bg-card border border-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
          isDragging && 'opacity-50',
          isOverlay && 'shadow-lg ring-2 ring-primary/40 rotate-1'
        )}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setImageOpen(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Forstørre bilde av ${name}`}
          >
            <Avatar className="h-16 w-16 pointer-events-none">
              {p?.image_url ? <AvatarImage src={p.image_url} alt={name} className="object-cover" /> : null}
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0" onClick={openSheet}>
            <div className="font-medium text-sm leading-tight line-clamp-2">{name}</div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {p?.cabins?.name || 'Uten hytte'}
            </div>
            {card.comment_count > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                <MessageSquare className="h-3 w-3" />
                {card.comment_count}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-none w-auto">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          {p?.image_url ? (
            <img
              src={p.image_url}
              alt={name}
              className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
            />
          ) : (
            <div className="bg-card rounded-lg p-8 text-center">
              <p className="text-lg font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">Ingen profilbilde</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
