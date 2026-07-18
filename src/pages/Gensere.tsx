import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, Home, CheckCircle2, ShoppingBag, Shirt } from 'lucide-react';
import { useSweatersEnabled } from '@/hooks/useSweatersEnabled';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { SweaterDetailSheet } from '@/components/gensere/SweaterDetailSheet';

interface ParticipantRow {
  id: string;
  name: string;
  image_url: string | null;
  cabin_id: string | null;
  cabins?: { id: string; name: string } | null;
}

interface SweaterRow {
  participant_id: string;
  preordered_size: string | null;
  picked_up: boolean;
  picked_up_size: string | null;
  bought_on_camp: boolean;
  bought_size: string | null;
}

export default function Gensere() {
  const enabled = useSweatersEnabled();
  const { data: periodId } = useActivePeriodId();
  const [search, setSearch] = useState('');
  const [cabinFilter, setCabinFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gensere', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async () => {
      const [pRes, cRes, sRes] = await Promise.all([
        supabase.from('participants').select('id, name, image_url, cabin_id, cabins(id, name)').order('name'),
        supabase.from('cabins').select('id, name').order('name'),
        supabase.from('participant_sweaters').select('participant_id, preordered_size, picked_up, picked_up_size, bought_on_camp, bought_size').eq('period_id', periodId!),
      ]);
      const map = new Map<string, SweaterRow>();
      (sRes.data || []).forEach((r: any) => map.set(r.participant_id, r));
      return {
        participants: (pRes.data || []) as ParticipantRow[],
        cabins: (cRes.data || []) as { id: string; name: string }[],
        sweaters: map,
      };
    },
    staleTime: 15_000,
  });

  const participants = data?.participants || [];
  const cabins = data?.cabins || [];
  const sweaters = data?.sweaters || new Map<string, SweaterRow>();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      const s = sweaters.get(p.id);
      const done = !!(s && (s.picked_up || s.bought_on_camp));
      if (statusFilter === 'todo' && done) return false;
      if (statusFilter === 'done' && !done) return false;
      if (cabinFilter !== 'all' && p.cabin_id !== cabinFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.cabins?.name || '').toLowerCase().includes(q);
    });
  }, [participants, sweaters, search, cabinFilter, statusFilter]);

  const doneCount = participants.filter((p) => {
    const s = sweaters.get(p.id);
    return !!(s && (s.picked_up || s.bought_on_camp));
  }).length;

  if (!enabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Shirt className="w-6 h-6 text-primary" /> Gensere
        </h1>
        <p className="text-muted-foreground mt-1">
          {doneCount} av {participants.length} registrert
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Søk etter navn..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={cabinFilter} onValueChange={setCabinFilter}>
          <SelectTrigger className="w-full sm:w-40"><Home className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle hytter</SelectItem>
            {cabins.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="todo">Ikke registrert</SelectItem>
            <SelectItem value="done">Registrert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const s = sweaters.get(p.id);
            const picked = !!s?.picked_up;
            const bought = !!s?.bought_on_camp;
            const done = picked || bought;
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedId(p.id); setOpen(true); }}
                className={
                  'p-3 rounded-lg border bg-card cursor-pointer transition-all hover:shadow-md ' +
                  (done ? 'border-success/40 bg-success/5' : 'hover:border-primary/50')
                }
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={p.image_url || undefined} />
                    <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-sm">{p.name}</p>
                      {done && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {p.cabins?.name && <Badge variant="secondary" className="text-xs">{p.cabins.name}</Badge>}
                      {s?.preordered_size && (
                        <Badge variant="outline" className="text-xs uppercase">Best. {s.preordered_size}</Badge>
                      )}
                      {picked && (
                        <Badge className="text-xs bg-success/15 text-success border-success/30">
                          Hentet{s?.picked_up_size ? ` (${s.picked_up_size})` : ''}
                        </Badge>
                      )}
                      {bought && (
                        <Badge className="text-xs bg-primary/15 text-primary border-primary/30">
                          <ShoppingBag className="w-3 h-3 mr-0.5" />
                          Kjøpt{s?.bought_size ? ` (${s.bought_size})` : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Shirt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ingen deltakere funnet</p>
            </div>
          )}
        </div>
      )}

      <SweaterDetailSheet
        participantId={selectedId}
        open={open}
        onOpenChange={setOpen}
        onSaved={refetch}
      />
    </div>
  );
}