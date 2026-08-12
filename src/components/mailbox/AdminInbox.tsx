import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  categoryEmoji,
  categoryLabel,
  MailboxMessage,
  statusLabel,
  useUpdateMailboxMessage,
} from '@/hooks/useMailbox';
import { EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

type Filter = 'new' | 'read' | 'replied' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'new', label: 'Nye' },
  { value: 'read', label: 'Lest' },
  { value: 'replied', label: 'Besvart' },
  { value: 'all', label: 'Alle' },
];

function useLeaderLookup() {
  return useQuery({
    queryKey: ['mailbox', 'leaders-lite'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id,name,profile_image_url');
      if (error) throw error;
      const map = new Map<string, { name: string; image: string | null }>();
      (data ?? []).forEach((l) => map.set(l.id, { name: l.name, image: l.profile_image_url }));
      return map;
    },
  });
}

export function AdminInbox({ messages, onDeleted }: { messages: MailboxMessage[]; onDeleted?: () => void }) {
  const [filter, setFilter] = useState<Filter>('new');
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const { data: leaders } = useLeaderLookup();
  const update = useUpdateMailboxMessage();

  const filtered = useMemo(
    () => (filter === 'all' ? messages : messages.filter((m) => m.status === filter)),
    [messages, filter],
  );

  const remove = async (id: string) => {
    const { error } = await supabase.from('mailbox_messages').delete().eq('id', id);
    if (error) {
      toast.error('Kunne ikke slette');
      return;
    }
    toast.success('Slettet');
    onDeleted?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? messages.length : messages.filter((m) => m.status === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                filter === f.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground',
              )}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Ingen meldinger her.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const sender = leaders?.get(m.sender_leader_id);
            const isReplying = replyFor === m.id;
            return (
              <div key={m.id} className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={sender?.image || undefined} alt={sender?.name || 'Leder'} />
                    <AvatarFallback>{(sender?.name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {sender?.name ?? 'Ukjent leder'}
                      </span>
                      {m.is_anonymous && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> anonym utad
                        </span>
                      )}
                      <Badge variant={m.status === 'new' ? 'default' : 'secondary'}>
                        {statusLabel(m.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span aria-hidden className="mr-1">{categoryEmoji(m.category)}</span>
                      {categoryLabel(m.category)} · {fmt(m.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => remove(m.id)}
                    aria-label="Slett melding"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{m.content}</p>

                {m.admin_reply && !isReplying && (
                  <div className="mt-3 rounded-xl bg-muted/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Svar</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.admin_reply}</p>
                  </div>
                )}

                {isReplying ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Skriv svar til avsender…"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={update.isPending}
                        onClick={async () => {
                          await update.mutateAsync({ id: m.id, reply: replyText });
                          setReplyFor(null);
                          setReplyText('');
                          toast.success('Svar sendt');
                        }}
                      >
                        Lagre svar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>
                        Avbryt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.status === 'new' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => update.mutate({ id: m.id, status: 'read' })}
                      >
                        Marker som lest
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyFor(m.id);
                        setReplyText(m.admin_reply ?? '');
                      }}
                    >
                      {m.admin_reply ? 'Endre svar' : 'Svar'}
                    </Button>
                    {m.admin_reply && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const { data, error } = await supabase.functions.invoke('push-mailbox-reply', {
                            body: { message_id: m.id },
                          });
                          if (error) {
                            toast.error('Kunne ikke sende varsel');
                            return;
                          }
                          const sent = (data as { sent?: number } | null)?.sent ?? 0;
                          toast.success(sent > 0 ? 'Varsel sendt' : 'Ingen enheter å varsle');
                        }}
                      >
                        <Bell className="mr-1.5 h-3.5 w-3.5" />
                        Send varsel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
