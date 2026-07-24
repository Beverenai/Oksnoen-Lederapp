import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Trash2 } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  leader_id: string;
  body: string;
  created_at: string;
}

interface LeaderLite {
  id: string;
  name: string;
  profile_image_url: string | null;
}

export default function Chat() {
  const { leader, isSuperAdmin } = useAuth();
  const { showError } = useStatusPopup();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaders, setLeaders] = useState<Record<string, LeaderLite>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: lds }] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(500),
        supabase.from('leaders').select('id,name,profile_image_url'),
      ]);
      if (cancelled) return;
      setMessages((msgs || []) as ChatMessage[]);
      const map: Record<string, LeaderLite> = {};
      (lds || []).forEach((l: any) => { map[l.id] = l; });
      setLeaders(map);
      scrollToBottom();
    })();

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          scrollToBottom();
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const send = async () => {
    const body = input.trim();
    if (!body || !leader) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      leader_id: leader.id,
      body,
    });
    setSending(false);
    if (error) {
      showError('Kunne ikke sende melding');
      return;
    }
    setInput('');
  };

  const del = async (m: ChatMessage) => {
    if (!confirm('Slette denne meldingen?')) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', m.id);
    if (error) showError('Kunne ikke slette');
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('nb-NO', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] gap-3 animate-fade-in">
      <div className="shrink-0">
        <h1 className="text-2xl font-heading font-bold">Ledersnakk</h1>
        <p className="text-sm text-muted-foreground">
          Global chat mellom alle aktive ledere
        </p>
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border bg-card/40 backdrop-blur p-3 space-y-3"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Ingen meldinger enda. Start samtalen!
          </p>
        )}
        {messages.map((m) => {
          const author = leaders[m.leader_id];
          const isMe = m.leader_id === leader?.id;
          const canDelete = isMe || isSuperAdmin;
          return (
            <div
              key={m.id}
              className={cn('flex gap-2 items-end group', isMe && 'flex-row-reverse')}
            >
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={author?.profile_image_url || undefined} />
                <AvatarFallback className="text-xs">
                  {author?.name?.slice(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              <div className={cn('max-w-[75%] flex flex-col', isMe && 'items-end')}>
                <div className="text-[11px] text-muted-foreground px-1">
                  {author?.name || 'Ukjent'} · {formatTime(m.created_at)}
                </div>
                <div
                  className={cn(
                    'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm',
                  )}
                >
                  {m.body}
                </div>
              </div>
              {canDelete && (
                <button
                  onClick={() => del(m)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Slett melding"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="shrink-0 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv en melding…"
          maxLength={4000}
          disabled={sending || !leader}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}