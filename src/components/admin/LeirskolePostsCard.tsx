import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CalendarClock, Play, Trash2, Lock, LockOpen, Moon, RefreshCw, Pencil, UtensilsCrossed, Sun, AlertTriangle } from 'lucide-react';
import { LeaderAvatarStack } from '@/components/leirskole/LeaderAvatarStack';
import {
  useLeirskoleSchedule,
  useGenerateLeirskoleSchedule,
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
  const generate = useGenerateLeirskoleSchedule();

  const [keepLocked, setKeepLocked] = useState(true);
  const [publishAfter, setPublishAfter] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
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
    mutationFn: async ({ postId, assignmentId, staffId }: { postId: string; assignmentId?: string; staffId: string }) => {
      if (readOnly) throw new Error('Denne vaktplanen styres fra jobbplattformen');
      if (staffId === 'none') {
        if (!assignmentId) return;
        const { error } = await supabase.from('leirskole_assignments').delete().eq('id', assignmentId);
        if (error) throw error;
        return;
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
    },
    onSuccess: () => {
      toast.success('Vakt oppdatert');
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
                  <p className="text-sm font-bold text-white">{dayLabel(date)}</p>
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
                            {Array.from({ length: slots }).map((_, i) => {
                              const a = p.assignments[i];
                              return (
                                <div key={a?.id ?? `empty-${i}`} className="flex items-center gap-2">
                                  <Select
                                    value={a?.staff_id ?? 'none'}
                                    onValueChange={(v) =>
                                      setAssignment.mutate({ postId: p.id, assignmentId: a?.id, staffId: v })
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
