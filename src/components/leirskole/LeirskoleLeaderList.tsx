import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Phone, MessageSquare, Search, X, Users, Clock, Tent } from 'lucide-react';
import { SnusBadge } from '@/components/snus/SnusBadge';
import { useActiveLeirskoleWeek, useLeirskoleStaff, useLeirskoleSchedule } from '@/hooks/useLeirskole';
import { COMPETENCY_LABELS } from '@/lib/leirskoleCompetencies';
import { cn } from '@/lib/utils';

const hhmm = (t: string) => t.slice(0, 5);
const firstName = (n: string) => n.split(' ')[0];

/**
 * Lederliste i leirskole-modus: samme kortdesign som i sommerleir,
 * men bare de som jobber leirskole – med ringing, «jobber nå» og snusboks.
 */
export function LeirskoleLeaderList() {
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: staff, isLoading } = useLeirskoleStaff(week?.id);
  const { data: posts } = useLeirskoleSchedule(week?.id);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [onDutyOnly, setOnDutyOnly] = useState(false);

  // Hvem jobber nå + neste vakt per staff
  const { nowByStaff, nextByStaff } = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString('sv-SE');
    const clock = now.toTimeString().slice(0, 5);
    const nowMap = new Map<string, string>();
    const nextMap = new Map<string, string>();
    (posts ?? []).forEach((p) => {
      const start = hhmm(p.start_time);
      const end = hhmm(p.end_time);
      const isNow =
        p.date === today &&
        (p.crosses_midnight ? clock >= start || clock <= end : clock >= start && clock <= end);
      const isFuture = p.date > today || (p.date === today && start > clock);
      p.assignments.forEach((a) => {
        if (isNow) nowMap.set(a.staff_id, `${p.name} · ${start}–${end}`);
        else if (isFuture && !nextMap.has(a.staff_id)) {
          nextMap.set(a.staff_id, `${p.date.slice(8, 10)}.${p.date.slice(5, 7)} ${start}–${end} · ${p.name}`);
        }
      });
    });
    return { nowByStaff: nowMap, nextByStaff: nextMap };
  }, [posts]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (staff ?? [])
      .filter((s) => (q ? (s.leader?.name ?? '').toLowerCase().includes(q) : true))
      .filter((s) => (onDutyOnly ? nowByStaff.has(s.id) : true))
      .sort((a, b) => {
        const aNow = nowByStaff.has(a.id) ? 0 : 1;
        const bNow = nowByStaff.has(b.id) ? 0 : 1;
        if (aNow !== bNow) return aNow - bNow;
        return (a.leader?.name ?? '').localeCompare(b.leader?.name ?? '', 'nb');
      });
  }, [staff, search, onDutyOnly, nowByStaff]);

  if (weekLoading || isLoading) {
    return (
      <div className="space-y-3 px-4 animate-fade-in">
        <Skeleton className="h-8 w-32" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[128px] rounded-[24px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in overflow-x-hidden w-full min-w-0 px-4">
      <div className="flex items-center justify-between gap-2">
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter leder..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(false); setSearch(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Ledere</h1>
              <p className="text-sm text-muted-foreground">
                {week ? `${week.name} · ${list.length} av ${(staff ?? []).length} ledere` : 'Ingen aktiv uke'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setOnDutyOnly(false)}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-all',
            !onDutyOnly ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
          )}
        >
          Alle
        </button>
        <button
          onClick={() => setOnDutyOnly(true)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
            onDutyOnly
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          Jobber nå ({nowByStaff.size})
        </button>
      </div>

      <div className="grid gap-2">
        {list.map((s) => {
          const l = s.leader;
          const onDuty = nowByStaff.get(s.id);
          const next = nextByStaff.get(s.id);
          const comps = l?.leirskole_competencies ?? [];
          return (
            <Card key={s.id} className="overflow-hidden rounded-[24px] shadow-sm min-h-[128px]">
              <CardContent className="p-4 h-full flex items-center">
                <div className="flex items-center gap-3 w-full min-w-0">
                  <Avatar
                    className={cn(
                      'h-[72px] w-[72px] shrink-0 ring-offset-2 ring-offset-background ring-4',
                      onDuty ? 'ring-green-500' : 'ring-muted',
                    )}
                  >
                    {l?.profile_image_url && (
                      <AvatarImage src={l.profile_image_url} alt={l.name} loading="lazy" decoding="async" />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                      {firstName(l?.name ?? '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <h3 className="truncate text-[17px] font-bold leading-tight text-foreground">
                        {firstName(l?.name ?? 'Ukjent')}
                      </h3>
                      {(l as any)?.snus_user && (
                        <SnusBadge
                          productId={(l as any).snus_product_id}
                          customLabel={(l as any).snus_custom_label}
                          compact
                          className="shrink-0"
                        />
                      )}
                    </div>

                    {comps.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {comps.map((c) => (
                          <span
                            key={c}
                            className="flex h-4 items-center rounded-md border border-border bg-muted px-2 text-[10px] font-semibold leading-none text-muted-foreground"
                          >
                            {COMPETENCY_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}

                    {onDuty ? (
                      <div className="border-t border-border/50 pt-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                          <span className="truncate">{onDuty}</span>
                        </p>
                      </div>
                    ) : next ? (
                      <div className="border-t border-border/50 pt-1">
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{next}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="default"
                          size="icon"
                          className="h-11 w-11 rounded-full bg-green-600 text-white shadow-md transition-transform active:scale-90 hover:bg-green-700"
                          aria-label="Kontakt"
                        >
                          <Phone className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { window.location.href = `tel:${(l as any)?.phone ?? ''}`; }}>
                          <Phone className="mr-2 h-4 w-4 text-green-600" /> Ring
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { window.location.href = `sms:${(l as any)?.phone ?? ''}`; }}>
                          <MessageSquare className="mr-2 h-4 w-4 text-blue-600" /> Send SMS
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {list.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            {week ? (
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            ) : (
              <Tent className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            )}
            <h3 className="text-lg font-medium text-foreground">
              {week ? 'Ingen ledere funnet' : 'Ingen aktiv leirskoleuke'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {week ? 'Prøv et annet søk eller vis alle.' : 'Admin må sette en uke som aktiv.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
