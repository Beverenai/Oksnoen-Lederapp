import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Trash2, Plus, X, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAllLeaders } from '@/hooks/useLeaders';
import {
  useLeaderDeviations,
  useCreateLeaderDeviation,
  useDeleteLeaderDeviation,
  useUpdateLeaderDeviation,
  DEVIATION_LABELS,
  DEVIATION_COLORS,
  type DeviationKind,
} from '@/hooks/useLeaderDeviations';

const KINDS: DeviationKind[] = ['overtime', 'extra_hours', 'missing_hours', 'absence', 'other'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function LeaderDeviationsSheet({ open, onOpenChange }: Props) {
  const { data: leaders = [] } = useAllLeaders();
  const { data: deviations = [], isLoading } = useLeaderDeviations(open);
  const create = useCreateLeaderDeviation();
  const del = useDeleteLeaderDeviation();
  const update = useUpdateLeaderDeviation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [kind, setKind] = useState<DeviationKind>('overtime');
  const [hours, setHours] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');

  const selected = leaders.find((l) => l.id === leaderId) ?? null;

  const filteredLeaders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leaders.slice(0, 12);
    return leaders.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 12);
  }, [leaders, query]);

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; count: number }>();
    for (const d of deviations) {
      const key = d.leader_id;
      const cur = map.get(key) ?? { name: d.leader?.name ?? 'Ukjent', hours: 0, count: 0 };
      cur.hours += Number(d.hours ?? 0) * (d.kind === 'missing_hours' || d.kind === 'absence' ? -1 : 1);
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => Math.abs(b.hours) - Math.abs(a.hours));
  }, [deviations]);

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setLeaderId(null);
    setQuery('');
    setKind('overtime');
    setHours('');
    setNote('');
    setOccurredOn(format(new Date(), 'yyyy-MM-dd'));
  };

  const submit = () => {
    if (!leaderId) {
      toast.error('Velg en leder');
      return;
    }
    const parsed = hours.trim() ? Number(hours.replace(',', '.')) : null;
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error('Ugyldig antall timer');
      return;
    }
    if (editingId) {
      update.mutate(
        { id: editingId, leaderId, kind, hours: parsed, occurredOn, note: note.trim() || null },
        {
          onSuccess: () => {
            toast.success('Avvik oppdatert');
            reset();
          },
          onError: () => toast.error('Kunne ikke oppdatere avvik'),
        },
      );
      return;
    }
    create.mutate(
      { leaderId, kind, hours: parsed, occurredOn, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success('Avvik registrert');
          reset();
        },
        onError: () => toast.error('Kunne ikke lagre avvik'),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] max-h-[92dvh] flex-col gap-3 rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 sm:mx-auto sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-3xl"
      >
        <SheetHeader className="space-y-0 pr-10 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {editingId ? 'Endre avvik' : 'Lederavvik'}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Timer, overtid og fravær knyttet til en leder</p>
        </SheetHeader>

        {adding ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div>
              <Label className="text-xs">Leder</Label>
              {selected ? (
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 p-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={selected.profile_image_url ?? undefined} alt={selected.name} />
                    <AvatarFallback className="text-xs">{selected.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium">{selected.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => setLeaderId(null)} aria-label="Fjern">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Søk etter leder"
                      className="h-10 pl-8"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filteredLeaders.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLeaderId(l.id)}
                        className="flex items-center gap-1.5 rounded-full bg-muted/60 py-1 pl-1 pr-3 text-xs font-medium transition-transform active:scale-95"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={l.profile_image_url ?? undefined} alt={l.name} />
                          <AvatarFallback className="text-[9px]">{l.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {l.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Type avvik</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95',
                      k === kind ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {DEVIATION_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs" htmlFor="dev-hours">Timer</Label>
                <Input
                  id="dev-hours"
                  inputMode="decimal"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="f.eks. 2,5"
                  className="mt-1.5 h-10"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="dev-date">Dato</Label>
                <Input
                  id="dev-date"
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  className="mt-1.5 h-10"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs" htmlFor="dev-note">Beskrivelse</Label>
              <Textarea
                id="dev-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hva skjedde? (f.eks. nattevakt til 02:00)"
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div className="mt-auto flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Avbryt</Button>
              <Button className="flex-1" onClick={submit} disabled={create.isPending || update.isPending}>
                {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? 'Lagre endringer' : 'Lagre avvik'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button onClick={() => setAdding(true)} className="shrink-0">
              <Plus className="mr-1.5 h-4 w-4" /> Nytt avvik
            </Button>

            {totals.length > 0 && (
              <div className="shrink-0 rounded-2xl border border-border/60 bg-muted/30 p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sum timer per leder
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {totals.map((t) => (
                    <span key={t.name} className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium">
                      {t.name} · {t.hours > 0 ? '+' : ''}{t.hours} t ({t.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : deviations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Ingen avvik registrert.</p>
              ) : (
                <ul className="space-y-2 pb-2">
                  {deviations.map((d) => (
                    <li key={d.id} className="rounded-2xl border border-border/60 bg-card/60 p-3">
                      <div className="flex items-start gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={d.leader?.profile_image_url ?? undefined} alt={d.leader?.name ?? ''} />
                          <AvatarFallback className="text-xs">
                            {(d.leader?.name ?? '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold">{d.leader?.name ?? 'Ukjent leder'}</span>
                            <Badge variant="secondary" className={DEVIATION_COLORS[d.kind]}>
                              {DEVIATION_LABELS[d.kind]}
                            </Badge>
                            {d.hours != null && (
                              <Badge variant="outline" className="text-[10px]">{Number(d.hours)} t</Badge>
                            )}
                            <span className="ml-auto text-[11px] text-muted-foreground">
                              {format(new Date(d.occurred_on), 'd. MMM yyyy', { locale: nb })}
                            </span>
                          </div>
                          {d.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{d.note}</p>}
                          {d.creator?.name && (
                            <p className="mt-1 text-[11px] text-muted-foreground">Registrert av {d.creator.name}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            setEditingId(d.id);
                            setLeaderId(d.leader_id);
                            setKind(d.kind);
                            setHours(d.hours != null ? String(Number(d.hours)).replace('.', ',') : '');
                            setOccurredOn(d.occurred_on);
                            setNote(d.note ?? '');
                            setAdding(true);
                          }}
                          aria-label="Endre avvik"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() =>
                            del.mutate(d.id, {
                              onSuccess: () => toast.success('Avvik slettet'),
                              onError: () => toast.error('Kunne ikke slette'),
                            })
                          }
                          aria-label="Slett avvik"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
