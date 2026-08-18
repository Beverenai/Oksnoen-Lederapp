import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimeRangeField } from '@/components/ui/time-range-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  ChefHat,
  History,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { hhmm } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import { countActivity, setActivityCount } from '@/lib/leirskoleCellInstances';
import { planSlots, splitPlanLines, SESSION_ROWS, type PlanSlot } from '@/lib/leirskolePlanSlots';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleActivityTypes,
  useLeirskoleWeekPlan,
  useSaveLeirskoleWeekPlanCell,
  useSetLeirskoleLeaderActivity,
  useAddLeirskolePost,
  useDeleteLeirskolePost,
  useUpdateLeirskolePost,
  useSetLeirskoleAssignmentNote,
  useSetLeirskoleKitchenDay,
} from '@/hooks/useLeirskole';

const MIN_REST_HOURS = 11;

export interface SessionPost {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  assignments: { id: string; staff_id: string; note?: string | null }[];
}

interface StaffRow {
  id: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
}

/** Øktnavn -> økt-nøkkel i aktivitetstabellen (bakoverkompatibelt). */
const SESSION_BY_NAME: Record<string, string> = Object.fromEntries(
  SESSION_ROWS.map((r) => [r.label.toLowerCase(), r.session]),
);

const sessionKey = (p: SessionPost) => SESSION_BY_NAME[(p.name ?? '').trim().toLowerCase()] ?? `post:${p.id}`;
const planRow = (p: SessionPost) =>
  SESSION_ROWS.find((r) => r.label.toLowerCase() === (p.name ?? '').trim().toLowerCase())?.row ?? null;

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

const MEAL_NAMES = new Set(['frokost', 'lunsj', 'middag', 'kvelds']);
const isMeal = (p: SessionPost) => MEAL_NAMES.has((p.name ?? '').trim().toLowerCase());
/** Måltider, sanitas og nattevakt trenger ingen aktivitet — bare øktene. */
const NO_ACTIVITY_NAMES = new Set([...MEAL_NAMES, 'sanitas', 'nattevakt']);
const hasActivities = (p: SessionPost) => !NO_ACTIVITY_NAMES.has((p.name ?? '').trim().toLowerCase());

/**
 * Dagsvisning: øktene nedover etter klokkeslett. Plassene i hver økt kommer fra
 * «Dag til dag» — «Klatring x2» gir to plasser — og hver plass har én leder
 * eller står tom. Kjøkkenvakten ligger nederst.
 */
