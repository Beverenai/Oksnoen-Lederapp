import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, MessageSquare, Search, X, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SnusCanRotator, snusProductsFrom } from '@/components/snus/SnusCanRotator';
import { PeriodStamp, type StampEntry } from '@/components/passport/PeriodStamp';
import { OffSeasonLeaderSheet } from './OffSeasonLeaderSheet';

type OffSeasonLeader = {
  id: string;
  name: string;
  phone: string | null;
  profile_image_url: string | null;
  snus_user: boolean | null;
  snus_product_id: string | null;
  snus_product_ids: string[] | null;
  snus_custom_label: string | null;
};

/**
 * Off season-visning av Ledere: alle ledere (aktive og inaktive) i én liste,
 * med snusboks, passtempler og ring/SMS. Ingen periodedata.
 */
export function OffSeasonLeaderList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [snusOnly, setSnusOnly] = useState(false);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['offseason-leaders'],
    queryFn: async () => {
      const [leadersRes, periodsRes] = await Promise.all([
        supabase
          .from('leaders')
          .select('id, name, phone, profile_image_url, snus_user, snus_product_id, snus_product_ids, snus_custom_label')
          .order('name'),
        supabase.from('leader_service_periods').select('leader_id, year, period_code'),
      ]);

      const stamps = new Map<string, StampEntry[]>();
      ((periodsRes.data as any[]) ?? []).forEach((r) => {
        const list = stamps.get(r.leader_id) ?? [];
        const key = `${r.year}-${r.period_code}`;
        if (!list.some((s) => s.key === key)) {
          list.push({ key, year: r.year, periodCode: String(r.period_code) });
        }
        stamps.set(r.leader_id, list);
      });
      stamps.forEach((list, id) =>
        stamps.set(id, [...list].sort((a, b) => b.year - a.year)),
      );

      const leaders = (((leadersRes.data as any[]) ?? []) as OffSeasonLeader[]).filter(
        (l) => l.name.toLowerCase() !== 'superadmin',
      );
      return { leaders, stamps };
    },
    staleTime: 5 * 60 * 1000,
  });

  const leaders = data?.leaders ?? [];
  const stamps = data?.stamps;

  const filtered = useMemo(() => {
    let result = leaders;
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((l) => l.name.toLowerCase().includes(q));
    if (snusOnly) result = result.filter((l) => l.snus_user);
    return result;
  }, [leaders, searchQuery, snusOnly]);

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 animate-fade-in">
        <Skeleton className="h-8 w-28" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        {isSearchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Søk etter leder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Ledere</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} av {leaders.length} ledere
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSnusOnly((v) => !v)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  snusOnly
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Snuser
              </button>
              <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-2">
        {filtered.map((leader) => {
          const cans = snusProductsFrom(
            leader.snus_user
              ? leader.snus_product_ids?.length
                ? leader.snus_product_ids
                : [leader.snus_product_id]
              : [],
            leader.snus_user ? leader.snus_custom_label : null,
          );
          const leaderStamps = (stamps?.get(leader.id) ?? []).slice(0, 3);

          return (
            <Card
              key={leader.id}
              className="cursor-pointer overflow-hidden rounded-[24px] shadow-sm transition-transform active:scale-[0.98]"
              onClick={() => setSelectedLeaderId(leader.id)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-[64px] w-[64px] shrink-0 ring-2 ring-border ring-offset-2 ring-offset-background">
                  {leader.profile_image_url && (
                    <AvatarImage
                      src={leader.profile_image_url}
                      alt={leader.name}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                    {leader.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[17px] font-bold leading-tight text-foreground">
                    {leader.name}
                  </h3>
                  {leaderStamps.length > 0 ? (
                    <div className="mt-1 flex items-center gap-0.5">
                      {leaderStamps.map((s) => (
                        <PeriodStamp key={s.key} entry={s} size={34} animate={false} />
                      ))}
                      {(stamps?.get(leader.id)?.length ?? 0) > 3 && (
                        <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                          +{(stamps?.get(leader.id)?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Ingen stempler ennå</p>
                  )}
                </div>

                {cans.length > 0 && (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <SnusCanRotator
                      productIds={
                        leader.snus_product_ids?.length
                          ? leader.snus_product_ids
                          : [leader.snus_product_id]
                      }
                      customLabel={leader.snus_custom_label}
                      size={52}
                      interactive={false}
                    />
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-full bg-green-600 text-white shadow-md transition-transform active:scale-90 hover:bg-green-700"
                      aria-label="Kontakt"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      disabled={!leader.phone}
                      onClick={() => {
                        if (leader.phone) window.location.href = `tel:${leader.phone}`;
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4 text-green-600" />
                      Ring
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!leader.phone}
                      onClick={() => {
                        if (leader.phone) window.location.href = `sms:${leader.phone}`;
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4 text-blue-600" />
                      Send SMS
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">Ingen ledere funnet</h3>
          </CardContent>
        </Card>
      )}

      <OffSeasonLeaderSheet
        leaderId={selectedLeaderId}
        onOpenChange={(open) => !open && setSelectedLeaderId(null)}
      />
    </div>
  );
}
