import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarClock, Play, Trash2, Lock, LockOpen, Moon, RefreshCw, Pencil, UtensilsCrossed, Sun, AlertTriangle, Plus, ChevronsLeftRight, EyeOff } from 'lucide-react';
import { LeaderAvatarStack } from '@/components/leirskole/LeaderAvatarStack';
import {
  useLeirskoleSchedule,
  useLeirskoleWeekDays,
  useGenerateLeirskoleSchedule,
  useAddLeirskolePost,
  useUpdateLeirskolePost,
  useShiftLeirskolePosts,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

type StaffRow = {
  id: string;
  leader_id: string;
  leader?: { id?: string; name: string; profile_image_url?: string | null } | null;
};

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const hhmm = (t: string) => t.slice(0, 5);

function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function dayLabel(d: string) {
  const x = parse(d);
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()}. ${MONTHS[x.getMonth()]}`;
}
function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const a = parse(start);
  const b = parse(end);
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

type PostKind = 'meal' | 'night' | 'shift';

function postKind(post: { post_type?: string | null; is_night?: boolean | null; name: string }): PostKind {
  if (post.is_night || post.post_type === 'night') return 'night';
  if (post.post_type === 'meal') return 'meal';
  return 'shift';
}

const KIND_STYLE: Record<PostKind, { ring: string; chip: string; icon: JSX.Element; label: string }> = {
  meal: {
    ring: 'border-[hsl(var(--oks-ls-green))]/45 bg-[hsl(var(--oks-ls-green))]/10',
    chip: 'bg-[hsl(var(--oks-ls-green))]/20 text-[hsl(var(--oks-ls-green))]',
    icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
    label: 'Måltid',
  },
  shift: {
    ring: 'border-[hsl(var(--oks-ls-blue))]/45 bg-[hsl(var(--oks-ls-blue))]/10',
    chip: 'bg-[hsl(var(--oks-ls-blue))]/20 text-[hsl(var(--oks-ls-blue))]',
    icon: <Sun className="h-3.5 w-3.5" />,
    label: 'Økt',
  },
  night: {
    ring: 'border-primary/40 bg-primary/10',
    chip: 'bg-primary/20 text-primary',
    icon: <Moon className="h-3.5 w-3.5" />,
    label: 'Natt',
  },
};

/**
 * Vaktplan-generatoren for leirskole: vaktposter per dag, kjør generator
 * (maks t/dag + hviletid), og bytt leder manuelt på en vakt.
 */
export function LeirskolePostsCard({
  week,
  staff,
  readOnly = false,
  onSelectStaff,
}: {
  week: LeirskoleWeek;
  staff: StaffRow[];
  readOnly?: boolean;
  onSelectStaff?: (staffId: string) => void;
}) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const generate = useGenerateLeirskoleSchedule();

  const [keepLocked, setKeepLocked] = useState(true);
  const [publishAfter, setPublishAfter] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [newPostDay, setNewPostDay] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', start: '20:00', end: '21:30', required: 2, type: 'main_shift' as 'meal' | 'main_shift' | 'night' | 'other', publish: false });
  const addPost = useAddLeirskolePost();
  const updatePost = useUpdateLeirskolePost();
  const shiftPosts = useShiftLeirskolePosts();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
  };

  const saveNewPost = async (date: string) => {
    if (!draft.name.trim()) {
      showError('Gi økten et navn');
      return;
    }
    try {
      await addPost.mutateAsync({
        weekId: week.id,
        date,
        name: draft.name,
        postType: draft.type,
        startTime: draft.start,
        endTime: draft.end,
        requiredLeaders: draft.required,
        isPublished: draft.publish,
      });
      toast.success(draft.publish ? 'Økt lagt inn' : 'Økt lagt inn som utkast');
      setNewPostDay(null);
      setDraft((d) => ({ ...d, name: '' }));
    } catch (error: unknown) {
      showError(errorMessage(error, 'Kunne ikke legge inn økten'));
    }
  };

  const shiftDay = async (date: string | null, minutes: number) => {
    try {
      const n = await shiftPosts.mutateAsync({ weekId: week.id, date, minutes });
      toast.success(`${n} vakter forskjøvet ${minutes > 0 ? '+' : ''}${minutes} min`);
    } catch (error: unknown) {
      showError(errorMessage(error, 'Kunne ikke forskyve vaktene'));
    }
  };

  const staffPerson = (id: string) => {
    const row = staff.find((s) => s.id === id);
    return { id, name: row?.leader?.name ?? 'Ukjent', imageUrl: row?.leader?.profile_image_url ?? null };
  };

  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    (posts ?? []).forEach((p) => {
      p.assignments.forEach((a) => {
        map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      });
    });
    return map;
  }, [posts]);

  const uncovered = useMemo(
    () => (posts ?? []).filter((p) => p.assignments.length < (p.required_leaders ?? 1)).length,
    [posts],
  );

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      if (readOnly) throw new Error('Denne vaktplanen styres fra jobbplattformen');
      const { error } = await supabase.from('leirskole_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: unknown) => showError(errorMessage(error, 'Kunne ikke slette vakten')),
  });

  const setAssignment = useMutation({
    mutationFn: async ({
      postId,
      assignmentId,
      staffId,
      remainingAfterRemoval,
    }: {
      postId: string;
      assignmentId?: string;
      staffId: string;
      remainingAfterRemoval?: number;
    }) => {
      if (readOnly) throw new Error('Denne vaktplanen styres fra jobbplattformen');
      if (staffId === 'none') {
        if (!assignmentId) return { removed: true } as const;
        const { error } = await supabase.from('leirskole_assignments').delete().eq('id', assignmentId);
        if (error) throw error;
        // Senk behovet slik at generatoren ikke fyller plassen igjen automatisk.
        if (remainingAfterRemoval != null) {
          await supabase
            .from('leirskole_posts')
            .update({ required_leaders: Math.max(0, remainingAfterRemoval) })
            .eq('id', postId);
        }
        return { removed: true } as const;
      }
      if (assignmentId) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .update({ staff_id: staffId, assigned_manually: true, is_locked: true })
          .eq('id', assignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_assignments')
          .insert({ post_id: postId, staff_id: staffId, assigned_manually: true, is_locked: true });
        if (error) throw error;
      }
      return { removed: false } as const;
    },
    onSuccess: async (result) => {
      invalidate();
      if (result?.removed) {
        toast.success('Vakten står nå tom');
        return;
      }
      // Manuelle endringer låses, og resten av planen balanseres på nytt slik
      // at en annen leder tar den vakten som ble frigjort.
      try {
        const res = await generate.mutateAsync({ weekId: week.id, keepLocked: true });
        const missing = res.stats?.missing?.length ?? 0;
        toast.success(
          missing === 0
            ? 'Vakt oppdatert — planen er rebalansert'
            : `Vakt oppdatert — ${missing} udekkede vakter igjen`,
        );
      } catch {
        toast.success('Vakt oppdatert');
      }
      invalidate();
    },
    onError: (error: unknown) => showError(errorMessage(error, 'Kunne ikke oppdatere vakten')),
  });

  const toggleLock = useMutation({
    mutationFn: async ({ id, locked }: { id: string; locked: boolean }) => {
      if (readOnly) throw new Error('Denne vaktplanen styres fra jobbplattformen');
      const { error } = await supabase.from('leirskole_assignments').update({ is_locked: locked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: unknown) => showError(errorMessage(error, 'Kunne ikke oppdatere låsen')),
  });

  const run = async () => {
    if (readOnly) {
      showError('Denne vaktplanen styres fra jobbplattformen');
      return;
    }
    if (staff.length === 0) {
      showError('Legg til ledere på uken før du genererer');
      return;
    }
    try {
      const res = await generate.mutateAsync({ weekId: week.id, keepLocked });
      const missing = res.stats?.missing?.length ?? 0;
      toast.success(
        missing === 0
          ? `Vaktplan generert — ${res.stats?.assigned ?? 0} vakter fordelt`
          : `Generert med ${missing} udekkede vakter`,
      );
      if (publishAfter) await publishSchedule();
    } catch (error: unknown) {
      showError(errorMessage(error, 'Kunne ikke generere vaktplan'));
    }
  };

  /**
   * Publiserer vaktplanen uten å sende varsling. Vaktplanen genereres én gang
   * i uken, så lederne sjekker den direkte i appen.
   */
  const publishSchedule = async () => {
    const { error } = await supabase
      .from('leirskole_weeks')
      .update({ schedule_published_at: new Date().toISOString() })
      .eq('id', week.id);
    if (error) {
      toast.warning('Vaktplanen ble generert, men kunne ikke publiseres.');
      return;
    }
    qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
    qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    toast.success('Vaktplanen er publisert');
  };

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof posts>>();
    (posts ?? []).forEach((p) => {
      groups.set(p.date, [...(groups.get(p.date) ?? []), p] as NonNullable<typeof posts>);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  const departureDays = useMemo(
    () => new Set((weekDays ?? []).filter((d) => d.day_type === 'departure').map((d) => d.date)),
    [weekDays],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Vaktplan
          {readOnly && <Badge variant="outline">Synkronisert</Badge>}
        </CardTitle>
        <CardDescription>
          {readOnly
            ? 'Vaktplanen hentes fra jobbplattformen og oppdateres ved neste synkronisering.'
            : `Maks ${Number(week.max_daily_hours ?? 8)} t/dag og ${Number(week.min_rest_hours ?? 11)} t hvile.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{posts?.length ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Vakter</p>
          </div>
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{staff.length}</p>
            <p className="text-[11px] text-muted-foreground">Ledere</p>
          </div>
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className={`text-lg font-bold tabular-nums ${uncovered ? 'text-destructive' : ''}`}>{uncovered}</p>
            <p className="text-[11px] text-muted-foreground">Udekket</p>
          </div>
        </div>

        {!readOnly && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Behold låste vakter</span>
            <Switch checked={keepLocked} onCheckedChange={setKeepLocked} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Publiser vaktplanen</span>
            <Switch checked={publishAfter} onCheckedChange={setPublishAfter} />
          </div>
          <Button className="w-full gap-2" onClick={run} disabled={generate.isPending || staff.length === 0}>
            <Play className="h-4 w-4" /> {generate.isPending ? 'Genererer…' : 'Generer vaktplan'}
          </Button>
          {!posts?.length && (
            <p className="text-[11px] text-muted-foreground">
              Ingen vakter er lagt inn — generatoren lager standardplan (frokost, økt 1–3, middag, kvelds og nattevakt)
              for alle dagene i uken, med maks {Number(week.max_daily_hours ?? 8)}t per leder per dag.
            </p>
          )}
          </div>
        )}

        {readOnly && (
          <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" /> Administreres i jobbplattformen
          </div>
        )}

        {!readOnly && (posts?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ChevronsLeftRight className="h-3.5 w-3.5" /> Forskyv hele uken
            </span>
            {[-60, -30, -15, 15, 30, 60].map((m) => (
              <Button key={m} size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => shiftDay(null, m)}>
                {m > 0 ? `+${m}` : m} min
              </Button>
            ))}
          </div>
        )}

        {/* Timer per leder — med ansikter */}
        {staff.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...staff]
              .sort((a, b) => (hoursByStaff.get(b.id) ?? 0) - (hoursByStaff.get(a.id) ?? 0))
              .map((s) => {
                const h = hoursByStaff.get(s.id) ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={onSelectStaff ? () => onSelectStaff(s.id) : undefined}
                    className={`flex items-center gap-2 rounded-full border px-2 py-1 text-left transition-colors ${
                      h > 0 ? 'border-primary/40 bg-primary/10' : 'bg-card/50'
                    }`}
                  >
                    <LeaderAvatarStack people={[staffPerson(s.id)]} size="sm" />
                    <span className="text-[11px] font-medium">{s.leader?.name?.split(' ')[0] ?? 'Ukjent'}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{h.toFixed(1)}t</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Dag for dag — visuelle kort */}
        <div className="space-y-3">
          {byDay.map(([date, dayPosts]) => {
            const dayHours = dayPosts.reduce(
              (sum, p) => sum + Number(p.duration_hours ?? 0) * p.assignments.length,
              0,
            );
            const dayMissing = dayPosts.filter((p) => p.assignments.length < (p.required_leaders ?? 1)).length;
            return (
              <div key={date} className="overflow-hidden rounded-2xl border bg-card/40">
                <div className="oks-ls-gradient flex items-center justify-between gap-2 px-3 py-2">
                  <p className="flex items-center gap-2 text-sm font-bold text-white">
                    {dayLabel(date)}
                    {departureDays.has(date) && (
                      <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                        Avreise
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {dayMissing > 0 && (
                      <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        {dayMissing} udekket
                      </span>
                    )}
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-white">
                      {dayHours.toFixed(1)} t
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-2.5">
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => setNewPostDay(newPostDay === date ? null : date)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Ny økt
                      </Button>
                      {[-30, -15, 15, 30].map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => shiftDay(date, m)}
                        >
                          {m > 0 ? `+${m}` : m}
                        </Button>
                      ))}
                    </div>
                  )}

                  {!readOnly && newPostDay === date && (
                    <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-2.5">
                      <Input
                        placeholder="Navn (f.eks. Økt 3 – Vannkrig)"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="h-8 text-xs" />
                        <Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="h-8 text-xs" />
                        <Input
                          type="number"
                          min={1}
                          value={draft.required}
                          onChange={(e) => setDraft({ ...draft, required: Number(e.target.value) || 1 })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as typeof draft.type })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_shift">Økt</SelectItem>
                          <SelectItem value="meal">Måltid</SelectItem>
                          <SelectItem value="night">Nattevakt</SelectItem>
                          <SelectItem value="other">Annet</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Publiser med en gang</span>
                        <Switch checked={draft.publish} onCheckedChange={(v) => setDraft({ ...draft, publish: v })} />
                      </div>
                      <Button size="sm" className="w-full" onClick={() => saveNewPost(date)} disabled={addPost.isPending}>
                        Legg til
                      </Button>
                    </div>
                  )}

                  {dayPosts.map((p) => {
                    const kind = postKind(p);
                    const style = KIND_STYLE[kind];
                    const required = p.required_leaders ?? 1;
                    const missing = Math.max(0, required - p.assignments.length);
                    const slots = Math.max(required, p.assignments.length);
                    const editing = editingPostId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border p-3 ${missing ? 'border-destructive/60 bg-destructive/10' : style.ring}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>
                                {style.icon} {style.label}
                              </span>
                              <p className="truncate text-sm font-semibold">{p.name}</p>
                              {(p as { is_published?: boolean }).is_published === false && (
                                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  <EyeOff className="h-3 w-3" /> Ikke satt
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                              {hhmm(p.start_time)}–{hhmm(p.end_time)} · {Number(p.duration_hours ?? 0).toFixed(1)} t ·{' '}
                              {p.assignments.length}/{required} ledere
                            </p>
                          </div>
                          {!readOnly && (
                            <div className="flex shrink-0 items-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className={editing ? 'text-primary' : 'text-muted-foreground'}
                                onClick={() => setEditingPostId(editing ? null : p.id)}
                                aria-label="Endre bemanning"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={() => deletePost.mutate(p.id)}
                                aria-label="Slett vakt"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5">
                          <LeaderAvatarStack
                            people={p.assignments.map((a) => staffPerson(a.staff_id))}
                            withNames
                            onSelect={onSelectStaff ? (person) => onSelectStaff(person.id) : undefined}
                            emptyLabel="Ingen leder satt opp"
                          />
                          {missing > 0 && (
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" /> Mangler {missing} leder
                              {missing === 1 ? '' : 'e'}
                            </p>
                          )}
                        </div>

                        {!readOnly && editing && (
                          <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5">
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                type="time"
                                defaultValue={hhmm(p.start_time)}
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  e.target.value !== hhmm(p.start_time) &&
                                  updatePost.mutate({ id: p.id, start_time: e.target.value })
                                }
                              />
                              <Input
                                type="time"
                                defaultValue={hhmm(p.end_time)}
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  e.target.value !== hhmm(p.end_time) &&
                                  updatePost.mutate({ id: p.id, end_time: e.target.value })
                                }
                              />
                              <Input
                                type="number"
                                min={0}
                                defaultValue={required}
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  Number(e.target.value) !== required &&
                                  updatePost.mutate({ id: p.id, required_leaders: Math.max(0, Number(e.target.value) || 0) })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-2.5 py-1.5">
                              <span className="text-xs">Publisert for lederne</span>
                              <Switch
                                checked={(p as { is_published?: boolean }).is_published !== false}
                                onCheckedChange={(v) => updatePost.mutate({ id: p.id, is_published: v })}
                              />
                            </div>
                            {Array.from({ length: slots }).map((_, i) => {
                              const a = p.assignments[i];
                              return (
                                <div key={a?.id ?? `empty-${i}`} className="flex items-center gap-2">
                                  <Select
                                    value={a?.staff_id ?? 'none'}
                                    onValueChange={(v) =>
                                      setAssignment.mutate({
                                        postId: p.id,
                                        assignmentId: a?.id,
                                        staffId: v,
                                        remainingAfterRemoval: Math.max(0, p.assignments.length - 1),
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 flex-1 text-xs">
                                      <SelectValue placeholder="Ingen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Ingen</SelectItem>
                                      {staff.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                          {s.leader?.name ?? 'Ukjent'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {a && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className={a.is_locked ? 'text-primary' : 'text-muted-foreground'}
                                      onClick={() => toggleLock.mutate({ id: a.id, locked: !a.is_locked })}
                                      title={a.is_locked ? 'Låst – beholdes ved ny generering' : 'Ulåst'}
                                    >
                                      {a.is_locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {byDay.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {readOnly ? 'Ingen vaktplan er hentet fra jobbplattformen ennå.' : 'Ingen vakter lagt inn for denne uken ennå.'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
