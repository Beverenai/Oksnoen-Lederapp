import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Heart, HeartCrack, Search, Sparkles, ArrowRightLeft } from 'lucide-react';

type LeaderLite = { id: string; name: string; profile_image_url: string | null };

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function LeaderChip({ leader }: { leader?: LeaderLite }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Avatar className="h-6 w-6 shrink-0">
        {leader?.profile_image_url ? <AvatarImage src={leader.profile_image_url} alt={leader.name} /> : null}
        <AvatarFallback className="text-[10px]">{initials(leader?.name ?? '?')}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{leader?.name ?? 'Ukjent'}</span>
    </span>
  );
}

export function TinderAdminTab() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'matches' | 'likes' | 'passes'>('matches');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tinder'],
    staleTime: 30_000,
    queryFn: async () => {
      const [leadersRes, matchesRes, swipesRes] = await Promise.all([
        supabase.from('leaders').select('id, name, profile_image_url'),
        supabase.from('leader_matches').select('*').order('created_at', { ascending: false }),
        supabase.from('leader_swipes').select('*').order('updated_at', { ascending: false }),
      ]);
      if (leadersRes.error) throw leadersRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (swipesRes.error) throw swipesRes.error;
      return {
        leaders: (leadersRes.data || []) as LeaderLite[],
        matches: matchesRes.data || [],
        swipes: swipesRes.data || [],
      };
    },
  });

  const leaderMap = useMemo(() => {
    const m = new Map<string, LeaderLite>();
    (data?.leaders || []).forEach((l) => m.set(l.id, l));
    return m;
  }, [data?.leaders]);

  const q = search.trim().toLowerCase();
  const nameOf = (id: string) => (leaderMap.get(id)?.name || '').toLowerCase();
  const matchHit = (a: string, b: string) => !q || nameOf(a).includes(q) || nameOf(b).includes(q);

  const matches = (data?.matches || []).filter((m: any) => matchHit(m.leader_a_id, m.leader_b_id));
  const likes = (data?.swipes || []).filter(
    (s: any) => s.liked && matchHit(s.swiper_leader_id, s.target_leader_id),
  );
  const passes = (data?.swipes || []).filter(
    (s: any) => !s.liked && matchHit(s.swiper_leader_id, s.target_leader_id),
  );

  const mutualKey = (a: string, b: string) => [a, b].sort().join('|');
  const matchSet = useMemo(
    () => new Set((data?.matches || []).map((m: any) => mutualKey(m.leader_a_id, m.leader_b_id))),
    [data?.matches],
  );

  // Hvem er mest populær (flest likes mottatt)
  const topLiked = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.swipes || []).forEach((s: any) => {
      if (s.liked) counts.set(s.target_leader_id, (counts.get(s.target_leader_id) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data?.swipes]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rows =
    tab === 'matches'
      ? matches.map((m: any) => ({
          id: m.id,
          left: m.leader_a_id,
          right: m.leader_b_id,
          date: m.created_at,
          mutual: true,
          arrow: 'both' as const,
        }))
      : (tab === 'likes' ? likes : passes).map((s: any) => ({
          id: s.id,
          left: s.swiper_leader_id,
          right: s.target_leader_id,
          date: s.updated_at || s.created_at,
          mutual: matchSet.has(mutualKey(s.swiper_leader_id, s.target_leader_id)),
          arrow: 'one' as const,
        }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Øksnøen Tinder
          </CardTitle>
          <CardDescription className="flex flex-wrap gap-2">
            <span>Matcher: {data?.matches.length ?? 0}</span>
            <span className="text-muted-foreground">•</span>
            <span>Likes: {(data?.swipes || []).filter((s: any) => s.liked).length}</span>
            <span className="text-muted-foreground">•</span>
            <span>Nei: {(data?.swipes || []).filter((s: any) => !s.liked).length}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topLiked.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Mest likt</p>
              <div className="flex flex-wrap gap-2">
                {topLiked.map(([id, count]) => (
                  <Badge key={id} variant="secondary" className="gap-1.5 py-1 pl-1 pr-2">
                    <LeaderChip leader={leaderMap.get(id)} />
                    <span className="text-xs opacity-70">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={tab === 'matches' ? 'default' : 'outline'} onClick={() => setTab('matches')} className="gap-1.5">
              <Heart className="h-4 w-4" /> Matcher ({matches.length})
            </Button>
            <Button size="sm" variant={tab === 'likes' ? 'default' : 'outline'} onClick={() => setTab('likes')} className="gap-1.5">
              <Heart className="h-4 w-4" /> Likes ({likes.length})
            </Button>
            <Button size="sm" variant={tab === 'passes' ? 'default' : 'outline'} onClick={() => setTab('passes')} className="gap-1.5">
              <HeartCrack className="h-4 w-4" /> Nei ({passes.length})
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk etter leder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="divide-y rounded-lg border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <LeaderChip leader={leaderMap.get(r.left)} />
                </div>
                {r.arrow === 'both' ? (
                  <ArrowRightLeft className="h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <span className="shrink-0 text-muted-foreground">→</span>
                )}
                <div className="min-w-0 flex-1">
                  <LeaderChip leader={leaderMap.get(r.right)} />
                </div>
                <div className="shrink-0 text-right">
                  {r.mutual && tab !== 'matches' && (
                    <Badge className="mb-0.5 bg-rose-500 hover:bg-rose-600">Match</Badge>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {r.date ? new Date(r.date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) : ''}
                  </p>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">Ingenting å vise her</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
