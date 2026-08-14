import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Loader2, MessageCircle, Sparkles, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SwipeCard } from '@/components/klineliste/SwipeCard';
import {
  useMyMatches,
  useSwipeCandidates,
  useSwipeLeader,
  useUnmatch,
} from '@/hooks/useLeaderSwipes';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { cn } from '@/lib/utils';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { MatchChatSheet } from '@/components/klineliste/MatchChatSheet';
import { useMatchUnread } from '@/hooks/useMatchChat';

type Tab = 'deck' | 'matches';

export default function KlineTinder() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('deck');
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [chat, setChat] = useState<{ id: string; name: string; image: string | null } | null>(null);

  const { candidates, isLoading } = useSwipeCandidates();
  const { data: matches = [] } = useMyMatches();
  const swipe = useSwipeLeader();
  const unmatch = useUnmatch();
  const { data: unread = {} } = useMatchUnread();

  const dismissedSet = new Set(dismissed);
  const deck = candidates.filter((c) => !dismissedSet.has(c.id));
  const visible = deck.slice(0, 3);

  const handleDecide = async (targetId: string, name: string, liked: boolean) => {
    setDismissed((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
    hapticImpact(liked ? 'medium' : 'light');
    try {
      const isMatch = await swipe.mutateAsync({ targetId, liked });
      if (isMatch) {
        setMatchName(name);
        hapticImpact('heavy');
      }
    } catch {
      setDismissed((prev) => prev.filter((id) => id !== targetId));
      toast.error('Klarte ikke å lagre sveipet');
    }
  };

  const handleSuperlike = () => {
    hapticImpact('light');
    toast.info('Superlike er en Øksnøen +-fordel');
    setPlusOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 px-4 pb-2 pt-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Tilbake"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-heading font-bold leading-tight">Kline-Tinder</h1>
          <p className="text-[11px] text-muted-foreground">
            Matcher havner ikke i klinelista – det må gjøres manuelt
          </p>
        </div>
      </header>

      <div className="px-4 pb-3">
        <div className="flex rounded-full border border-border/60 bg-card/60 p-1">
          {([
            ['deck', 'Sveip', Sparkles],
            ['matches', `Matcher${matches.length ? ` (${matches.length})` : ''}`, Heart],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as Tab)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] font-semibold transition-colors',
                tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24">
        {tab === 'deck' ? (
          isLoading ? (
            <div className="flex h-52 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <Users className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">Ingen flere ledere å sveipe</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Kom tilbake senere – nye ledere dukker opp utenfor sesong.
              </p>
            </div>
          ) : (
            <div className="relative mx-auto mt-1 h-[26rem] w-full max-w-sm">
              {visible
                .map((leader, i) => ({ leader, i }))
                .reverse()
                .map(({ leader, i }) => (
                  <SwipeCard
                    key={leader.id}
                    leader={leader}
                    depth={i}
                    interactive={i === 0}
                    onDecide={(liked) => handleDecide(leader.id, leader.name, liked)}
                    onSuperlike={handleSuperlike}
                  />
                ))}
            </div>
          )
        ) : matches.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
            <Heart className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">Ingen matcher ennå</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Begge må sveipe ja før det blir en match.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3"
              >
                <button
                  type="button"
                  onClick={() => setChat({ id: m.id, name: m.name, image: m.profile_image_url })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                {m.profile_image_url ? (
                  <img
                    src={m.profile_image_url}
                    alt={m.name}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {m.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {unread[m.id] ? `${unread[m.id]} nye meldinger` : 'Trykk for å chatte'}
                  </p>
                </div>
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setChat({ id: m.id, name: m.name, image: m.profile_image_url })}
                    aria-label={`Chat med ${m.name}`}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-primary"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {!!unread[m.id] && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {unread[m.id]}
                      </span>
                    )}
                  </button>
                <button
                  type="button"
                  onClick={() => unmatch.mutate(m.id)}
                  aria-label="Fjern match"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match-feiring */}
      {matchName && (
        <button
          type="button"
          onClick={() => setMatchName(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
        >
          <Heart className="h-14 w-14 text-rose-500" strokeWidth={2.4} />
          <p className="mt-3 text-2xl font-heading font-bold text-white">Det er match!</p>
          <p className="mt-1 text-center text-[13px] text-white/80">
            Du og {matchName} sveipet ja på hverandre. Klinelista må dere fikse selv.
          </p>
          <span className="mt-5 rounded-full bg-white/15 px-4 py-1.5 text-[12px] font-semibold text-white">
            Trykk for å fortsette
          </span>
        </button>
      )}

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />

      {chat && (
        <MatchChatSheet
          open
          matchId={chat.id}
          name={chat.name}
          imageUrl={chat.image}
          onClose={() => setChat(null)}
        />
      )}
    </div>
  );
}
