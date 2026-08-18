import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, ChefHat, ChevronDown, History, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { hhmm } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleActivityTypes,
  useSetLeirskoleLeaderActivity,
  useAddLeirskolePost,
  useDeleteLeirskolePost,
  useUpdateLeirskolePost,
} from '@/hooks/useLeirskole';

const MIN_REST_HOURS = 11;

export interface SessionPost {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  assignments: { id: string; staff_id: string }[];
}

interface StaffRow {
  id: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
}

/** Øktnavn -> økt-nøkkel i aktivitetstabellen (bakoverkompatibelt). */
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

/** Absolutt start/slutt i minutter fra ukestart, så midnattsvakter regnes riktig. */
function absRange(p: { date: string; start_time: string; end_time: string }) {
  const dayIdx = Math.floor(new Date(`${p.date}T12:00:00`).getTime() / 86_400_000);
  const start = dayIdx * 1440 + toMin(p.start_time);
  let end = dayIdx * 1440 + toMin(p.end_time);
  if (end <= start) end += 1440;
  return { start, end };
}

const PRESET_NAMES = ['Ankomst', 'Avreise', 'Økt 1', 'Økt 2', 'Økt 3', 'Nattevakt', 'Sanitas'];

/**
 * Dagsvisning: øktene nedover etter klokkeslett, med lederne som står på hver
 * økt, aktiviteten deres, og advarsler når noen får for mange timer eller
 * bryter 11-timers hvile.
 */
