import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useKlinelisteLeaders } from '@/hooks/useLeaders';
import { useAuth } from '@/contexts/AuthContext';
import { useRequestHookup, useMyHookups } from '@/hooks/useHookups';
import { useStatusPopup } from '@/hooks/useStatusPopup';

export function AddHookupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const { leader } = useAuth();
  const { data: leaders = [] } = useKlinelisteLeaders();
  const { partnerIds } = useMyHookups();
  const request = useRequestHookup();
  const { showError } = useStatusPopup();

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaders
      .filter((l) => l.id !== leader?.id && !partnerIds.has(l.id))
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true));
  }, [leaders, leader?.id, partnerIds, search]);

  const send = async (id: string, name: string) => {
    try {
      await request.mutateAsync(id);
      setSearch('');
      onOpenChange(false);
      toast.success(`Forespørsel sendt til ${name}`);
    } catch (e) {
      showError('Kunne ikke sende', e instanceof Error ? e.message : 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Ny kobling</SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-xs text-muted-foreground">
          Koblingen vises ikke for andre før den andre lederen har bekreftet den.
        </p>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk etter leder"
            className="pl-9"
            maxLength={60}
          />
        </div>

        <div className="mt-3 space-y-1.5">
          {options.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ingen ledere å velge.</p>
          )}
          {options.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={request.isPending}
              onClick={() => send(l.id, l.name)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 text-left transition-colors hover:bg-card disabled:opacity-50"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={l.profile_image_url ?? undefined} alt={l.name} />
                <AvatarFallback className="text-[11px]">
                  {l.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{l.name}</span>
              {l.is_external && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <UserRound className="h-2.5 w-2.5" /> manuelt
                </span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}