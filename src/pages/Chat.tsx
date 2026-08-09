import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowDown, AtSign, Send } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';
import {
  activeMentionQuery,
  applyMention,
  findMentionedLeaders,
  splitMentionSegments,
} from '@/lib/chatMentions';

interface ChatMessage {
  id: string;
  leader_id: string;
  body: string;
  created_at: string;
  channel?: string | null;
  period_id?: string | null;
  mentions?: string[] | null;
}

interface LeaderLite {
  id: string;
  name: string;
  profile_image_url: string | null;
  is_active?: boolean | null;
  is_external?: boolean | null;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Stable per-sender name color, WhatsApp-style. */
const NAME_COLORS = [
  'text-primary',
  'text-emerald-500',
  'text-sky-500',
  'text-violet-500',
  'text-amber-500',
  'text-rose-500',
  'text-teal-500',
  'text-indigo-500',
];
function nameColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

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
  const { leader, isLimitedAccess } = useAuth();
  const { showError } = useStatusPopup();
  const canUsePeriodChat = !isLimitedAccess && leader?.is_active !== false;
  const [channel, setChannel] = useState<'period' | 'offseason'>(
    canUsePeriodChat ? 'period' : 'offseason',
  );
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaders, setLeaders] = useState<Record<string, LeaderLite>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellHeight, setShellHeight] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);

  /**
   * Chatten skal fylle nøyaktig den ledige høyden mellom topplinjen og
   * bunnmenyen — da slipper vi unødvendig skrolling på iPhone.
   */
  useEffect(() => {
    const measure = () => {
      const el = shellRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const navVar = getComputedStyle(document.documentElement).getPropertyValue('--nav-actual-h');
      const navH = parseFloat(navVar) || 64;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setShellHeight(Math.max(320, vh - top - navH - 12));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

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
      setShowJump(distanceFromBottom > 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessages([]);
      let periodId: string | null = null;
      if (channel === 'period') {
        const { data: period } = await supabase
          .from('periods')
          .select('id,name')
          .eq('is_active', true)
          .maybeSingle();
        periodId = period?.id ?? null;
        if (!cancelled) setPeriodLabel(period?.name ?? null);
      }

      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(500);
      if (channel === 'period' && periodId) query = query.eq('period_id', periodId);

      const [{ data: msgs }, { data: lds }] = await Promise.all([
        query,
        supabase.from('leaders').select('id,name,profile_image_url,is_active,is_external'),
      ]);
      if (cancelled) return;
      setMessages((msgs || []) as ChatMessage[]);
      const map: Record<string, LeaderLite> = {};
      (lds || []).forEach((l: any) => { map[l.id] = l; });
      setLeaders(map);
      scrollToBottom(true);
    })();

    const rt = supabase
      .channel(`chat-messages-${channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          if ((incoming.channel ?? 'period') !== channel) return;
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
      supabase.removeChannel(rt);
    };
  }, [channel]);

  /** Ledere som kan tagges: periodechat = aktive, off season = alle med konto. */
  const taggableLeaders = useMemo(() => {
    const all = Object.values(leaders).filter((l) => !l.is_external);
    const pool = channel === 'period' ? all.filter((l) => l.is_active !== false) : all;
    return pool.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }, [leaders, channel]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    return taggableLeaders
      .filter((l) => l.id !== leader?.id)
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .slice(0, 6);
  }, [mention, taggableLeaders, leader?.id]);

  const send = async () => {
    const body = input.trim();
    if (!body || !leader) return;
    setSending(true);
    nearBottomRef.current = true;
    const mentions = findMentionedLeaders(body, taggableLeaders)
      .map((l) => l.id)
      .filter((id) => id !== leader.id);
    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({ leader_id: leader.id, body, channel, mentions })
      .select('id')
      .maybeSingle();
    setSending(false);
    if (error) {
      showError(
        channel === 'period'
          ? 'Kunne ikke sende melding. Bare ledere som er aktive denne perioden kan skrive i periodechatten.'
          : 'Kunne ikke sende melding',
      );
      return;
    }
    setInput('');
    setMention(null);
    // Reset textarea auto-grow
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    scrollToBottom(true);

    // Varsle de taggede. Feiler stille — en manglende push skal aldri
    // hindre at meldingen er sendt.
    if (inserted?.id && mentions.length > 0) {
      supabase.functions
        .invoke('push-chat-mention', { body: { message_id: inserted.id } })
        .catch((e) => console.warn('push-chat-mention failed', e));
    }
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
      out.push({
        kind: 'msg',
        key: m.id,
        msg: m,
        showHeader: !sameGroup,
        showAvatar: !sameGroup,
        isMe,
      });
      prevDate = d;
      prevSender = m.leader_id;
      prevTs = ts;
    }
    return out;
  }, [messages, leader?.id]);

  const syncMention = useCallback((value: string, caret: number) => {
    setMention(activeMentionQuery(value, caret));
  }, []);

  const insertMention = (name: string) => {
    const el = textareaRef.current;
    if (!mention) return;
    const caret = el?.selectionStart ?? input.length;
    const next = applyMention(input, caret, mention.start, name);
    setInput(next.text);
    setMention(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  };

  /** Trykk på et navn i chatten for å tagge personen i svaret. */
  const tagLeader = (name: string) => {
    const el = textareaRef.current;
    setInput((prev) => (prev ? `${prev.replace(/\s*$/, '')} @${name} ` : `@${name} `));
    requestAnimationFrame(() => el?.focus());
  };

  const openMentionPicker = () => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? input.length;
    const needsSpace = caret > 0 && !/\s$/.test(input.slice(0, caret));
    const insert = `${needsSpace ? ' ' : ''}@`;
    const next = input.slice(0, caret) + insert + input.slice(caret);
    setInput(next);
    const newCaret = caret + insert.length;
    setMention({ start: newCaret - 1, query: '' });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(newCaret, newCaret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionMatches.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      insertMention(mentionMatches[0].name);
      return;
    }
    if (mention && e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setInput(el.value);
    syncMention(el.value, el.selectionStart ?? el.value.length);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const renderBody = (msg: ChatMessage, isMe: boolean) => {
    const pool = Object.values(leaders);
    const segments = splitMentionSegments(msg.body, pool);
    return segments.map((seg, i) =>
      seg.type === 'text' ? (
        <span key={i}>{seg.text}</span>
      ) : (
        <button
          key={i}
          type="button"
          onClick={() => tagLeader(seg.text.slice(1))}
          className={cn(
            'rounded-md px-0.5 font-semibold underline-offset-2 hover:underline',
            isMe ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary',
          )}
        >
          {seg.text}
        </button>
      ),
    );
  };

  return (
    <div
      ref={shellRef}
      className="-mx-4 -my-4 flex flex-col gap-2 px-3 pt-2 pb-1 animate-fade-in lg:mx-0 lg:my-0 lg:px-0 lg:pt-0"
      style={shellHeight ? { height: shellHeight } : { height: '70svh' }}
    >
      {/* Kompakt topplinje: tittel + kanalvelger på én rad (mindre skroll på iPhone) */}
      <div className="shrink-0 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-heading font-bold leading-tight lg:text-2xl">
            Lederhuset
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {channel === 'period'
              ? `Periodechat${periodLabel ? ` · ${periodLabel}` : ''}`
              : 'Off season — hele året'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full border bg-card/60 p-0.5 backdrop-blur">
          <button
            type="button"
            onClick={() => setChannel('period')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              channel === 'period'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Periode
          </button>
          <button
            type="button"
            onClick={() => setChannel('offseason')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              channel === 'offseason'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Off season
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          className="h-full overflow-y-auto overscroll-contain rounded-2xl border bg-card/40 px-2.5 py-3 lg:px-3 lg:py-4"
        >
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-sm text-muted-foreground">
                Ingen meldinger enda. Start samtalen!
              </p>
            </div>
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
            const mentionsMe = !!leader && (msg.mentions ?? []).includes(leader.id);
            return (
              <div
                key={it.key}
                className={cn(
                  'flex gap-2 items-start group',
                  isMe && 'flex-row-reverse',
                  showHeader ? 'mt-3' : 'mt-0.5',
                )}
              >
                <div className="w-9 shrink-0">
                  {showAvatar && (
                    <button
                      type="button"
                      onClick={() => !isMe && author?.name && tagLeader(author.name)}
                      aria-label={author?.name ? `Tagg ${author.name}` : undefined}
                    >
                      <Avatar className="w-9 h-9 ring-1 ring-border/60">
                        <AvatarImage src={author?.profile_image_url || undefined} />
                        <AvatarFallback className="text-[11px] font-semibold">
                          {initials(author?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  )}
                </div>
                <div className={cn('max-w-[75%] flex flex-col', isMe && 'items-end')}>
                  {showHeader && (
                    <div className="flex items-center gap-1.5 px-1 mb-0.5">
                      <button
                        type="button"
                        onClick={() => !isMe && author?.name && tagLeader(author.name)}
                        className={cn(
                          'text-[12px] font-semibold',
                          isMe ? 'text-muted-foreground' : nameColor(msg.leader_id),
                        )}
                      >
                        {isMe ? 'Deg' : author?.name || 'Ukjent'}
                      </button>
                    </div>
                  )}
                  <div
                    title={new Date(msg.created_at).toLocaleString('nb-NO')}
                    className={cn(
                      'rounded-2xl px-3 py-2 pb-1.5 text-sm whitespace-pre-wrap break-words shadow-sm',
                      isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                      isMe && showHeader && 'rounded-tr-md',
                      !isMe && showHeader && 'rounded-tl-md',
                      mentionsMe && !isMe && 'ring-2 ring-primary/50',
                    )}
                  >
                    {renderBody(msg, isMe)}
                    <span
                      className={cn(
                        'block text-[10px] leading-none mt-1',
                        isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground',
                      )}
                    >
                      {timeLabel(msg.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showJump && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => { nearBottomRef.current = true; scrollToBottom(true); }}
            aria-label="Til nyeste melding"
            className="absolute bottom-3 right-3 h-10 w-10 rounded-full shadow-lg"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {channel === 'period' && !canUsePeriodChat ? (
        <p className="shrink-0 rounded-2xl border bg-card/40 px-3 py-2.5 text-center text-sm text-muted-foreground">
          Du er ikke aktiv leder denne perioden — du kan lese her, men skrive i off season-chatten.
        </p>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="relative shrink-0"
        >
          {mention && mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border bg-popover shadow-xl">
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tagg en leder
              </p>
              <div className="max-h-56 overflow-y-auto py-1">
                {mentionMatches.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => insertMention(l.name)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={l.profile_image_url || undefined} />
                      <AvatarFallback className="text-[10px]">{initials(l.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-3xl border bg-card/70 p-1.5 backdrop-blur shadow-sm">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={openMentionPicker}
              aria-label="Tagg en leder"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            >
              <AtSign className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onClick={(e) => syncMention(input, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              placeholder="Skriv en melding… bruk @ for å tagge"
              maxLength={4000}
              rows={1}
              disabled={sending || !leader}
              className="min-h-[36px] max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