export function LeirskoleDaySessions({
  week,
  date,
  dayPosts,
  weekPosts,
  staff,
  kitchenIds,
  maxHours,
  isLocked,
}: {
  week: { id: string };
  date: string;
  dayPosts: SessionPost[];
  weekPosts: SessionPost[];
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
  const addPost = useAddLeirskolePost();
  const updatePost = useUpdateLeirskolePost();
  const deletePost = useDeleteLeirskolePost();

  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', start: '10:00', end: '12:00' });

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const sorted = useMemo(
    () => dayPosts.slice().sort((a, b) => toMin(a.start_time) - toMin(b.start_time)),
    [dayPosts],
  );

  const typeMap = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string | null }>();
    (types ?? []).forEach((t) => map.set(t.key, { label: t.label, emoji: t.emoji }));
    return map;
  }, [types]);

  /** `${leaderId}|${session}` -> aktivitet denne dagen. */
  const actByLeaderSession = useMemo(() => {
    const map = new Map<string, { activity: string; note: string | null }>();
    (activities ?? [])
      .filter((a) => a.date === date)
      .forEach((a) => map.set(`${a.leader_id}|${a.session}`, { activity: a.activity, note: a.note ?? null }));
    return map;
  }, [activities, date]);

  /** Hvor mange ganger lederen har hatt aktiviteten før denne dagen. */
  const doneBefore = useMemo(() => {
    const map = new Map<string, number>();
    (history ?? []).forEach((h) => {
      if (h.date >= date) return;
      map.set(`${h.leader_id}|${h.activity}`, (map.get(`${h.leader_id}|${h.activity}`) ?? 0) + 1);
    });
    return map;
  }, [history, date]);

  /** Timer per leder denne dagen (kjøkkendag teller som hel dag). */
  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s) => map.set(s.id, kitchenIds.has(s.id) ? KITCHEN_DAY_HOURS : 0));
    sorted.forEach((p) =>
      p.assignments.forEach((a) => map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0))),
    );
    return map;
  }, [staff, sorted, kitchenIds]);

  /** Vaktene til hver leder i hele uken — brukes til hvile/overlapp. */
  const shiftsByStaff = useMemo(() => {
    const map = new Map<string, SessionPost[]>();
    weekPosts.forEach((p) =>
      p.assignments.forEach((a) => map.set(a.staff_id, [...(map.get(a.staff_id) ?? []), p])),
    );
    return map;
  }, [weekPosts]);

  /**
   * Advarsler for én leder, eventuelt som om de i tillegg tok `extra`-vakten.
   * Gir samme svar for lederbrikkene og for lederplukkeren.
   */
  const warningsFor = (staffId: string, extra?: SessionPost): string[] => {
    const out: string[] = [];
    const extraHours = extra ? Number(extra.duration_hours ?? 0) : 0;
    const hours = (hoursByStaff.get(staffId) ?? 0) + extraHours;
    if (hours > maxHours + 0.01) out.push(`${hours.toFixed(1)}t denne dagen (maks ${maxHours}t)`);

    const shifts = [...(shiftsByStaff.get(staffId) ?? []), ...(extra ? [extra] : [])];
    const ranges = shifts.map((p) => ({ p, ...absRange(p) }));
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const a = ranges[i];
        const b = ranges[j];
        if (a.p.id === b.p.id) continue;
        if (a.start < b.end && b.start < a.end) {
          out.push(`Dobbeltbooket: ${a.p.name} og ${b.p.name}`);
          continue;
        }
        const gap = (a.start < b.start ? b.start - a.end : a.start - b.end) / 60;
        if (gap < MIN_REST_HOURS) {
          out.push(`Bare ${gap.toFixed(1)}t hvile mellom ${a.p.name} og ${b.p.name} (krav ${MIN_REST_HOURS}t)`);
        }
      }
    }
    if (kitchenIds.has(staffId) && (extra || shifts.length > 0)) out.push('Har kjøkken hele dagen');
    return Array.from(new Set(out));
  };

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

  const createPost = (name?: string) => {
    const value = (name ?? draft.name).trim();
    if (!value) return toast.error('Gi økten et navn');
    addPost.mutate(
      {
        weekId: week.id,
        date,
        name: value,
        postType: 'other',
        startTime: `${draft.start}:00`,
        endTime: `${draft.end}:00`,
        requiredLeaders: 1,
      },
      {
        onSuccess: () => {
          setDraft({ name: '', start: '10:00', end: '12:00' });
          setNewOpen(false);
          toast.success(`${value} lagt til`);
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke legge til økten'),
      },
    );
  };

  return (
    <div className="space-y-2.5">
      {sorted.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">Ingen økter denne dagen ennå.</p>
      )}

      {sorted.map((p) => {
        const session = sessionKey(p);
        const free = staff.filter((s) => s.leader && !p.assignments.some((a) => a.staff_id === s.id));
        return (
          <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-3">
            <div className="flex items-start gap-2">
              <div className="w-[4.6rem] shrink-0">
                <p className="text-sm font-bold tabular-nums">{hhmm(p.start_time)}</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">{hhmm(p.end_time)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {Number(p.duration_hours ?? 0).toFixed(1)}t
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Input
                    key={`${p.id}-${p.name}`}
                    defaultValue={p.name}
                    aria-label="Navn på økten"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === p.name) return;
                      if (!guard()) return;
                      updatePost.mutate({ id: p.id, name: v });
                    }}
                    className="h-8 flex-1 rounded-xl border-transparent bg-muted/40 px-2 text-sm font-bold"
                  />
                  <Input
                    type="time"
                    key={`${p.id}-s-${p.start_time}`}
                    defaultValue={hhmm(p.start_time)}
                    aria-label="Starttid"
                    onBlur={(e) => {
                      if (!e.target.value || e.target.value === hhmm(p.start_time)) return;
                      if (!guard()) return;
                      updatePost.mutate({ id: p.id, start_time: `${e.target.value}:00` });
                    }}
                    className="h-8 w-[5.6rem] rounded-xl text-xs tabular-nums"
                  />
                  <Input
                    type="time"
                    key={`${p.id}-e-${p.end_time}`}
                    defaultValue={hhmm(p.end_time)}
                    aria-label="Sluttid"
                    onBlur={(e) => {
                      if (!e.target.value || e.target.value === hhmm(p.end_time)) return;
                      if (!guard()) return;
                      updatePost.mutate({ id: p.id, end_time: `${e.target.value}:00` });
                    }}
                    className="h-8 w-[5.6rem] rounded-xl text-xs tabular-nums"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label="Slett økt"
                    onClick={() => guard() && deletePost.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="mt-2 space-y-1.5">
                  {p.assignments.length === 0 && (
                    <p className="text-xs text-muted-foreground">Ingen ledere på økten.</p>
                  )}
                  {p.assignments.map((a) => {
                    const s = staffById.get(a.staff_id);
                    const leaderId = s?.leader?.id;
                    const name = s?.leader?.name ?? 'Leder';
                    const hours = hoursByStaff.get(a.staff_id) ?? 0;
                    const warns = warningsFor(a.staff_id);
                    const act = leaderId ? actByLeaderSession.get(`${leaderId}|${session}`) : undefined;
                    const t = act ? typeMap.get(act.activity) : undefined;
                    const before = act && leaderId ? doneBefore.get(`${leaderId}|${act.activity}`) ?? 0 : 0;
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                          warns.length ? 'border-destructive/50 bg-destructive/5' : 'border-border/50 bg-muted/30'
                        }`}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={s?.leader?.profile_image_url ?? undefined} alt={name} />
                          <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold">{name}</span>
                            <span
                              className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                                hours > maxHours + 0.01 ? 'text-destructive' : 'text-muted-foreground'
                              }`}
                            >
                              {hours.toFixed(1)}/{maxHours}t
                            </span>
                            {kitchenIds.has(a.staff_id) && <ChefHat className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
                            {warns.length > 0 && (
                              <span title={warns.join('\n')} className="shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              </span>
                            )}
                          </div>

                          {/* Aktiviteten lederen har i denne økten */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="mt-0.5 flex max-w-full items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium"
                              >
                                <span>{t?.emoji ?? '＋'}</span>
                                <span className="truncate">{t?.label ?? act?.activity ?? 'Velg aktivitet'}</span>
                                {before > 0 && (
                                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                    <History className="h-2.5 w-2.5" />
                                    {before}×
                                  </span>
                                )}
                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="z-50 max-h-72 overflow-y-auto">
                              <DropdownMenuLabel>
                                Aktivitet for {name.split(' ')[0]} · {p.name}
                              </DropdownMenuLabel>
                              {(types ?? []).map((ty) => {
                                const n = leaderId ? doneBefore.get(`${leaderId}|${ty.key}`) ?? 0 : 0;
                                return (
                                  <DropdownMenuItem
                                    key={ty.key}
                                    onClick={() =>
                                      leaderId &&
                                      setActivity.mutate(
                                        {
                                          weekId: week.id,
                                          date,
                                          session,
                                          leaderId,
                                          activity: ty.key,
                                        },
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
                              {act && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      leaderId &&
                                      setActivity.mutate({
                                        weekId: week.id,
                                        date,
                                        session,
                                        leaderId,
                                        activity: null,
                                      })
                                    }
                                  >
                                    Fjern aktivitet
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {warns.length > 0 && (
                            <p className="mt-0.5 text-[10.5px] font-medium text-destructive">{warns[0]}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Fjern ${name}`}
                          className="shrink-0 p-1"
                          onClick={() => guard() && assign.mutate({ postId: p.id, staffId: a.staff_id, remove: true })}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    );
                  })}

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 rounded-full text-xs">
                        <UserPlus className="h-3.5 w-3.5" /> Legg til leder
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="z-50 max-h-80 w-72 overflow-y-auto p-1.5">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Ledige til {p.name}
                      </p>
                      {free
                        .slice()
                        .sort((x, y) => (hoursByStaff.get(x.id) ?? 0) - (hoursByStaff.get(y.id) ?? 0))
                        .map((s) => {
                          const warns = warningsFor(s.id, p);
                          const hours = hoursByStaff.get(s.id) ?? 0;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => guard() && assign.mutate({ postId: p.id, staffId: s.id })}
                              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60"
                            >
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader!.name} />
                                <AvatarFallback className="text-[10px]">{initials(s.leader!.name)}</AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">{s.leader!.name}</span>
                                {warns.length > 0 ? (
                                  <span className="block truncate text-[10.5px] font-medium text-destructive">
                                    {warns[0]}
                                  </span>
                                ) : (
                                  <span className="block text-[10.5px] text-muted-foreground">
                                    {hours.toFixed(1)}t i dag · blir {(hours + Number(p.duration_hours ?? 0)).toFixed(1)}t
                                  </span>
                                )}
                              </span>
                              {warns.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                            </button>
                          );
                        })}
                      {free.length === 0 && (
                        <p className="px-2 py-2 text-xs text-muted-foreground">Alle står allerede på økten.</p>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {newOpen ? (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, name: n }))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  draft.name === n ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Navn på økten (f.eks. Ankomst)"
            className="h-9 rounded-xl text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              className="h-9 flex-1 rounded-xl text-sm tabular-nums"
            />
            <Input
              type="time"
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              className="h-9 flex-1 rounded-xl text-sm tabular-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 rounded-full" disabled={addPost.isPending} onClick={() => createPost()}>
              Legg til økt
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setNewOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full gap-1.5 rounded-full" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> Ny økt (ankomst, avreise, aktivitet …)
        </Button>
      )}
    </div>
  );
}
