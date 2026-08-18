import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeRangeField, TimeRangePopover } from '@/components/ui/time-range-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, CalendarDays, ChevronDown, Clock, GripVertical, LayoutGrid, Lock, LockOpen, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { LeirskoleDayLeaderList } from '@/components/admin/LeirskoleDayLeaderList';
import { LeirskoleDaySessions } from '@/components/admin/LeirskoleDaySessions';
import { LeirskoleDayMatrix } from '@/components/admin/LeirskoleDayMatrix';
import { LeirskoleWeekImpact } from '@/components/admin/LeirskoleWeekImpact';
import { hhmm, shortDate, todayStr } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import {
  useLeirskoleKitchenDays,
  useLeirskoleSchedule,
  useLeirskoleWeekDays,
  useSetLeirskoleDayLock,
  useAddLeirskolePost,
  useDeleteLeirskolePost,
  useUpdateLeirskolePost,
} from '@/hooks/useLeirskole';

type DayPost = {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  crosses_midnight?: boolean | null;
  assignments: { id: string; staff_id: string }[];
};

type StaffRow = {
  id: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const minutes = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/** Overlapper to vakter i tid? Håndterer vakter over midnatt. */
function overlaps(a: DayPost, b: DayPost) {
  const range = (p: DayPost): [number, number] => {
    const s = minutes(p.start_time);
    let e = minutes(p.end_time);
    if (e <= s) e += 1440;
    return [s, e];
  };
  const [as, ae] = range(a);
  const [bs, be] = range(b);
  return as < be && bs < ae;
}

/** Lederbrikke som kan dras mellom øktene. */
function LeaderChip({
  dragId,
  name,
  imageUrl,
  hours,
  maxHours,
  warn,
  disabled,
  onRemove,
  actions,
}: {
  dragId: string;
  name: string;
  imageUrl?: string | null;
  hours: number;
  maxHours: number;
  warn?: string | null;
  disabled?: boolean;
  onRemove?: () => void;
  actions?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId, disabled });
  const over = hours > maxHours + 0.01;
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={`flex items-center gap-1.5 rounded-full border px-1.5 py-1 text-xs transition ${
        isDragging ? 'opacity-90 shadow-lg' : ''
      } ${over || warn ? 'border-destructive/60 bg-destructive/10' : 'border-border/60 bg-muted/40'}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Dra ${name}`}
        className="flex touch-none items-center gap-1.5"
      >
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
        <Avatar className="h-6 w-6">
          <AvatarImage src={imageUrl ?? undefined} alt={name} />
          <AvatarFallback className="text-[9px]">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="max-w-[7.5rem] truncate font-medium">{name}</span>
        <span className={`tabular-nums ${over ? 'font-bold text-destructive' : 'text-muted-foreground'}`}>
          {hours.toFixed(1)}/{maxHours}t
        </span>
      </button>
      {warn && (
        <span title={warn} className="shrink-0">
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </span>
      )}
      {actions}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Fjern ${name}`} className="shrink-0 p-0.5">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} rounded-2xl transition ${isOver ? 'ring-2 ring-primary' : ''}`}
    >
      {children}
    </div>
  );
}

/**
 * Rediger én dag: navn og tid på øktene, og dra ledere mellom øktene.
 * Lagres med en gang mot databasen.
 */
