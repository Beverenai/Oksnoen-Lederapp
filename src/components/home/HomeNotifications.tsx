import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Heart, MessageSquare, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMyHookups } from '@/hooks/useHookups';
import { useMyMatches } from '@/hooks/useLeaderSwipes';
import { useMyMailboxMessages } from '@/hooks/useMailbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  type: 'hookup' | 'match' | 'mailbox';
  title: string;
  subtitle?: string;
  image?: string | null;
  initials?: string;
  createdAt: string;
  action: () => void;
  icon: React.ReactNode;
};

const SEEN_KEY = 'oks-home-notifications-seen';

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function HomeNotifications() {
  const navigate = useNavigate();
  const { leader, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>(() => readSeen());
  const [leaderMap, setLeaderMap] = useState<Map<string, { name: string; image: string | null }>>(new Map());
  const { incoming: hookupsRaw } = useMyHookups();
  const { data: matches = [] } = useMyMatches();
  const { data: mailboxMessages = [] } = useMyMailboxMessages();

  // Klineliste er skrudd av for vanlige ledere — kun admin får varsler derfra.
  const hookups = isAdmin ? hookupsRaw : [];

  useEffect(() => {
    const ids = Array.from(
      new Set(
        hookups.map((h) => (h.leader_a_id === leader?.id ? h.leader_b_id : h.leader_a_id)),
      ),
    ).filter(Boolean);
    if (!ids.length) {
      setLeaderMap(new Map());
      return;
    }
    let cancelled = false;
    supabase
      .from('leaders')
      .select('id, name, profile_image_url')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        const map = new Map<string, { name: string; image: string | null }>();
        (data ?? []).forEach((l) => map.set(l.id, { name: l.name, image: l.profile_image_url ?? null }));
        setLeaderMap(map);
      });
    return () => { cancelled = true; };
  }, [hookups, leader?.id]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    hookups.forEach((h) => {
      const otherId = h.leader_a_id === leader?.id ? h.leader_b_id : h.leader_a_id;
      const other = leaderMap.get(otherId);
      list.push({
        id: `hookup-${h.id}`,
        type: 'hookup',
        title: `${other?.name ?? 'Noen'} vil kline`,
        subtitle: 'Godta eller avslå i Klinelista',
        image: other?.image,
        initials: (other?.name ?? 'U').slice(0, 2).toUpperCase(),
        createdAt: h.created_at,
        action: () => {
          setOpen(false);
          navigate('/klinelista');
        },
        icon: <Heart className="h-4 w-4 text-rose-500" />,
      });
    });

    // Tinder er deaktivert, så match-varsler vises ikke lenger.

    mailboxMessages
      .filter((m) => !!m.admin_reply && !m.read_at)
      .slice(0, 3)
      .forEach((m) => {
        list.push({
          id: `mailbox-${m.id}`,
          type: 'mailbox',
          title: 'Svar på postkassen din',
          subtitle: m.admin_reply?.slice(0, 60) || undefined,
          createdAt: m.created_at,
          action: () => {
            setOpen(false);
            navigate('/postkasse');
          },
          icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
        });
      });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [hookups, leaderMap, leader?.id, matches, mailboxMessages, navigate]);

  const seenSet = useMemo(() => new Set(seen), [seen]);
  const unreadCount = notifications.filter((n) => !seenSet.has(n.id)).length;

  const markAllAsRead = useCallback(() => {
    if (notifications.length === 0) return;
    const ids = notifications.map((n) => n.id);
    setSeen((prev) => {
      const next = Array.from(new Set([...prev, ...ids])).slice(-300);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch { /* ignorer */ }
      return next;
    });
  }, [notifications]);

  /** Når man åpner varslene er de sett — badgen nullstilles. */
  useEffect(() => {
    if (!open || notifications.length === 0) return;
    markAllAsRead();
  }, [open, notifications, markAllAsRead]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Varslinger"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition active:scale-95"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
          <SheetHeader className="flex flex-row items-center justify-between pb-2 pr-10 text-left">
            <SheetTitle className="text-lg font-heading">Varslinger</SheetTitle>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Merk alle som lest
              </button>
            )}
          </SheetHeader>

          <div className="mt-2 space-y-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bell className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">Ingen nye varslinger</p>
                <p className="mt-1 text-xs opacity-70">Kom tilbake senere</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={n.action}
                  className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3 text-left transition hover:bg-muted"
                >
                  <div className="relative shrink-0">
                    {n.image ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={n.image} alt={n.title} />
                        <AvatarFallback className="text-xs">{n.initials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                        {n.icon}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                      {n.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium leading-tight', n.type === 'sip' && 'text-foreground')}>
                      {n.title}
                    </p>
                    {n.subtitle && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.subtitle}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {new Date(n.createdAt).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!seenSet.has(n.id) && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
