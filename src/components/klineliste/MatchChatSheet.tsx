import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Heart, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useMarkMatchRead,
  useMatchMessages,
  useSendMatchMessage,
} from '@/hooks/useMatchChat';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  matchId: string;
  name: string;
  imageUrl: string | null;
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function MatchChatSheet({ open, onClose, matchId, name, imageUrl }: Props) {
  const { leader } = useAuth();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: messages = [], isLoading } = useMatchMessages(open ? matchId : null);
  const send = useSendMatchMessage(matchId);
  const markRead = useMarkMatchRead();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open && messages.length > 0) markRead.mutate(matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, open]);

  if (!open) return null;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await send.mutateAsync(body);
    } catch {
      setDraft(body);
      toast.error('Klarte ikke å sende meldingen');
    }
  };

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat med ${name}`}
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-background animate-in slide-in-from-bottom duration-200"
      style={{ height: '100dvh' }}
    >
      <header
        className="flex items-center gap-3 border-b border-border/60 px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, var(--safe-t, 0px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk chat"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
            {name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="text-[11px] text-muted-foreground">Privat matchchat</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
            <Heart className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-2 text-sm font-semibold">Si hei til {name.split(' ')[0]}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Bare dere to kan se denne samtalen.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_leader_id === leader?.id;
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug',
                      mine
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/60 bg-card text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {timeLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div
        className="flex items-end gap-2 border-t border-border/60 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, var(--safe-b, 0px))' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Skriv en melding…"
          className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-border/60 bg-card px-3 py-2 text-[14px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || send.isPending}
          aria-label="Send melding"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}