export function LeirskoleDaySessions({
  week,
  date,
  dayPosts,
  weekPosts,
  staff,
  kitchenIds,
  kitchenHours,
  maxHours,
  isLocked,
}: {
  week: { id: string };
  date: string;
  dayPosts: SessionPost[];
  weekPosts: SessionPost[];
  staff: StaffRow[];
  kitchenIds: Set<string>;
  /** Timer for de som står på kjøkken denne dagen (standard 8t). */
  kitchenHours?: Map<string, number>;
  maxHours: number;
  isLocked: boolean;
}) {
  const qc = useQueryClient();
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: activities } = useLeirskoleActivities(week.id);
  const { data: history } = useLeirskoleActivityHistory();
  const { data: planCells } = useLeirskoleWeekPlan(week.id);
  const setActivity = useSetLeirskoleLeaderActivity();
  const saveCell = useSaveLeirskoleWeekPlanCell();
  const addPost = useAddLeirskolePost();
  const updatePost = useUpdateLeirskolePost();
  const deletePost = useDeleteLeirskolePost();
  const setNote = useSetLeirskoleAssignmentNote();
  const setKitchen = useSetLeirskoleKitchenDay();

  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', start: '10:00', end: '12:00' });
  const [noteKey, setNoteKey] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const staffByLeader = useMemo(() => {
    const map = new Map<string, StaffRow>();
    staff.forEach((s) => s.leader && map.set(s.leader.id, s));
    return map;
  }, [staff]);
  const kitchenList = useMemo(() => staff.filter((s) => kitchenIds.has(s.id)), [staff, kitchenIds]);

  const sorted = useMemo(
    () => dayPosts.slice().sort((a, b) => toMin(a.start_time) - toMin(b.start_time)),
    [dayPosts],
  );

  const typeMap = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string | null }>();
    (types ?? []).forEach((t) => map.set(t.key, { label: t.label, emoji: t.emoji }));
    return map;
  }, [types]);

  /** Aktivitetene denne dagen, gruppert på økt. */
  const actsBySession = useMemo(() => {
    const map = new Map<string, { leader_id: string; activity: string }[]>();
    (activities ?? [])
      .filter((a) => a.date === date)
      .forEach((a) =>
        map.set(a.session, [...(map.get(a.session) ?? []), { leader_id: a.leader_id, activity: a.activity }]),
      );
    return map;
  }, [activities, date]);

  /** Ruteinnholdet i «Dag til dag» — slått opp én gang per render. */
  const cellsForDay = useMemo(() => {
    const byRow = new Map<number, string | null | undefined>();
    const byPost = new Map<string, string | null | undefined>();
    (planCells ?? []).forEach((c) => {
      if (c.date !== date) return;
      if (c.row_index != null) byRow.set(c.row_index, c.content);
      if (c.post_id) byPost.set(c.post_id, c.content);
    });
    return { byRow, byPost };
  }, [planCells, date]);

  const linesForPost = (p: SessionPost) => {
    const row = planRow(p);
    const content = row != null ? cellsForDay.byRow.get(row) : cellsForDay.byPost.get(p.id);
    return splitPlanLines(content);
  };

  const saveLines = (p: SessionPost, lines: string[]) => {
    const row = planRow(p);
    saveCell.mutate(
      {
        weekId: week.id,
        date,
        rowIndex: row,
        postId: row == null ? p.id : null,
        content: lines.join('\n'),
        color: 'neutral',
      },
      { onError: () => toast.error('Kunne ikke lagre aktivitetene') },
    );
  };

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
    staff.forEach((s) => map.set(s.id, kitchenIds.has(s.id) ? kitchenHours?.get(s.id) ?? KITCHEN_DAY_HOURS : 0));
    sorted.forEach((p) =>
      p.assignments.forEach((a) => map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0))),
    );
    return map;
  }, [staff, sorted, kitchenIds, kitchenHours]);

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
   * 11-timers hvile gjelder mellom arbeidsdager, ikke innen samme dag.
   */
  const computeWarnings = (staffId: string, extra?: SessionPost): string[] => {
    const out: string[] = [];
    const extraHours = extra ? Number(extra.duration_hours ?? 0) : 0;
    const hours = (hoursByStaff.get(staffId) ?? 0) + extraHours;
    if (hours > maxHours + 0.01) out.push(`${hours.toFixed(1)}t denne dagen (planleggingsgrense ${maxHours}t)`);

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
        if (a.p.date === b.p.date) continue;
        const gap = (a.start < b.start ? b.start - a.end : a.start - b.end) / 60;
        if (gap < MIN_REST_HOURS) {
          out.push(
            `Bare ${gap.toFixed(1)}t hvile etter endt arbeidsdag mellom ${a.p.name} og ${b.p.name} (krav ${MIN_REST_HOURS}t)`,
          );
        }
      }
    }
    if (kitchenIds.has(staffId) && (extra || shifts.length > 0)) out.push('Har kjøkken hele dagen');
    return Array.from(new Set(out));
  };

  /** Advarslene uten ekstra vakt regnes bare én gang per leder. */
  const baseWarnings = useMemo(() => {
    const map = new Map<string, string[]>();
    staff.forEach((s) => map.set(s.id, computeWarnings(s.id)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, hoursByStaff, shiftsByStaff, kitchenIds, maxHours]);

  const warningsFor = (staffId: string, extra?: SessionPost): string[] =>
    extra ? computeWarnings(staffId, extra) : baseWarnings.get(staffId) ?? [];

  /** Ledere som kan settes på vanlige økter (ikke kjøkken). */
  const assignableStaff = useMemo(
    () => staff.filter((s) => s.leader && !kitchenIds.has(s.id)),
    [staff, kitchenIds],
  );

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

  /** Setter lederen på plassen: både vakt på økten og aktiviteten. */
  const fillSlot = (p: SessionPost, slot: PlanSlot, staffRow: StaffRow) => {
    if (!guard() || !staffRow.leader) return;
    const session = sessionKey(p);
    const onPost = p.assignments.some((a) => a.staff_id === staffRow.id);
    const applyActivity = () =>
      setActivity.mutate(
        { weekId: week.id, date, session, leaderId: staffRow.leader!.id, activity: slot.key },
        { onError: () => toast.error('Kunne ikke lagre aktiviteten') },
      );
    if (onPost) applyActivity();
    else assign.mutate({ postId: p.id, staffId: staffRow.id }, { onSuccess: () => { invalidate(); applyActivity(); } });
  };

  /** Tar lederen av plassen (men beholder vakten). */
  const clearSlot = (p: SessionPost, leaderId: string) => {
    if (!guard()) return;
    setActivity.mutate({ weekId: week.id, date, session: sessionKey(p), leaderId, activity: null });
  };

  /** Tar lederen helt av økten. */
  const removeFromPost = (p: SessionPost, staffId: string) => {
    if (!guard()) return;
    const leaderId = staffById.get(staffId)?.leader?.id;
    if (leaderId) setActivity.mutate({ weekId: week.id, date, session: sessionKey(p), leaderId, activity: null });
    assign.mutate({ postId: p.id, staffId, remove: true });
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

  /** Lederkort — brukes både i plassene og for de uten aktivitet. */
  const LeaderCard = ({
    p,
    staffId,
    assignmentId,
    note,
    activityKey,
    children,
  }: {
    p: SessionPost;
    staffId: string;
    assignmentId?: string;
    note?: string | null;
    activityKey?: string;
    children?: React.ReactNode;
  }) => {
    const s = staffById.get(staffId);
    const leaderId = s?.leader?.id;
    const name = s?.leader?.name ?? 'Leder';
    const hours = hoursByStaff.get(staffId) ?? 0;
    const warns = warningsFor(staffId);
    const before = activityKey && leaderId ? doneBefore.get(`${leaderId}|${activityKey}`) ?? 0 : 0;
    const cellKey = `${p.id}|${staffId}`;
    const free = assignableStaff.filter((x) => x.id !== staffId);
    return (
      <>
        {noteKey === cellKey && assignmentId ? (
          <Input
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Beskjed til lederen"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNoteKey(null);
              if (e.key !== 'Enter') return;
              if (!guard()) return;
              setNote.mutate(
                { assignmentId, note: noteText },
                { onError: () => toast.error('Kunne ikke lagre beskjeden') },
              );
              setNoteKey(null);
              setNoteText('');
            }}
            onBlur={() => setNoteKey(null)}
            className="h-7 rounded-full px-2 text-[10px]"
          />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Endre ${name} på ${p.name}`}
                className="w-full rounded-lg text-center transition-colors hover:bg-muted/40"
              >
                <Avatar className="mx-auto h-9 w-9">
                  <AvatarImage src={s?.leader?.profile_image_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="mt-0.5 block truncate text-[11px] font-bold leading-tight">
                  {name.split(' ')[0]}
                </span>
                <span className="flex items-center justify-center gap-0.5 text-[9.5px] font-semibold tabular-nums">
                  <span className={hours > maxHours + 0.01 ? 'text-destructive' : 'text-muted-foreground'}>
                    {hours.toFixed(1)}/{maxHours}t
                  </span>
                  {kitchenIds.has(staffId) && <ChefHat className="h-3 w-3 text-sky-500" />}
                  {warns.length > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  {before > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 text-emerald-700 dark:text-emerald-300">
                      <History className="h-2.5 w-2.5" />
                      {before}×
                    </span>
                  )}
                </span>
                {note && (
                  <span className="mt-1 flex w-full items-center justify-center gap-0.5 truncate rounded-full bg-primary/15 px-1 py-0.5 text-[9.5px] font-semibold text-primary">
                    <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{note}</span>
                  </span>
                )}
                {children}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              collisionPadding={12}
              className="z-50 max-h-[min(70vh,28rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
            >
              <DropdownMenuLabel className="text-[13px]">
                {name.split(' ')[0]} · {p.name}
              </DropdownMenuLabel>
              {activityKey && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                    Bytt til en annen leder på {typeMap.get(activityKey)?.label ?? activityKey}
                  </DropdownMenuLabel>
                  {free
                    .slice()
                    .sort((x, y) => (hoursByStaff.get(x.id) ?? 0) - (hoursByStaff.get(y.id) ?? 0))
                    .slice(0, 12)
                    .map((x) => (
                      <DropdownMenuItem
                        key={x.id}
                        className="gap-2 rounded-xl py-2 text-sm"
                        onClick={() => {
                          removeFromPost(p, staffId);
                          const slot: PlanSlot = {
                            id: activityKey,
                            key: activityKey,
                            label: typeMap.get(activityKey)?.label ?? activityKey,
                            emoji: typeMap.get(activityKey)?.emoji ?? null,
                            slot: 0,
                            leaderId: null,
                          };
                          fillSlot(p, slot, x);
                        }}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={x.leader?.profile_image_url ?? undefined} alt={x.leader!.name} />
                          <AvatarFallback className="text-[9px]">{initials(x.leader!.name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{x.leader!.name}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {(hoursByStaff.get(x.id) ?? 0).toFixed(1)}t
                        </span>
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-xl py-2 text-sm"
                    onClick={() => leaderId && clearSlot(p, leaderId)}
                  >
                    Gjør plassen ledig
                  </DropdownMenuItem>
                </>
              )}
              {assignmentId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-xl py-2 text-sm"
                    onClick={() => {
                      setNoteText(note ?? '');
                      setNoteKey(cellKey);
                    }}
                  >
                    <MessageSquare className="mr-1.5 h-4 w-4" />
                    {note ? 'Endre beskjed …' : 'Skriv beskjed …'}
                  </DropdownMenuItem>
                  {note && (
                    <DropdownMenuItem
                      className="rounded-xl py-2 text-sm"
                      onClick={() => guard() && setNote.mutate({ assignmentId, note: null })}
                    >
                      Fjern beskjed
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-xl py-2 text-sm text-destructive focus:text-destructive"
                onClick={() => removeFromPost(p, staffId)}
              >
                <X className="mr-1.5 h-4 w-4" /> Ta av økten
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {warns.length > 0 && (
          <p className="mt-0.5 line-clamp-2 text-[10px] font-medium text-destructive">{warns[0]}</p>
        )}
      </>
    );
  };

  /** Plukker som fyller en tom plass. */
  const SlotPicker = ({ p, slot }: { p: SessionPost; slot: PlanSlot }) => {
    const onPostIds = new Set(p.assignments.map((a) => a.staff_id));
    const candidates = assignableStaff
      .slice()
      .sort((x, y) => {
        const onX = onPostIds.has(x.id) ? 0 : 1;
        const onY = onPostIds.has(y.id) ? 0 : 1;
        return onX - onY || (hoursByStaff.get(x.id) ?? 0) - (hoursByStaff.get(y.id) ?? 0);
      });
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Velg leder til ${slot.label} på ${p.name}`}
            className="flex h-[3.4rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-amber-500/70 bg-amber-500/[0.09] text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Plus className="h-4 w-4" />
            <span className="text-[9.5px] font-bold">Mangler</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="z-50 max-h-[min(60vh,20rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
        >
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {slot.emoji ?? '•'} {slot.label} · {p.name}
          </p>
          {candidates.map((s) => {
            const warns = warningsFor(s.id, onPostIds.has(s.id) ? undefined : p);
            const hours = hoursByStaff.get(s.id) ?? 0;
            const n = s.leader ? doneBefore.get(`${s.leader.id}|${slot.key}`) ?? 0 : 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => fillSlot(p, slot, s)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader!.name} />
                  <AvatarFallback className="text-[10px]">{initials(s.leader!.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {s.leader!.name}
                    {onPostIds.has(s.id) && (
                      <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 text-[9.5px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                        på økten
                      </span>
                    )}
                  </span>
                  {warns.length > 0 ? (
                    <span className="block truncate text-[10.5px] font-medium text-destructive">{warns[0]}</span>
                  ) : (
                    <span className="block text-[10.5px] text-muted-foreground">
                      {hours.toFixed(1)}t i dag{n > 0 ? ` · ${n}× ${slot.label} før` : ''}
                    </span>
                  )}
                </span>
                {warns.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
              </button>
            );
          })}
          {candidates.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Ingen ledige ledere.</p>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[11px] text-muted-foreground">
        Plassene kommer fra «Dag til dag». Trykk på + for å sette en leder, eller på lederen for å bytte.
      </p>

      {sorted.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">Ingen økter denne dagen ennå.</p>
      )}

      {sorted.map((p) => {
        const session = sessionKey(p);
        const meal = isMeal(p);
        const withActivities = hasActivities(p);
        const lines = withActivities ? linesForPost(p) : [];
        const sessionActs = actsBySession.get(session) ?? [];
        const { slots, staleLeaderIds } = withActivities
          ? planSlots(lines, types ?? [], sessionActs)
          : { slots: [] as PlanSlot[], staleLeaderIds: [] as string[] };
        const slotLeaderIds = new Set(slots.map((s) => s.leaderId).filter(Boolean) as string[]);
        /** Ledere på økten som ikke har en plass i planen. */
        const withoutActivity = p.assignments.filter((a) => {
          const leaderId = staffById.get(a.staff_id)?.leader?.id;
          if (!withActivities) return true;
          return !leaderId || !slotLeaderIds.has(leaderId);
        });
        /** Tomme plasser i økten, eller måltid/vakt helt uten ledere. */
        const openSlots = slots.filter((s) => !s.leaderId).length;
        const missing = withActivities ? openSlots > 0 : p.assignments.length === 0;

        return (
          <div
            key={p.id}
            className={`rounded-2xl border p-2 ${
              missing
                ? 'border-amber-500/70 bg-amber-500/[0.09]'
                : meal
                  ? 'border-sky-500/40 bg-sky-500/[0.07]'
                  : 'border-emerald-500/40 bg-emerald-500/[0.07]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
                  meal ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {meal ? 'Måltid' : 'Økt'}
              </span>

              {missing && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  {withActivities ? `${openSlots} mangler leder` : 'Mangler ledere'}
                </span>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="min-w-0 flex-1 truncate px-1 text-left text-sm font-bold">
                    {p.name}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" collisionPadding={12} className="z-50 w-[min(20rem,calc(100vw-2rem))] space-y-2 p-2.5">
                  <Input
                    key={`${p.id}-${p.name}`}
                    defaultValue={p.name}
                    aria-label="Navn på økten"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === p.name || !guard()) return;
                      updatePost.mutate({ id: p.id, name: v });
                    }}
                    className="h-9 rounded-xl text-sm font-semibold"
                  />
                  <TimeRangeField
                    start={hhmm(p.start_time)}
                    end={hhmm(p.end_time)}
                    onStartChange={(v) => guard() && updatePost.mutate({ id: p.id, start_time: `${v}:00` })}
                    onEndChange={(v) => guard() && updatePost.mutate({ id: p.id, end_time: `${v}:00` })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full gap-1.5 rounded-full text-destructive"
                    onClick={() => guard() && deletePost.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Slett økten
                  </Button>
                </PopoverContent>
              </Popover>

              <span className="shrink-0 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {Number(p.duration_hours ?? 0).toFixed(1)}t
              </span>
              <span className="shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                {hhmm(p.start_time)}–{hhmm(p.end_time)}
              </span>
            </div>

            {/* Plassene fra «Dag til dag» */}
            {withActivities && (
              <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
                {slots.length === 0 && (
                  <p className="self-center text-[11px] text-muted-foreground">
                    Ingen aktiviteter i «Dag til dag» for denne økten.
                  </p>
                )}
                {slots.map((slot) => {
                  const staffRow = slot.leaderId ? staffByLeader.get(slot.leaderId) : undefined;
                  const a = staffRow ? p.assignments.find((x) => x.staff_id === staffRow.id) : undefined;
                  return (
                    <div
                      key={slot.id}
                      className="w-[6.1rem] rounded-xl border border-border/50 bg-background/70 p-1.5 text-center"
                    >
                      <p className="mb-1 truncate rounded-full bg-muted/60 px-1 py-0.5 text-[9.5px] font-semibold">
                        {slot.emoji ?? '•'} {slot.label}
                      </p>
                      {staffRow ? (
                        <LeaderCard
                          p={p}
                          staffId={staffRow.id}
                          assignmentId={a?.id}
                          note={a?.note ?? null}
                          activityKey={slot.key}
                        />
                      ) : (
                        <SlotPicker p={p} slot={slot} />
                      )}
                    </div>
                  );
                })}

                {/* Flere plasser legges inn i planen */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Legg til aktivitet i ${p.name}`}
                      className="flex h-8 shrink-0 items-center gap-1 self-center rounded-full border border-dashed border-border/70 px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Aktivitet
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" collisionPadding={12} className="z-50 w-[min(18rem,calc(100vw-2rem))] p-1">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Aktiviteter i {p.name}
                    </p>
                    <div className="max-h-72 space-y-0.5 overflow-y-auto">
                      {(types ?? []).map((t) => {
                        const count = countActivity(lines, t.label);
                        const text = `${t.emoji ?? ''} ${t.label}`.trim();
                        return (
                          <div
                            key={t.key}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                              count > 0 ? 'bg-primary/15 font-semibold' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => guard() && saveLines(p, setActivityCount(lines, t.label, text, count + 1))}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span>{t.emoji ?? '•'}</span>
                              <span className="flex-1 truncate">{t.label}</span>
                              {count > 0 && <span className="tabular-nums text-xs">×{count}</span>}
                            </button>
                            {count > 0 && (
                              <button
                                type="button"
                                aria-label={`Færre på ${t.label}`}
                                onClick={() => guard() && saveLines(p, setActivityCount(lines, t.label, text, count - 1))}
                                className="rounded-full bg-muted/70 p-0.5"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Ledere uten plass i planen (og lederlisten for måltid/sanitas/nattevakt) */}
            {(withoutActivity.length > 0 || !withActivities) && (
              <div
                className={`mt-1.5 flex flex-wrap items-start gap-1.5 rounded-xl p-1.5 ${
                  withActivities && withoutActivity.length > 0 ? 'border border-dashed border-amber-500/50 bg-amber-500/[0.06]' : ''
                }`}
              >
                {withActivities && withoutActivity.length > 0 && (
                  <p className="w-full px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Uten aktivitet
                  </p>
                )}
                {!withActivities && p.assignments.length === 0 && (
                  <p className="flex items-center gap-1 self-center rounded-full bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> Ingen ledere satt opp — legg til her
                  </p>
                )}
                {withoutActivity.map((a) => (
                  <div
                    key={a.id}
                    className="w-[6.1rem] rounded-xl border border-border/50 bg-background/70 p-1.5 text-center"
                  >
                    <LeaderCard p={p} staffId={a.staff_id} assignmentId={a.id} note={a.note ?? null} />
                  </div>
                ))}

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Legg til leder på ${p.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-dashed border-border/70 text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    collisionPadding={12}
                    className="z-50 max-h-[min(60vh,20rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
                  >
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ledige til {p.name}
                    </p>
                    {assignableStaff
                      .filter((s) => !p.assignments.some((x) => x.staff_id === s.id))
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
                                  {hours.toFixed(1)}t i dag · blir{' '}
                                  {(hours + Number(p.duration_hours ?? 0)).toFixed(1)}t
                                </span>
                              )}
                            </span>
                            {warns.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                          </button>
                        );
                      })}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {staleLeaderIds.length > 0 && (
              <p className="mt-1 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                Noen aktiviteter lå utenfor planen og er flyttet til «Uten aktivitet».
              </p>
            )}
          </div>
        );
      })}

      {/* Ny økt */}
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
          <TimeRangeField
            start={draft.start}
            end={draft.end}
            onStartChange={(v) => setDraft((d) => ({ ...d, start: v }))}
            onEndChange={(v) => setDraft((d) => ({ ...d, end: v }))}
          />
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

      {/* Kjøkkenvakt hele dagen — nederst. Kan ikke stå på vanlige økter samme dag. */}
      <div className="rounded-2xl border border-sky-500/40 bg-sky-500/[0.07] p-2">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Kjøkken
          </span>
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-bold">Kjøkkenvakt hele dagen</p>
          <span className="shrink-0 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {kitchenList.length} leder{kitchenList.length === 1 ? '' : 'e'}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {kitchenList.length === 0 && (
            <p className="self-center text-[11px] text-muted-foreground">Ingen på kjøkken denne dagen.</p>
          )}
          {kitchenList.map((s) => {
            const h = kitchenHours?.get(s.id) ?? KITCHEN_DAY_HOURS;
            return (
              <div
                key={s.id}
                className="flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-background/70 py-1 pl-1.5 pr-1"
              >
                <ChefHat className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                <Avatar className="h-6 w-6">
                  <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader?.name ?? 'Leder'} />
                  <AvatarFallback className="text-[9px]">{initials(s.leader?.name ?? 'L')}</AvatarFallback>
                </Avatar>
                <span className="max-w-[7rem] truncate text-xs font-semibold">{s.leader?.name?.split(' ')[0]}</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  aria-label={`Timer på kjøkken for ${s.leader?.name ?? 'leder'}`}
                  defaultValue={h}
                  key={`${s.id}-${h}`}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < 0 || v === h) return;
                    if (!guard()) return;
                    setKitchen.mutate(
                      { weekId: week.id, staffId: s.id, date, active: true, hours: v },
                      { onError: () => toast.error('Kunne ikke lagre timene') },
                    );
                  }}
                  className="h-6 w-11 rounded-full bg-muted/60 px-1.5 text-center text-[11px] font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] font-semibold text-muted-foreground">t</span>
                <button
                  type="button"
                  aria-label={`Fjern ${s.leader?.name ?? 'leder'} fra kjøkken`}
                  onClick={() =>
                    guard() &&
                    setKitchen.mutate(
                      { weekId: week.id, staffId: s.id, date, active: false },
                      { onError: () => toast.error('Kunne ikke fjerne kjøkkenvakten') },
                    )
                  }
                  className="shrink-0 p-0.5"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            );
          })}

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sett leder på kjøkken hele dagen"
                className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-dashed border-sky-500/60 text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-300"
              >
                <ChefHat className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={12}
              className="z-50 max-h-[min(60vh,20rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto p-1.5"
            >
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kjøkken hele dagen · {KITCHEN_DAY_HOURS}t
              </p>
              {staff
                .filter((s) => s.leader && !kitchenIds.has(s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      guard() &&
                      setKitchen.mutate(
                        { weekId: week.id, staffId: s.id, date, active: true, hours: KITCHEN_DAY_HOURS },
                        { onError: () => toast.error('Kunne ikke sette kjøkkenvakt') },
                      )
                    }
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader!.name} />
                      <AvatarFallback className="text-[10px]">{initials(s.leader!.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{s.leader!.name}</span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        Alle vaktene denne dagen fjernes
                      </span>
                    </span>
                  </button>
                ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
