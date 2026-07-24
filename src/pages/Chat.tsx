import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(d: Date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'I dag';
  if (sameDay(d, yesterday)) return 'I går';
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: '2-digit', month: 'short' });
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function Chat() {
  const { leader, isSuperAdmin } = useAuth();
  const { showError } = useStatusPopup();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaders, setLeaders] = useState<Record<string, LeaderLite>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);

  const scrollToBottom = (force = false) => {
    if (!force && !nearBottomRef.current) return;
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // Track whether the user is near the bottom (so incoming messages autoscroll
  // only when they are already following the conversation).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      nearBottomRef.current = distanceFromBottom < 120;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

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
      scrollToBottom(true);
    })();

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
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
    nearBottomRef.current = true;
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
    // Reset textarea auto-grow
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    scrollToBottom(true);
  };

  const del = async (m: ChatMessage) => {
    if (!confirm('Slette denne meldingen?')) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', m.id);
    if (error) showError('Kunne ikke slette');
  };

  // Build render items with day separators + sender grouping.
  type RenderItem =
    | { kind: 'day'; key: string; label: string }
    | {
        kind: 'msg';
        key: string;
        msg: ChatMessage;
        showHeader: boolean;
        showAvatar: boolean;
        isMe: boolean;
      };

  const items: RenderItem[] = useMemo(() => {
    const out: RenderItem[] = [];
    let prevDate: Date | null = null;
    let prevSender: string | null = null;
    let prevTs = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const d = new Date(m.created_at);
      const ts = d.getTime();
      const isMe = m.leader_id === leader?.id;
      if (!prevDate || !sameDay(prevDate, d)) {
        out.push({ kind: 'day', key: `day-${d.toDateString()}`, label: dayLabel(d) });
        prevSender = null;
      }
      const sameGroup = prevSender === m.leader_id && ts - prevTs < GROUP_WINDOW_MS;
      const next = messages[i + 1];
      const nextSameGroup =
        next &&
        next.leader_id === m.leader_id &&
        sameDay(new Date(next.created_at), d) &&
        new Date(next.created_at).getTime() - ts < GROUP_WINDOW_MS;
      out.push({
        kind: 'msg',
        key: m.id,
        msg: m,
        showHeader: !sameGroup,
        showAvatar: !nextSameGroup,
        isMe,
      });
      prevDate = d;
      prevSender = m.leader_id;
      prevTs = ts;
    }
    return out;
  }, [messages, leader?.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] gap-3 animate-fade-in">
      <div className="shrink-0">
        <h1 className="text-2xl font-heading font-bold">Øksnøen Chat</h1>
        <p className="text-sm text-muted-foreground">
          Meldinger mellom alle Øksnøen-ledere
        </p>
      </div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border bg-card/40 backdrop-blur px-3 py-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Ingen meldinger enda. Start samtalen!
          </p>
        )}
        {items.map((it) => {
          if (it.kind === 'day') {
            return (
              <div key={it.key} className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {it.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }
          const { msg, showHeader, showAvatar, isMe } = it;
          const author = leaders[msg.leader_id];
          const canDelete = isMe || isSuperAdmin;
          return (
            <div
              key={it.key}
              className={cn(
                'flex gap-2 items-end group',
                isMe && 'flex-row-reverse',
                showHeader ? 'mt-3' : 'mt-0.5',
              )}
            >
              <div className="w-8 shrink-0">
                {showAvatar && !isMe && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={author?.profile_image_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {author?.name?.slice(0, 2).toUpperCase() || '??'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className={cn('max-w-[75%] flex flex-col', isMe && 'items-end')}>
                {showHeader && !isMe && (
                  <div className="text-[11px] text-muted-foreground px-1 mb-0.5">
                    {author?.name || 'Ukjent'} · {timeLabel(msg.created_at)}
                  </div>
                )}
                <div
                  title={new Date(msg.created_at).toLocaleString('nb-NO')}
                  className={cn(
                    'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm',
                    isMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                    isMe && showHeader && 'rounded-tr-md',
                    isMe && !showAvatar && 'rounded-br-md',
                    !isMe && showHeader && 'rounded-tl-md',
                    !isMe && !showAvatar && 'rounded-bl-md',
                  )}
                >
                  {msg.body}
                </div>
              </div>
              {canDelete && (
                <button
                  onClick={() => del(msg)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity self-center"
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
        className="shrink-0 flex gap-2 items-end"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Skriv en melding…"
          maxLength={4000}
          rows={1}
          disabled={sending || !leader}
          className="min-h-[42px] max-h-40 resize-none py-2.5"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}