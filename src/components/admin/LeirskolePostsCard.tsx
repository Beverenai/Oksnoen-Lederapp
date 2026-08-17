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
import { CalendarClock, Play, Trash2, Lock, LockOpen, Moon, RefreshCw } from 'lucide-react';
import {
  useLeirskoleSchedule,
  useGenerateLeirskoleSchedule,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

type StaffRow = { id: string; leader_id: string; leader?: { name: string } | null };

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

/**
 * Vaktplan-generatoren for leirskole: vaktposter per dag, kjør generator
 * (maks t/dag + hviletid), og bytt leder manuelt på en vakt.
 */
export function LeirskolePostsCard({
  week,
  staff,
  readOnly = false,
}: {
  week: LeirskoleWeek;
  staff: StaffRow[];
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();
  const { leader } = useAuth();
  const { data: posts } = useLeirskoleSchedule(week.id);
  const generate = useGenerateLeirskoleSchedule();

  const [keepLocked, setKeepLocked] = useState(true);
  const [publishAfter, setPublishAfter] = useState(true);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
  };

  const staffName = (id: string) => staff.find((s) => s.id === id)?.leader?.name ?? 'Ukjent';

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
      if (publishAfter) await publishAndNotify();
    } catch (error: unknown) {
      showError(errorMessage(error, 'Kunne ikke generere vaktplan'));
    }
  };

  /**
   * Publiserer planen og varsler lederne — men kun de som faktisk er satt opp
   * på denne uken, og bare når uken er den aktive.
   */
  const publishAndNotify = async () => {
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

    const leaderIds = staff.map((s) => s.leader_id);
    if (!week.is_active || leaderIds.length === 0) {
      toast.info('Vaktplanen er publisert. Varsling sendes kun for den aktive uken.');
      return;
    }
    const { data, error: pushError } = await supabase.functions.invoke('push-send', {
      body: {
        title: 'Leirskole-vaktplan',
        message: 'Vaktplanen er klar — se dine vakter i appen.',
        leader_ids: leaderIds,
        sender_leader_id: leader?.id,
        url: '/leirskole',
        include_inactive: true,
      },
    });
    if (pushError || data?.error) toast.warning('Publisert, men varslingen kunne ikke sendes.');
    else toast.success(`Publisert og varslet ${leaderIds.length} ledere`);
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
            <span className="text-sm">Publiser og varsle lederne</span>
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

        {/* Timer per leder */}
        {staff.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => {
              const h = hoursByStaff.get(s.id) ?? 0;
              return (
                <Badge key={s.id} variant={h > 0 ? 'secondary' : 'outline'} className="tabular-nums text-[10.5px]">
                  {s.leader?.name ?? 'Ukjent'} · {h.toFixed(1)} t
                </Badge>
              );
            })}
          </div>
        )}

        {/* Dag for dag */}
        <div className="space-y-3">
          {byDay.map(([date, dayPosts]) => (
            <div key={date} className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{dayLabel(date)}</p>
              {dayPosts.map((p) => {
                const slots = Math.max(p.required_leaders ?? 1, p.assignments.length);
                return (
                  <div key={p.id} className="rounded-xl border bg-card/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.name} {p.is_night && <Moon className="inline h-3 w-3 text-muted-foreground" />}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {hhmm(p.start_time)}–{hhmm(p.end_time)} · {Number(p.duration_hours ?? 0).toFixed(1)} t
                        </p>
                      </div>
                      {!readOnly && (
                        <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => deletePost.mutate(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {readOnly ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.assignments.length ? (
                            p.assignments.map((assignment) => (
                              <Badge key={assignment.id} variant="secondary">
                                {staffName(assignment.staff_id)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Ingen leder satt opp</span>
                          )}
                        </div>
                      ) : Array.from({ length: slots }).map((_, i) => {
                        const a = p.assignments[i];
                        return (
                          <div key={a?.id ?? `empty-${i}`} className="flex items-center gap-2">
                            <Select
                              value={a?.staff_id ?? 'none'}
                              onValueChange={(v) => setAssignment.mutate({ postId: p.id, assignmentId: a?.id, staffId: v })}
                            >
                              <SelectTrigger className="h-8 flex-1 text-xs">
                                <SelectValue placeholder="Ingen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Ingen</SelectItem>
                                {staff.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.leader?.name ?? 'Ukjent'}</SelectItem>
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
                  </div>
                );
              })}
            </div>
          ))}
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
