import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getParticipantThumb } from '@/lib/participantImage';
import { formatFullRoom } from '@/lib/cabinDisplay';
import type { ParticipantWithCabin } from '@/hooks/useParticipants';
import type { KioskBalance } from '@/hooks/useKiosk';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ParticipantWithCabin[];
  balances?: Map<string, KioskBalance>;
  onSelect: (participant: ParticipantWithCabin) => void;
}

export function KioskParticipantPicker({ open, onOpenChange, participants, balances, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => p.name.toLowerCase().includes(q));
  }, [participants, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-3xl p-0">
        <SheetHeader className="shrink-0 px-4 pb-3 pt-5">
          <SheetTitle className="text-center">Velg deltager</SheetTitle>
          <div className="relative mt-3">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Søk etter navn"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 rounded-full pl-11"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="divide-y divide-border">
            {list.map((p) => {
              const balance = balances?.get(p.id)?.balance ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p);
                    onOpenChange(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left active:bg-muted/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getParticipantThumb(p)} alt={p.name} />
                    <AvatarFallback className="text-xs">
                      {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFullRoom(p.cabins?.name, p.room) || 'Ingen hytte'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
                      balance > 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    {balance} kr
                  </span>
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Ingen treff</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}