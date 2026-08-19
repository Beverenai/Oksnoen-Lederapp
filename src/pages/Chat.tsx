import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';
import { useActiveLeirskoleWeek, useIsLeirskoleStaff, useLeirskoleStaff } from '@/hooks/useLeirskole';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessMode } from '@/hooks/useViewMode';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowDown, ImagePlus, Loader2, Reply, Send, Users, X } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/imageUtils';
import { ChatReactions, type ChatReaction } from '@/components/chat/ChatReactions';
import { ChatImage, CHAT_BUCKET } from '@/components/chat/ChatImage';
import {
  activeMentionQuery,
  applyMention,
  findMentionedLeaders,
  splitMentionSegments,
  hasAllMention,
  ALL_MENTION_ID,
  ALL_MENTION_NAME,
} from '@/lib/chatMentions';

interface ChatMessage {
  id: string;
  leader_id: string;
  body: string;
  created_at: string;
  channel?: string | null;
  period_id?: string | null;
  mentions?: string[] | null;
  reply_to_id?: string | null;
  image_path?: string | null;
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
  const { leader, isLimitedAccess, isLeirskole, isAdmin } = useAuth();
  const { showError } = useStatusPopup();
  const { limited, leirskoleView, mode: accessMode } = useAccessMode();
  const canUsePeriodChat = !limited;
  const { data: activeLeirskoleWeek } = useActiveLeirskoleWeek();
  const { data: isLeirskoleStaff } = useIsLeirskoleStaff(activeLeirskoleWeek?.id);
  const { data: leirskoleStaff } = useLeirskoleStaff(activeLeirskoleWeek?.id);
  const leirskoleLeaderIds = useMemo(
    () => new Set((leirskoleStaff ?? []).map((s) => s.leader_id)),
    [leirskoleStaff],
  );
  // Leirskole-chatten er kun for de som er satt opp på den aktive leirskoleuken (+ admin).
  const canUseLeirskoleChat =
    (isAdmin && accessMode !== 'offseason') || (leirskoleView && !!isLeirskoleStaff);
  const [channel, setChannel] = useState<'period' | 'offseason' | 'leirskole'>(
    accessMode === 'leirskole' && canUseLeirskoleChat ? 'leirskole' : canUsePeriodChat ? 'period' : 'offseason',
  );
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaders, setLeaders] = useState<Record<string, LeaderLite>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Inaktive ledere har kun tilgang til off season-chatten
  useEffect(() => {
    if (accessMode === 'leirskole') setChannel(canUseLeirskoleChat ? 'leirskole' : 'offseason');
    else if (!canUsePeriodChat) setChannel((c) => (c === 'period' || c === 'leirskole' ? 'offseason' : c));
    else setChannel((c) => (c === 'offseason' ? 'period' : c));
  }, [canUsePeriodChat, accessMode, canUseLeirskoleChat]);
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
      const navVar = getComputedStyle(document.documentElement).getPropertyValue('--nav-actual-h');
      const navH = parseFloat(navVar) || 64;
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight;
      // Hvor mye tastaturet dekker av skjermen (0 når det er lukket)
      const kb = Math.max(0, window.innerHeight - (vh + (vv?.offsetTop ?? 0)));
      const keyboardOpen = kb > 80;
      // iOS skrur ofte hele siden opp når tastaturet åpnes – tving den tilbake
      // og mål toppen relativt til dokumentet, ikke det forskjøvne viewportet.
      if (keyboardOpen) {
        window.scrollTo(0, 0);
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Når tastaturet er åpent er bunnmenyen skjult bak tastaturet
      const reserved = keyboardOpen ? 8 : navH + 12;
      setShellHeight(Math.max(220, vh - top - reserved));
    };
    measure();
    const onVVScroll = () => {
      // Motvirk iOS-hoppet: hold dokumentet i ro og re-mål høyden
      if ((window.visualViewport?.offsetTop ?? 0) > 0) window.scrollTo(0, 0);
      measure();
    };
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', onVVScroll, { passive: true });
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', onVVScroll);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onVVScroll);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', onVVScroll);
    };
  }, []);

  /**
   * Låser side-skrollingen mens man er i chatten. Uten dette kan hele siden
   * skrolle bak/over meldingslisten (spesielt når tastaturet åpnes på iPhone).
   */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    window.scrollTo({ top: 0 });
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
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

  /**
   * Henter meldinger, ledere og reaksjoner. Kalles ved bytte av kanal, når
   * appen får fokus igjen, jevnlig i bakgrunnen og hver gang realtime kobler
   * til på nytt — slik at ingen meldinger blir hengende igjen usett.
   */
  const load = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      let periodId: string | null = null;
      if (channel === 'period') {
        const { data: period } = await supabase
          .from('periods')
          .select('id,name')
          .eq('is_active', true)
          .maybeSingle();
        periodId = period?.id ?? null;
        setPeriodLabel(period?.name ?? null);
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

      const list = (msgs || []) as ChatMessage[];
      setMessages(list);
      const map: Record<string, LeaderLite> = {};
      (lds || []).forEach((l: any) => { map[l.id] = l; });
      setLeaders(map);

      if (list.length > 0) {
        const { data: reacts } = await supabase
          .from('chat_message_reactions')
          .select('message_id, leader_id, emoji')
          .in('message_id', list.map((m) => m.id));
        setReactions((reacts ?? []) as ChatReaction[]);
      } else {
        setReactions([]);
      }

      if (opts.reset) scrollToBottom(true);
    },
    [channel],
  );

  useEffect(() => {
    setMessages([]);
    setReactions([]);
    setReplyTo(null);
    void load({ reset: true });
  }, [channel, load]);

  // Realtime + fallback: poll når fanen er synlig, og last på nytt ved fokus.
  useEffect(() => {
    const rt = supabase
      .channel(uniqueRealtimeChannelName(`chat-messages-${channel}`))
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as ChatReaction & { id?: string };
          if (!row?.message_id) return;
          setReactions((prev) => {
            const without = prev.filter(
              (r) =>
                !(
                  r.message_id === row.message_id &&
                  r.leader_id === row.leader_id &&
                  r.emoji === row.emoji
                ),
            );
            return payload.eventType === 'DELETE' ? without : [...without, row];
          });
        },
      )
      .subscribe((status) => {
        // Ny tilkobling kan ha mistet meldinger — hent alt på nytt.
        if (status === 'SUBSCRIBED') void load();
      });

    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      supabase.removeChannel(rt);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [channel, load]);

  /**
   * Ledere som kan tagges: periodechat = aktive, leirskole = kun de som er satt
   * opp på den aktive leirskoleuken, off season = alle med konto.
   */
  const taggableLeaders = useMemo(() => {
    const all = Object.values(leaders).filter((l) => !l.is_external);
    const pool =
      channel === 'period'
        ? all.filter((l) => l.is_active !== false)
        : channel === 'leirskole'
          ? all.filter((l) => leirskoleLeaderIds.has(l.id))
          : all;
    return pool.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }, [leaders, channel, leirskoleLeaderIds]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    const people = taggableLeaders
      .filter((l) => l.id !== leader?.id)
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .slice(0, 6);
    const showAll = !q || ALL_MENTION_NAME.startsWith(q);
    return showAll
      ? [{ id: ALL_MENTION_ID, name: ALL_MENTION_NAME, profile_image_url: null } as LeaderLite, ...people]
      : people;
  }, [mention, taggableLeaders, leader?.id]);

  /** Ledere som skal varsles: taggede + den du svarer på. */
  const mentionIdsFor = (body: string, replyingTo: ChatMessage | null) => {
    const everyone = hasAllMention(body);
    const ids = new Set(
      (everyone
        ? taggableLeaders.map((l) => l.id)
        : findMentionedLeaders(body, taggableLeaders).map((l) => l.id)),
    );
    if (replyingTo) ids.add(replyingTo.leader_id);
    ids.delete(leader?.id ?? '');
    return [...ids];
  };

  const notifyMentions = (messageId: string, mentions: string[]) => {
    // Alle meldinger varsler mottakerne — hvem som får det avgjøres server-side.
    // Feiler stille — en manglende push skal aldri hindre at meldingen er sendt.
    supabase.functions
      .invoke('push-chat-mention', { body: { message_id: messageId } })
      .catch((e) => console.warn('push-chat-mention failed', e));
  };

  const send = async () => {
    const body = input.trim();
    if (!body || !leader) return;
    const replyingTo = replyTo;
    setSending(true);
    nearBottomRef.current = true;
    const mentions = mentionIdsFor(body, replyingTo);
    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({
        leader_id: leader.id,
        body,
        channel,
        mentions,
        reply_to_id: replyingTo?.id ?? null,
      })
      .select('id')
      .maybeSingle();
    setSending(false);
    if (error) {
      // Vis den faktiske årsaken — den generiske teksten skjulte hva som feilet.
      console.error('chat insert failed', { channel, leaderId: leader.id, error });
      showError(
        channel === 'period'
          ? 'Kunne ikke sende melding i periodechatten'
          : 'Kunne ikke sende melding',
        error.message || 'Prøv igjen',
      );
      return;
    }
    setInput('');
    setMention(null);
    setReplyTo(null);
    // Reset textarea auto-grow
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    scrollToBottom(true);
    if (inserted?.id) notifyMentions(inserted.id, mentions);
    void load();
  };

  /** Send et bilde (med valgfri tekst som bildetekst). */
  const sendImage = async (file: File) => {
    if (!leader) return;
    const caption = input.trim();
    const replyingTo = replyTo;
    setUploading(true);
    nearBottomRef.current = true;
    try {
      const compressed = await compressImage(file);
      const ext = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${leader.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || 'image/jpeg' });
      if (upErr) throw upErr;

      const mentions = mentionIdsFor(caption, replyingTo);
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          leader_id: leader.id,
          body: caption,
          channel,
          mentions,
          image_path: path,
          reply_to_id: replyingTo?.id ?? null,
        })
        .select('id')
        .maybeSingle();
      if (error) {
        await supabase.storage.from(CHAT_BUCKET).remove([path]);
        throw error;
      }
      setInput('');
      setReplyTo(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      scrollToBottom(true);
      if (inserted?.id) notifyMentions(inserted.id, mentions);
      void load();
    } catch (e: any) {
      showError('Kunne ikke sende bildet', e?.message ?? 'Prøv igjen');
    } finally {
      setUploading(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!leader) return;
    const mine = reactions.some(
      (r) => r.message_id === messageId && r.leader_id === leader.id && r.emoji === emoji,
    );
    // Optimistisk — realtime bekrefter etterpå.
    setReactions((prev) =>
      mine
        ? prev.filter(
            (r) => !(r.message_id === messageId && r.leader_id === leader.id && r.emoji === emoji),
          )
        : [...prev, { message_id: messageId, leader_id: leader.id, emoji }],
    );
    const q = supabase.from('chat_message_reactions');
    const { error } = mine
      ? await q.delete().eq('message_id', messageId).eq('leader_id', leader.id).eq('emoji', emoji)
      : await q.insert({ message_id: messageId, leader_id: leader.id, emoji });
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      showError('Kunne ikke reagere', error.message);
      void load();
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
      className="-mx-4 -my-4 flex flex-col gap-2 overflow-hidden px-3 pt-2 pb-1 animate-fade-in lg:mx-0 lg:my-0 lg:px-0 lg:pt-0"
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
              : channel === 'leirskole'
                ? 'Leirskole — egen chat for leirskolelederne'
                : 'Off season — hele året'}
          </p>
        </div>
        {(canUsePeriodChat || canUseLeirskoleChat) && (
        <div className="flex shrink-0 gap-1 rounded-full border bg-card/60 p-0.5 backdrop-blur">
          {canUsePeriodChat && (
          <>
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
          </>
          )}
          {canUseLeirskoleChat && (
            <button
              type="button"
              onClick={() => setChannel('leirskole')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                channel === 'leirskole'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Leirskole
            </button>
          )}
        </div>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          className="h-full overflow-y-auto overscroll-contain rounded-2xl bg-muted/20 px-2.5 py-3 lg:px-3 lg:py-4"
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
            const quoted = msg.reply_to_id
              ? messages.find((m) => m.id === msg.reply_to_id)
              : undefined;
            const msgReactions = reactions.filter((r) => r.message_id === msg.id);
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
                  <div className={cn('flex items-center gap-1', isMe && 'flex-row-reverse')}>
                    <div
                      title={new Date(msg.created_at).toLocaleString('nb-NO')}
                      className={cn(
                        'min-w-0 rounded-2xl px-3 py-2 pb-1.5 text-sm whitespace-pre-wrap break-words shadow-sm',
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                        isMe && showHeader && 'rounded-tr-md',
                        !isMe && showHeader && 'rounded-tl-md',
                        mentionsMe && !isMe && 'ring-2 ring-primary/50',
                      )}
                    >
                      {quoted && (
                        <div
                          className={cn(
                            'mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[12px]',
                            isMe
                              ? 'border-primary-foreground/60 bg-primary-foreground/10'
                              : 'border-primary/60 bg-background/60',
                          )}
                        >
                          <span className="block font-semibold">
                            {quoted.leader_id === leader?.id
                              ? 'Deg'
                              : leaders[quoted.leader_id]?.name || 'Ukjent'}
                          </span>
                          <span className="line-clamp-2 opacity-80">
                            {quoted.body || (quoted.image_path ? '📷 Bilde' : '')}
                          </span>
                        </div>
                      )}
                      {msg.image_path && (
                        <div className="mb-1 -mx-1">
                          <ChatImage path={msg.image_path} />
                        </div>
                      )}
                      {msg.body && renderBody(msg, isMe)}
                      <span
                        className={cn(
                          'block text-[10px] leading-none mt-1',
                          isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground',
                        )}
                      >
                        {timeLabel(msg.created_at)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(msg);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                      aria-label="Svar på meldingen"
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <ChatReactions
                    reactions={msgReactions}
                    myLeaderId={leader?.id}
                    onToggle={(emoji) => toggleReaction(msg.id, emoji)}
                    align={isMe ? 'end' : 'start'}
                  />
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
          {replyTo && (
            <div className="mb-1.5 flex items-start gap-2 rounded-2xl border bg-card/70 px-3 py-2 backdrop-blur">
              <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-primary">
                  Svarer{' '}
                  {replyTo.leader_id === leader?.id
                    ? 'deg selv'
                    : leaders[replyTo.leader_id]?.name || 'Ukjent'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {replyTo.body || (replyTo.image_path ? '📷 Bilde' : '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Avbryt svar"
                className="rounded-full p-1 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

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
                    {l.id === ALL_MENTION_ID ? (
                      <>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-medium">
                          alle
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            varsler alle i chatten
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={l.profile_image_url || undefined} />
                          <AvatarFallback className="text-[10px]">{initials(l.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{l.name}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-3xl border bg-card/70 p-1.5 backdrop-blur shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void sendImage(file);
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !leader}
              aria-label="Send bilde"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                // Tastaturet dekker bunnen på iPhone — hopp ned igjen.
                nearBottomRef.current = true;
                window.scrollTo(0, 0);
                setTimeout(() => {
                  window.scrollTo(0, 0);
                  scrollToBottom(true);
                }, 120);
                setTimeout(() => {
                  window.scrollTo(0, 0);
                  scrollToBottom(true);
                }, 400);
              }}
              onClick={(e) => syncMention(input, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              placeholder={replyTo ? 'Skriv svaret…' : 'Skriv en melding…'}
              maxLength={4000}
              rows={1}
              disabled={sending || uploading || !leader}
              className="min-h-[36px] max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || uploading || !input.trim()}
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-full"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