export function LeirskoleDayEditor({
  week,
  staff,
  weekBoard,
}: {
  week: { id: string; start_date: string; end_date: string; max_daily_hours: number | null };
  staff: StaffRow[];
  /** Ukeoversikten vises som egen fane inne i dag-til-dag. */
  weekBoard?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: kitchenDays } = useLeirskoleKitchenDays(week.id);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const setLock = useSetLeirskoleDayLock();
  const addPost = useAddLeirskolePost();
  const updatePost = useUpdateLeirskolePost();
  const deletePost = useDeleteLeirskolePost();

  const maxHours = Number(week.max_daily_hours ?? 8);
  const today = todayStr();

  const dates = useMemo(() => {
    const out: string[] = [];
    const d = new Date(`${week.start_date}T12:00:00`);
    const end = new Date(`${week.end_date}T12:00:00`);
    while (d <= end) {
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [week.start_date, week.end_date]);

  const [date, setDate] = useState<string>(() => (dates.includes(today) ? today : dates[0]));
  const activeDate = dates.includes(date) ? date : dates[0];
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'dag' | 'okter' | 'ledere' | 'rediger' | 'uke'>('okter');
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', start: '10:00', end: '12:00' });

  const dayPosts = useMemo(
    () =>
      ((posts ?? []) as DayPost[])
        .filter((p) => p.date === activeDate)
        .slice()
        .sort((a, b) => minutes(a.start_time) - minutes(b.start_time)),
    [posts, activeDate],
  );

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const kitchenIds = useMemo(
    () => new Set((kitchenDays ?? []).filter((k) => k.date === activeDate).map((k) => k.staff_id)),
    [kitchenDays, activeDate],
  );
  const isLocked = !!(weekDays ?? []).find((d) => d.date === activeDate)?.is_locked;
  const lockedDates = useMemo(
    () => new Set((weekDays ?? []).filter((d) => d.is_locked).map((d) => d.date)),
    [weekDays],
  );

  /** Timer per leder denne dagen. */
  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s) => map.set(s.id, kitchenIds.has(s.id) ? KITCHEN_DAY_HOURS : 0));
    dayPosts.forEach((p) =>
      p.assignments.forEach((a) =>
        map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0)),
      ),
    );
    return map;
  }, [staff, dayPosts, kitchenIds]);

  /** Dobbeltbooking: leder står på to økter som overlapper i tid. */
  const clashByStaff = useMemo(() => {
    const map = new Map<string, string>();
    dayPosts.forEach((p, i) => {
      dayPosts.slice(i + 1).forEach((q) => {
        if (!overlaps(p, q)) return;
        p.assignments.forEach((a) => {
          if (q.assignments.some((b) => b.staff_id === a.staff_id)) {
            map.set(a.staff_id, `Står både på ${p.name} og ${q.name}`);
          }
        });
      });
    });
    return map;
  }, [dayPosts]);

  const assignedIds = useMemo(
    () => new Set(dayPosts.flatMap((p) => p.assignments.map((a) => a.staff_id))),
    [dayPosts],
  );
  const pool = staff.filter((s) => !assignedIds.has(s.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
  };

  const assign = useMutation({
    mutationFn: async ({ fromPostId, toPostId, staffId }: { fromPostId?: string; toPostId?: string; staffId: string }) => {
      if (fromPostId) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('post_id', fromPostId)
          .eq('staff_id', staffId);
        if (error) throw error;
      }
      if (toPostId) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .insert({ post_id: toPostId, staff_id: staffId, assigned_manually: true, is_locked: true });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre vakten'),
  });

  const move = (staffId: string, fromPostId: string | undefined, toPostId: string | undefined) => {
    if (isLocked) {
      toast.error('Dagen er låst — åpne låsen for å endre.');
      return;
    }
    if (fromPostId === toPostId) return;
    if (toPostId && dayPosts.find((p) => p.id === toPostId)?.assignments.some((a) => a.staff_id === staffId)) return;
    assign.mutate({ fromPostId, toPostId, staffId });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const dragId = String(e.active.id);
    const dropId = e.over ? String(e.over.id) : null;
    if (!dropId) return;
    const [fromRaw, staffId] = dragId.split('|');
    const fromPostId = fromRaw === 'pool' ? undefined : fromRaw;
    const toPostId = dropId === 'pool' ? undefined : dropId.replace(/^post:/, '');
    move(staffId, fromPostId, toPostId);
  };

  const saveName = (p: DayPost, value: string) => {
    const name = value.trim();
    if (!name || name === p.name) return;
    updatePost.mutate({ id: p.id, name });
  };
  const saveTime = (p: DayPost, field: 'start_time' | 'end_time', value: string) => {
    if (!value || value === hhmm(p[field])) return;
    updatePost.mutate({ id: p.id, [field]: `${value}:00` });
  };

  const createPost = () => {
    if (!draft.name.trim()) {
      toast.error('Gi økten et navn');
      return;
    }
    addPost.mutate(
      {
        weekId: week.id,
        date: activeDate,
        name: draft.name,
        postType: 'other',
        startTime: `${draft.start}:00`,
        endTime: `${draft.end}:00`,
        requiredLeaders: 1,
      },
      {
        onSuccess: () => {
          setDraft({ name: '', start: '10:00', end: '12:00' });
          setNewOpen(false);
          toast.success('Økt lagt til');
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke legge til økten'),
      },
    );
  };

  return (
    <div className="oks-ls-pill oks-ls-stripe overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 p-4 text-left">
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">
          {activeDate === today ? 'I dag' : shortDate(activeDate)} · rediger dagen
        </span>
        <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {dayPosts.length} økter
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2.5 px-4 pb-4">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dates.map((d) => {
              const on = d === activeDate;
              const count = ((posts ?? []) as DayPost[]).filter((p) => p.date === d).length;
              const locked = lockedDates.has(d);
              return (
                <div
                  key={d}
                  className={`flex shrink-0 items-center gap-1 rounded-full pl-3 pr-1 py-1 text-[11px] font-semibold transition-colors ${
                    on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  <button type="button" onClick={() => setDate(d)} className="flex items-center gap-1">
                    {d === today ? 'I dag' : shortDate(d)}
                    <span className={`font-normal ${on ? 'text-primary-foreground/80' : ''}`}>{count}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={locked ? `Åpne ${shortDate(d)}` : `Lås ${shortDate(d)}`}
                    title={locked ? 'Låst — trykk for å åpne' : 'Åpen — trykk for å låse dagen'}
                    onClick={() => setLock.mutate({ weekId: week.id, date: d, locked: !locked })}
                    className={`rounded-full p-1 ${
                      locked ? (on ? 'bg-primary-foreground/20' : 'bg-background/80 text-primary') : 'opacity-60'
                    }`}
                  >
                    {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex rounded-full bg-muted/60 p-0.5">
            {[
              { key: 'okter' as const, label: 'Dagen', icon: Clock },
              { key: 'dag' as const, label: 'Rutenett', icon: LayoutGrid },
              { key: 'uke' as const, label: 'Hele uken', icon: CalendarDays },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  mode === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {mode !== 'uke' && (
            <LeirskoleWeekImpact
              dates={dates}
              posts={(posts ?? []) as DayPost[]}
              staff={staff}
              kitchenDays={(kitchenDays ?? []) as { date: string; staff_id: string }[]}
              maxHours={maxHours}
              onPickDate={setDate}
            />
          )}

          {mode === 'uke' && (
            <div className="-mx-4 overflow-x-auto lg:mx-[calc(50%-50vw)] lg:w-screen lg:px-4">{weekBoard}</div>
          )}

          {mode === 'dag' && (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {isLocked
                    ? 'Dagen er låst — åpne låsen for å endre.'
                    : 'Ledere bortover, økter nedover. Trykk i en rute for vakt og aktivitet.'}
                </p>
                <Button
                  size="sm"
                  variant={isLocked ? 'default' : 'outline'}
                  className="h-8 gap-1.5 rounded-full text-xs"
                  onClick={() => setLock.mutate({ weekId: week.id, date: activeDate, locked: !isLocked })}
                >
                  {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  {isLocked ? 'Låst' : 'Åpen'}
                </Button>
              </div>
              <LeirskoleDayMatrix
                week={week}
                date={activeDate}
                dayPosts={dayPosts}
                staff={staff}
                kitchenIds={kitchenIds}
                maxHours={maxHours}
                isLocked={isLocked}
              />
            </>
          )}

          {mode === 'okter' && (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {isLocked
                    ? 'Dagen er låst — åpne låsen for å endre.'
                    : 'Legg til ledere og aktiviteter rett i øktene.'}
                </p>
                <Button
                  size="sm"
                  variant={isLocked ? 'default' : 'outline'}
                  className="h-8 gap-1.5 rounded-full text-xs"
                  onClick={() => setLock.mutate({ weekId: week.id, date: activeDate, locked: !isLocked })}
                >
                  {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  {isLocked ? 'Låst' : 'Åpen'}
                </Button>
              </div>
              <LeirskoleDaySessions
                week={week}
                date={activeDate}
                dayPosts={dayPosts}
                weekPosts={(posts ?? []) as DayPost[]}
                staff={staff}
                kitchenIds={kitchenIds}
                maxHours={maxHours}
                isLocked={isLocked}
              />
            </>
          )}

          {mode === 'ledere' && (
            <LeirskoleDayLeaderList
              weekId={week.id}
              date={activeDate}
              posts={dayPosts}
              staff={staff}
              kitchenIds={kitchenIds}
              maxHours={maxHours}
            />
          )}

          {mode === 'rediger' && (
          <>
          <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {isLocked ? 'Dagen er låst — generatoren rører den ikke.' : 'Dra ledere mellom øktene for å endre.'}
            </p>
            <Button
              size="sm"
              variant={isLocked ? 'default' : 'outline'}
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={() => setLock.mutate({ weekId: week.id, date: activeDate, locked: !isLocked })}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              {isLocked ? 'Låst' : 'Åpen'}
            </Button>
          </div>

          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {dayPosts.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">Ingen økter denne dagen.</p>
            )}

            {dayPosts.map((p) => (
              <DropZone key={p.id} id={`post:${p.id}`} className="bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    defaultValue={p.name}
                    key={`${p.id}-${p.name}`}
                    onBlur={(e) => saveName(p, e.target.value)}
                    className="h-8 flex-1 rounded-xl text-sm font-semibold"
                    aria-label="Navn på økten"
                  />
                  <TimeRangePopover
                    start={hhmm(p.start_time)}
                    end={hhmm(p.end_time)}
                    onChange={({ start, end }) => {
                      if (start !== hhmm(p.start_time)) saveTime(p, 'start_time', start);
                      if (end !== hhmm(p.end_time)) saveTime(p, 'end_time', end);
                    }}
                  />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {Number(p.duration_hours ?? 0).toFixed(1)}t
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label="Slett økt"
                    onClick={() => {
                      if (isLocked) return toast.error('Dagen er låst.');
                      deletePost.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.assignments.length === 0 && (
                    <span className="text-xs text-muted-foreground">Slipp en leder her</span>
                  )}
                  {p.assignments.map((a) => {
                    const s = staffById.get(a.staff_id);
                    const name = s?.leader?.name ?? 'Leder';
                    return (
                      <LeaderChip
                        key={a.id}
                        dragId={`${p.id}|${a.staff_id}`}
                        name={name}
                        imageUrl={s?.leader?.profile_image_url}
                        hours={hoursByStaff.get(a.staff_id) ?? 0}
                        maxHours={maxHours}
                        warn={clashByStaff.get(a.staff_id) ?? null}
                        disabled={isLocked}
                        onRemove={() => move(a.staff_id, p.id, undefined)}
                        actions={
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="Flytt til annen økt" className="shrink-0 p-0.5">
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50">
                              <DropdownMenuLabel>Flytt {name} til</DropdownMenuLabel>
                              {dayPosts
                                .filter((q) => q.id !== p.id)
                                .map((q) => (
                                  <DropdownMenuItem key={q.id} onClick={() => move(a.staff_id, p.id, q.id)}>
                                    {q.name} · {hhmm(q.start_time)}
                                  </DropdownMenuItem>
                                ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => move(a.staff_id, p.id, undefined)}>
                                Fjern fra dagen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        }
                      />
                    );
                  })}
                </div>
              </DropZone>
            ))}

            <DropZone id="pool" className="border border-dashed border-border/60 bg-muted/20 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ledige ledere
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pool.length === 0 && <span className="text-xs text-muted-foreground">Alle er satt opp.</span>}
                {pool.map((s) => (
                  <LeaderChip
                    key={s.id}
                    dragId={`pool|${s.id}`}
                    name={s.leader?.name ?? 'Leder'}
                    imageUrl={s.leader?.profile_image_url}
                    hours={hoursByStaff.get(s.id) ?? 0}
                    maxHours={maxHours}
                    disabled={isLocked}
                    actions={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label="Sett på økt" className="shrink-0 p-0.5">
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50">
                          <DropdownMenuLabel>Sett på økt</DropdownMenuLabel>
                          {dayPosts.map((q) => (
                            <DropdownMenuItem key={q.id} onClick={() => move(s.id, undefined, q.id)}>
                              {q.name} · {hhmm(q.start_time)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
              </div>
            </DropZone>
          </DndContext>

          {newOpen ? (
            <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Navn på økten"
                className="h-9 rounded-xl text-sm"
              />
              <TimeRangeField
                start={draft.start}
                end={draft.end}
                onStartChange={(v) => setDraft((d) => ({ ...d, start: v }))}
                onEndChange={(v) => setDraft((d) => ({ ...d, end: v }))}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-full" onClick={createPost} disabled={addPost.isPending}>
                  Legg til
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setNewOpen(false)}>
                  Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 rounded-full"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="h-4 w-4" /> Ny økt denne dagen
            </Button>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
}
