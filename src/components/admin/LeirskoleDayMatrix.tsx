import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, ChefHat, Check } from 'lucide-react';
import { hhmm } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleActivityTypes,
  useSetLeirskoleLeaderActivity,
} from '@/hooks/useLeirskole';
import type { SessionPost } from '@/components/admin/LeirskoleDaySessions';

interface StaffRow {
  id: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
}

const SESSION_BY_NAME: Record<string, string> = {
  'økt 1': 'formiddag',
  'økt 2': 'ettermiddag',
  'økt 3': 'kveld',
};
const sessionKey = (p: SessionPost) => SESSION_BY_NAME[(p.name ?? '').trim().toLowerCase()] ?? `post:${p.id}`;

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const toMin = (t: string) => {
  const [h, m] = (t ?? '00:00').slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Hele dagen i ett rutenett: lederne bortover horisontalt, øktene nedover.
 * Trykk i en rute for å sette lederen på økten, og velg aktivitet i samme meny.
 */
export function LeirskoleDayMatrix({
  week,
  date,
  dayPosts,
  staff,
  kitchenIds,
  maxHours,
  isLocked,
}: {
  week: { id: string };
  date: string;
  dayPosts: SessionPost[];
  staff: StaffRow[];
  kitchenIds: Set<string>;
  maxHours: number;
  isLocked: boolean;
}) {
  const qc = useQueryClient();
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: activities } = useLeirskoleActivities(week.id);
  const { data: history } = useLeirskoleActivityHistory();
  const setActivity = useSetLeirskoleLeaderActivity();

  const sorted = useMemo(
    () => dayPosts.slice().sort((a, b) => toMin(a.start_time) - toMin(b.start_time)),
    [dayPosts],
  );

  const cols = useMemo(
    () =>
      staff
        .filter((s) => s.leader)
        .slice()
        .sort((a, b) => (a.leader!.name ?? '').localeCompare(b.leader!.name ?? '', 'nb')),
    [staff],
  );

  const typeMap = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string | null }>();
    (types ?? []).forEach((t) => map.set(t.key, { label: t.label, emoji: t.emoji }));
    return map;
  }, [types]);

  const actByLeaderSession = useMemo(() => {
    const map = new Map<string, string>();
    (activities ?? [])
      .filter((a) => a.date === date)
      .forEach((a) => map.set(`${a.leader_id}|${a.session}`, a.activity));
    return map;
  }, [activities, date]);

  const doneBefore = useMemo(() => {
    const map = new Map<string, number>();
    (history ?? []).forEach((h) => {
      if (h.date >= date) return;
      map.set(`${h.leader_id}|${h.activity}`, (map.get(`${h.leader_id}|${h.activity}`) ?? 0) + 1);
    });
    return map;
  }, [history, date]);

  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s) => map.set(s.id, kitchenIds.has(s.id) ? KITCHEN_DAY_HOURS : 0));
    sorted.forEach((p) =>
      p.assignments.forEach((a) => map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0))),
    );
    return map;
  }, [staff, sorted, kitchenIds]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
  };

  const assign = useMutation({
    mutationFn: async ({ postId, staffId, remove }: { postId: string; staffId: string; remove?: boolean }) => {
      if (remove) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('post_id', postId)
          .eq('staff_id', staffId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('leirskole_assignments')
        .insert({ post_id: postId, staff_id: staffId, assigned_manually: true, is_locked: true });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre vakten'),
  });

  const guard = () => {
    if (isLocked) {
      toast.error('Dagen er låst — åpne låsen for å endre.');
      return false;
    }
    return true;
  };

  if (sorted.length === 0) {
    return <p className="py-3 text-center text-xs text-muted-foreground">Ingen økter denne dagen ennå.</p>;
  }

  const template = `5.6rem repeat(${cols.length}, minmax(4.6rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <div className="min-w-max">
        {/* Ledere bortover */}
        <div
          className="sticky top-0 z-10 grid items-end gap-px border-b border-border/60 bg-muted/60 px-1 py-1.5"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Økt</div>
          {cols.map((s) => {
            const hours = hoursByStaff.get(s.id) ?? 0;
            const over = hours > maxHours + 0.01;
            return (
              <div key={s.id} className="flex flex-col items-center gap-0.5 px-0.5">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={s.leader!.profile_image_url ?? undefined} alt={s.leader!.name} />
                  <AvatarFallback className="text-[9px]">{initials(s.leader!.name)}</AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[10px] font-bold leading-tight">
                  {s.leader!.name.split(' ')[0]}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-[9.5px] font-semibold tabular-nums ${
                    over ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {kitchenIds.has(s.id) && <ChefHat className="h-2.5 w-2.5 text-sky-500" />}
                  {hours.toFixed(1)}/{maxHours}t
                  {over && <AlertTriangle className="h-2.5 w-2.5" />}
                </span>
              </div>
            );
          })}
        </div>

        {/* Øktene nedover */}
        {sorted.map((p) => {
          const session = sessionKey(p);
          return (
            <div
              key={p.id}
              className="grid items-stretch gap-px border-b border-border/40 px-1 py-1 last:border-0"
              style={{ gridTemplateColumns: template }}
            >
              <div className="px-1 py-0.5">
                <p className="truncate text-[11px] font-bold leading-tight">{p.name}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {hhmm(p.start_time)}–{hhmm(p.end_time)}
                </p>
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {Number(p.duration_hours ?? 0).toFixed(1)}t
                </p>
              </div>

              {cols.map((s) => {
                const on = p.assignments.some((a) => a.staff_id === s.id);
                const leaderId = s.leader?.id;
                const activity = on && leaderId ? actByLeaderSession.get(`${leaderId}|${session}`) : undefined;
                const t = activity ? typeMap.get(activity) : undefined;
                const before = activity && leaderId ? doneBefore.get(`${leaderId}|${activity}`) ?? 0 : 0;
                return (
                  <DropdownMenu key={s.id}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${s.leader!.name} · ${p.name}`}
                        className={`flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-center transition-colors ${
                          on ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-muted/30 hover:bg-muted/60'
                        }`}
                      >
                        {on ? (
                          <>
                            <span className="text-base leading-none">{t?.emoji ?? '✓'}</span>
                            <span className="w-full truncate text-[9.5px] font-semibold leading-tight">
                              {t?.label ?? (activity ?? 'På vakt')}
                            </span>
                            {before > 0 && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {before}× før
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[15px] leading-none text-muted-foreground/50">+</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="z-50 max-h-72 w-56 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">
                        {s.leader!.name.split(' ')[0]} · {p.name}
                      </DropdownMenuLabel>
                      {!on && (
                        <DropdownMenuItem
                          onClick={() => guard() && assign.mutate({ postId: p.id, staffId: s.id })}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Sett på økten
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            blir {((hoursByStaff.get(s.id) ?? 0) + Number(p.duration_hours ?? 0)).toFixed(1)}t
                          </span>
                        </DropdownMenuItem>
                      )}
                      {on && (
                        <>
                          {(types ?? []).map((ty) => {
                            const n = leaderId ? doneBefore.get(`${leaderId}|${ty.key}`) ?? 0 : 0;
                            return (
                              <DropdownMenuItem
                                key={ty.key}
                                onClick={() =>
                                  leaderId &&
                                  guard() &&
                                  setActivity.mutate(
                                    { weekId: week.id, date, session, leaderId, activity: ty.key },
                                    { onError: () => toast.error('Kunne ikke lagre aktiviteten') },
                                  )
                                }
                              >
                                <span className="mr-1.5">{ty.emoji ?? '•'}</span>
                                {ty.label}
                                {n > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{n}× før</span>}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator />
                          {activity && (
                            <DropdownMenuItem
                              onClick={() =>
                                leaderId &&
                                guard() &&
                                setActivity.mutate({ weekId: week.id, date, session, leaderId, activity: null })
                              }
                            >
                              Fjern aktivitet
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => guard() && assign.mutate({ postId: p.id, staffId: s.id, remove: true })}
                          >
                            Ta av økten
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
