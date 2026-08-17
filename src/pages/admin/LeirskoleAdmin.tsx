import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Play, Send, Trash2, Users, CalendarDays, Bell } from 'lucide-react';
import {
  useLeirskoleWeeks,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useGenerateLeirskoleSchedule,
} from '@/hooks/useLeirskole';

const hhmm = (t: string) => t.slice(0, 5);

export default function LeirskoleAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, leader } = useAuth();
  const { showError } = useStatusPopup();

  const { data: weeks, isLoading } = useLeirskoleWeeks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const week = useMemo(
    () => (weeks ?? []).find((w) => w.id === selectedId) ?? (weeks ?? []).find((w) => w.is_active) ?? (weeks ?? [])[0] ?? null,
    [weeks, selectedId],
  );

  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: posts } = useLeirskoleSchedule(week?.id);
  const generate = useGenerateLeirskoleSchedule();

  const [newWeek, setNewWeek] = useState({ name: '', start_date: '', end_date: '' });
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '' });
  const [taskAssignAll, setTaskAssignAll] = useState(true);
  const [taskLeaderIds, setTaskLeaderIds] = useState<string[]>([]);

  const { data: allLeaders } = useQuery({
    queryKey: ['leirskole-all-leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, profile_image_url')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['leirskole-admin-tasks', week?.id],
    enabled: !!week?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_tasks')
        .select('*')
        .eq('week_id', week!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
    qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-admin-tasks'] });
  };

  const createWeek = useMutation({
    mutationFn: async () => {
      if (!newWeek.name || !newWeek.start_date || !newWeek.end_date) throw new Error('Fyll ut navn og datoer');
      const { error } = await supabase.from('leirskole_weeks').insert(newWeek);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Uke opprettet');
      setNewWeek({ name: '', start_date: '', end_date: '' });
      invalidate();
    },
    onError: (e: any) => showError(e.message),
  });

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('leirskole_weeks').update({ is_active: false }).neq('id', id);
      const { error } = await supabase.from('leirskole_weeks').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Uken er aktiv'); invalidate(); },
    onError: (e: any) => showError(e.message),
  });

  const publish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase
        .from('leirskole_weeks')
        .update({ schedule_published_at: published ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      if (published) {
        const ids = (staff ?? []).map((s) => s.leader_id);
        if (ids.length) {
          await supabase.functions.invoke('push-send', {
            body: {
              title: 'Leirskole-vaktplan',
              message: 'Vaktplanen for leirskolen er publisert. Se dine vakter i appen.',
              url: '/leirskole',
              leader_ids: ids,
              include_inactive: true,
              sender_leader_id: leader?.id,
            },
          }).catch(() => null);
        }
      }
    },
    onSuccess: () => { toast.success('Oppdatert'); invalidate(); },
    onError: (e: any) => showError(e.message),
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ leaderId, add }: { leaderId: string; add: boolean }) => {
      if (!week) return;
      if (add) {
        const { error } = await supabase
          .from('leirskole_staff')
          .insert({ week_id: week.id, leader_id: leaderId, max_daily_hours: week.max_daily_hours ?? 8 });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_staff')
          .delete()
          .eq('week_id', week.id)
          .eq('leader_id', leaderId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => showError(e.message),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!week) throw new Error('Velg en uke');
      if (!taskDraft.title.trim()) throw new Error('Oppgaven må ha en tittel');
      if (!taskAssignAll && taskLeaderIds.length === 0) throw new Error('Velg minst én leder');
      const targets = taskAssignAll ? (staff ?? []).map((s) => s.leader_id) : taskLeaderIds;
      const { error } = await supabase.from('leirskole_tasks').insert({
        week_id: week.id,
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || null,
        assign_all: taskAssignAll,
        assigned_leader_ids: taskAssignAll ? null : taskLeaderIds,
        created_by: leader?.id ?? null,
      });
      if (error) throw error;
      const ids = targets;
      if (ids.length) {
        await supabase.functions.invoke('push-send', {
          body: {
            title: 'Ny leirskole-oppgave',
            message: taskDraft.title.trim(),
            url: '/leirskole',
            leader_ids: ids,
            include_inactive: true,
            sender_leader_id: leader?.id,
          },
        }).catch(() => null);
      }
    },
    onSuccess: () => {
      toast.success('Oppgave sendt');
      setTaskDraft({ title: '', description: '' });
      setTaskLeaderIds([]);
      invalidate();
    },
    onError: (e: any) => showError(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const runGenerator = async () => {
    if (!week) return;
    try {
      const res = await generate.mutateAsync({ weekId: week.id });
      const missing = res.stats?.missing?.length ?? 0;
      toast.success(
        missing === 0
          ? `Vaktplan generert — ${res.stats?.assigned ?? 0} vakter fordelt`
          : `Generert med ${missing} udekkede poster`,
      );
    } catch (e: any) {
      showError(e.message ?? 'Kunne ikke generere vaktplan');
    }
  };

  const staffIds = new Set((staff ?? []).map((s) => s.leader_id));
  const staffNames = new Map((staff ?? []).map((s) => [s.id, s.leader?.name ?? 'Ukjent']));

  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    (posts ?? []).forEach((p) => {
      p.assignments.forEach((a) => {
        map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      });
    });
    return map;
  }, [posts]);

  if (!isAdmin) {
    return <p className="py-16 text-center text-muted-foreground">Kun for admin.</p>;
  }

  return (
    <div className="space-y-5 animate-fade-in pb-8">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden lg:inline-flex">
        <ArrowLeft className="mr-2 h-4 w-4" /> Tilbake
      </Button>

      <div>
        <h1 className="text-2xl font-heading font-bold lg:text-3xl">Leirskole</h1>
        <p className="text-sm text-muted-foreground">Uker, ledere, vaktplan og oppgaver</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" /> Uker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(weeks ?? []).map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    week?.id === w.id ? 'bg-primary text-primary-foreground' : 'bg-card/60 text-muted-foreground'
                  }`}
                >
                  {w.name}
                  {w.is_active && ' ·  aktiv'}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Navn</Label>
              <Input value={newWeek.name} onChange={(e) => setNewWeek({ ...newWeek, name: e.target.value })} placeholder="Leirskole uke 34" />
            </div>
            <div>
              <Label className="text-xs">Fra</Label>
              <Input type="date" value={newWeek.start_date} onChange={(e) => setNewWeek({ ...newWeek, start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Til</Label>
              <Input type="date" value={newWeek.end_date} onChange={(e) => setNewWeek({ ...newWeek, end_date: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => createWeek.mutate()} disabled={createWeek.isPending} className="gap-2">
            <Plus className="h-4 w-4" /> Ny uke
          </Button>
        </CardContent>
      </Card>

      {week && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{week.name}</CardTitle>
              <CardDescription>
                {week.start_date} – {week.end_date} · maks {Number(week.max_daily_hours ?? 8)}t/dag · {Number(week.min_rest_hours ?? 11)}t hvile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {!week.is_active && (
                  <Button variant="secondary" onClick={() => setActive.mutate(week.id)}>Sett som aktiv</Button>
                )}
                <Button onClick={runGenerator} disabled={generate.isPending} className="gap-2">
                  <Play className="h-4 w-4" /> {generate.isPending ? 'Genererer…' : 'Generer vaktplan'}
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4 text-primary" />
                  Publisert for lederne
                </div>
                <Switch
                  checked={!!week.schedule_published_at}
                  onCheckedChange={(v) => publish.mutate({ id: week.id, published: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Ledere på leirskole ({staff?.length ?? 0})
              </CardTitle>
              <CardDescription>Trykk for å legge til eller fjerne</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(allLeaders ?? []).map((l) => {
                  const on = staffIds.has(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleStaff.mutate({ leaderId: l.id, add: !on })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        on ? 'bg-primary text-primary-foreground' : 'bg-card/60 text-muted-foreground'
                      }`}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
              {(staff ?? []).length > 0 && (
                <div className="space-y-1 pt-2">
                  {(staff ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card/40 px-3 py-1.5">
                      <span className="text-sm">{s.leader?.name}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {(hoursByStaff.get(s.id) ?? 0).toFixed(1)} t
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Oppgaver til lederne</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Tittel"
                value={taskDraft.title}
                onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
              />
              <Textarea
                placeholder="Beskrivelse (valgfritt)"
                value={taskDraft.description}
                onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })}
                rows={2}
              />
              <Button onClick={() => createTask.mutate()} disabled={createTask.isPending} className="gap-2">
                <Send className="h-4 w-4" /> Send oppgave + varsling
              </Button>

              <div className="space-y-1">
                {(tasks ?? []).map((t: any) => (
                  <div key={t.id} className="flex items-start justify-between gap-2 rounded-xl border bg-card/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteTask.mutate(t.id)} aria-label="Slett">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vaktplan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(posts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen vaktposter ennå — generatoren lager standardposter.</p>
              ) : (
                (posts ?? []).map((p) => (
                  <div key={p.id} className="rounded-xl border bg-card/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.date} · {p.name}</p>
                      <Badge variant="outline" className="tabular-nums">
                        {hhmm(p.start_time)}–{hhmm(p.end_time)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.assignments.length}/{p.required_leaders} ·{' '}
                      {p.assignments.map((a) => staffNames.get(a.staff_id) ?? '—').join(', ') || 'ingen'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
