import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, ThumbsUp, Trash2, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { hapticImpact } from '@/lib/capacitorHaptics';

type FeedbackRow = {
  id: string;
  leader_id: string | null;
  title: string;
  description: string | null;
  category: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

const CATEGORIES = [
  { value: 'funksjon', label: 'Ny funksjon' },
  { value: 'forbedring', label: 'Forbedring' },
  { value: 'feil', label: 'Feil / bug' },
  { value: 'annet', label: 'Annet' },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  ny: { label: 'Ny', className: 'bg-muted text-muted-foreground' },
  vurderes: { label: 'Vurderes', className: 'bg-primary/15 text-primary' },
  planlagt: { label: 'Planlagt', className: 'bg-primary/25 text-primary' },
  ferdig: { label: 'Ferdig', className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  avslatt: { label: 'Ikke nå', className: 'bg-destructive/15 text-destructive' },
};

const STATUS_OPTIONS = ['ny', 'vurderes', 'planlagt', 'ferdig', 'avslatt'];

export default function Feedback() {
  const { leader, effectiveLeader, isAdmin } = useAuth();
  const myLeaderId = (effectiveLeader ?? leader)?.id ?? null;
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('funksjon');

  const { data: items, isLoading } = useQuery({
    queryKey: ['feedback-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  const { data: votes } = useQuery({
    queryKey: ['feedback-votes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feedback_votes').select('feedback_id, leader_id');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leaders } = useQuery({
    queryKey: ['feedback-leader-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leaders').select('id, name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const leaderNames = useMemo(() => {
    const map = new Map<string, string>();
    (leaders ?? []).forEach((l: { id: string; name: string }) => map.set(l.id, l.name));
    return map;
  }, [leaders]);

  const voteInfo = useMemo(() => {
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    (votes ?? []).forEach((v: { feedback_id: string; leader_id: string }) => {
      counts.set(v.feedback_id, (counts.get(v.feedback_id) ?? 0) + 1);
      if (v.leader_id === myLeaderId) mine.add(v.feedback_id);
    });
    return { counts, mine };
  }, [votes, myLeaderId]);

  const sorted = useMemo(() => {
    return [...(items ?? [])].sort((a, b) => {
      const va = voteInfo.counts.get(a.id) ?? 0;
      const vb = voteInfo.counts.get(b.id) ?? 0;
      if (va !== vb) return vb - va;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [items, voteInfo]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('feedback_items').insert({
        leader_id: myLeaderId,
        title: title.trim(),
        description: description.trim() || null,
        category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setCategory('funksjon');
      qc.invalidateQueries({ queryKey: ['feedback-items'] });
      toast.success('Takk! Forslaget er sendt inn');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVote = useMutation({
    mutationFn: async (id: string) => {
      if (!myLeaderId) throw new Error('Ingen leder funnet');
      if (voteInfo.mine.has(id)) {
        const { error } = await supabase
          .from('feedback_votes')
          .delete()
          .eq('feedback_id', id)
          .eq('leader_id', myLeaderId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('feedback_votes')
          .insert({ feedback_id: id, leader_id: myLeaderId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback-votes'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feedback_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback-items'] });
      toast.success('Forslag slettet');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('feedback_items').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback-items'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-8">
      <header className="pt-1">
        <h1 className="flex items-center gap-2 text-2xl font-heading font-bold text-foreground">
          <Lightbulb className="h-6 w-6 text-primary" strokeWidth={1.8} />
          Feedback
        </h1>
        <p className="text-sm text-muted-foreground">
          Foreslå nye funksjoner eller forbedringer i appen — stem på andres forslag.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Kort tittel (t.d. «Push når vaktplan endres»)"
          maxLength={120}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beskriv forslaget…"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background/60 text-muted-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button
          className="w-full"
          disabled={!title.trim() || create.isPending}
          onClick={() => {
            hapticImpact('light');
            create.mutate();
          }}
        >
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send inn forslag
        </Button>
      </section>

      <section className="space-y-2.5">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Forslag {sorted.length > 0 && `(${sorted.length})`}
        </div>

        {isLoading && <p className="px-1 text-sm text-muted-foreground">Laster…</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">
            Ingen forslag ennå. Bli den første!
          </p>
        )}

        {sorted.map((item) => {
          const status = STATUS_META[item.status] ?? STATUS_META.ny;
          const count = voteInfo.counts.get(item.id) ?? 0;
          const voted = voteInfo.mine.has(item.id);
          const canDelete = isAdmin || (myLeaderId && item.leader_id === myLeaderId);
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact('light');
                    toggleVote.mutate(item.id);
                  }}
                  className={cn(
                    'flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors',
                    voted
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground',
                  )}
                >
                  <ThumbsUp className="h-4 w-4" strokeWidth={2} />
                  <span className="text-xs font-bold">{count}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                    <Badge className={cn('border-0 text-[10px]', status.className)}>
                      {status.label}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
                    {' · '}
                    {item.leader_id ? leaderNames.get(item.leader_id) ?? 'Ukjent' : 'Ukjent'}
                    {' · '}
                    {new Date(item.created_at).toLocaleDateString('nb-NO', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                  {isAdmin && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus.mutate({ id: item.id, status: s })}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-medium',
                            item.status === s
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 text-muted-foreground',
                          )}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => removeItem.mutate(item.id)}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Slett forslag"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
