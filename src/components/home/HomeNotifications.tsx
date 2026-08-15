import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Beer, Wine, GlassWater, Heart, MessageSquare, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMySips } from '@/hooks/useSips';
import { useMyHookups } from '@/hooks/useHookups';
import { useMyMatches } from '@/hooks/useLeaderSwipes';
import { useMyMailboxMessages } from '@/hooks/useMailbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DRINKS, type DrinkType } from '@/lib/drinkSounds';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  type: 'sip' | 'hookup' | 'match' | 'mailbox';
  title: string;
  subtitle?: string;
  image?: string | null;
  initials?: string;
  createdAt: string;
  action: () => void;
  icon: React.ReactNode;
};

const drinkEmoji: Record<DrinkType, string> = {
  beer: DRINKS.beer.emoji,
  wine: DRINKS.wine.emoji,
  drink: DRINKS.drink.emoji,
};

const drinkIcon: Record<DrinkType, typeof Beer> = {
  beer: Beer,
  wine: Wine,
  drink: GlassWater,
};

export function HomeNotifications() {
  const navigate = useNavigate();
  const { leader } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaderMap, setLeaderMap] = useState<Map<string, { name: string; image: string | null }>>(new Map());
  const { data: sipsData } = useMySips();
  const { incoming: hookups } = useMyHookups();
  const { data: matches = [] } = useMyMatches();
  const { data: mailboxMessages = [] } = useMyMailboxMessages();

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

    (sipsData?.received ?? [])
      .filter((sip) => !sip.opened_at)
      .forEach((sip) => {
        const DrinkIcon = drinkIcon[sip.drink_type] ?? Beer;
        list.push({
          id: `sip-${sip.id}`,
          type: 'sip',
          title: `${sip.fromName} har gitt deg ${sip.amount} ${DRINKS[sip.drink_type].noun}`,
          subtitle: sip.message || undefined,
          image: sip.fromImage,
          initials: sip.fromName.slice(0, 2).toUpperCase(),
          createdAt: sip.created_at,
          action: () => {
            setOpen(false);
            navigate('/slurker');
          },
          icon: <DrinkIcon className="h-4 w-4" />,
        });
      });

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

    matches.slice(0, 5).forEach((m) => {
      list.push({
        id: `match-${m.id}`,
        type: 'match',
        title: `Du har match med ${m.name}`,
        subtitle: 'Åpne chatten',
        image: m.profile_image_url,
        initials: m.name.slice(0, 2).toUpperCase(),
        createdAt: m.created_at,
        action: () => {
          setOpen(false);
          navigate('/kline-tinder');
        },
        icon: <Heart className="h-4 w-4 text-rose-500" />,
      });
    });

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
  }, [sipsData, hookups, matches, mailboxMessages, navigate]);

  const unreadCount = notifications.length;

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
          <SheetHeader className="pb-2 pr-10 text-left">
            <SheetTitle className="text-lg font-heading">Varslinger</SheetTitle>
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
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
