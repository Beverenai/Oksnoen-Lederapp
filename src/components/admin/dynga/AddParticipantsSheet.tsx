import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, Plus, Check } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { useAddCards, useDyngaCards, useDyngaColumns } from '@/hooks/useDynga';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; periodId?: string | null; }

export function AddParticipantsSheet({ open, onOpenChange, periodId }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const { effectiveLeader } = useAuth();
  const { data: participants = [] } = useParticipants();
  const { data: cards = [] } = useDyngaCards(periodId);
  const { data: columns = [] } = useDyngaColumns(periodId);
  const addCards = useAddCards();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  // Map participantId -> set of columnIds they're already in
  const participantColumns = useMemo(() => {
    const m = new Map<string, Set<string>>();
    cards.forEach(c => {
      const s = m.get(c.participant_id) || new Set<string>();
      s.add(c.column_id);
      m.set(c.participant_id, s);
    });
    return m;
  }, [cards]);

  const available = useMemo(() => {
    const q = search.toLowerCase();
    return participants
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.cabins?.name || '').toLowerCase().includes(q));
  }, [participants, search]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const toggleColumn = (id: string) => {
    const n = new Set(selectedColumns);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedColumns(n);
  };

  const submit = async () => {
    if (selected.size === 0 || columns.length === 0) return;
    const targetCols = selectedColumns.size > 0
      ? Array.from(selectedColumns)
      : [columns[0].id];
    try {
      for (const columnId of targetCols) {
        await addCards.mutateAsync({
          participantIds: Array.from(selected),
          columnId,
          initialComment: comment,
          leaderId: effectiveLeader?.id ?? null,
          periodId: periodId ?? null,
        });
      }
      showSuccess('Lagt til', `${selected.size} deltager(e) lagt til ${targetCols.length} kolonne(r)`);
      setSelected(new Set());
      setSelectedColumns(new Set());
      setSearch('');
      setComment('');
      onOpenChange(false);
    } catch (e: any) {
      showError('Kunne ikke legge til', e?.message || 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-6 pb-3 border-b">
          <SheetTitle>Legg til deltagere</SheetTitle>
          <SheetDescription>Velg deltagere som skal vises på Dynga</SheetDescription>
        </SheetHeader>
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk navn eller hytte..." className="pl-9" />
          </div>
        </div>
        {columns.length > 0 && (
          <div className="px-4 py-3 border-b">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Legg til i kolonne{selectedColumns.size > 1 ? 'r' : ''} {selectedColumns.size === 0 && `(standard: ${columns[0].title})`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(col => {
                const active = selectedColumns.has(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors',
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'
                    )}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {col.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen deltagere å legge til</p>
          ) : (
            <div className="space-y-1">
              {available.map(p => {
                const checked = selected.has(p.id);
                const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const inCols = participantColumns.get(p.id);
                const inCount = inCols?.size ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left ${checked ? 'bg-primary/10' : ''}`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                    <Avatar className="h-14 w-14">
                      {p.image_url ? <AvatarImage src={p.image_url} alt={p.name} /> : null}
                      <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.cabins?.name || 'Uten hytte'}
                        {inCount > 0 && <span className="ml-1.5 text-primary/80">· allerede i {inCount}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t p-3 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Valgfri kommentar (legges på alle valgte)..."
            rows={2}
            className="resize-none"
          />
          <Button onClick={submit} disabled={selected.size === 0 || addCards.isPending} className="w-full">
            {addCards.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Legg til ({selected.size})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
