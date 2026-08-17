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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Play, Send, Trash2, Users, CalendarDays, Bell, RefreshCw, Link2, CheckCircle2 } from 'lucide-react';
import {
  useLeirskoleWeeks,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useGenerateLeirskoleSchedule,
} from '@/hooks/useLeirskole';

const hhmm = (t: string) => t.slice(0, 5);
const formatDue = (value: string) =>
  new Intl.DateTimeFormat('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

type JobSyncResult = {
  weeks: number;
  linked: number;
  already_linked: number;
  removed: number;
  posts: number;
  assignments: number;
  skipped_assignments: number;
  unmatched: Array<{ external_ref: string; name: string; email: string | null; phone: string | null; week: string }>;
  errors: string[];
};

async function syncFromJobb() {
  const { data, error } = await supabase.functions.invoke('sync-leirskole-jobb');
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as JobSyncResult;
}

async function sendLeirskolePush(body: {
  title: string;
  message: string;
  leader_ids: string[];
  sender_leader_id?: string;
}) {
  const { data, error } = await supabase.functions.invoke('push-send', {
    body: { ...body, url: '/leirskole', include_inactive: true },
  });
  if (error || data?.error) return 'Endringen ble lagret, men varslingen kunne ikke sendes.';
  if (!data?.sent) return 'Endringen ble lagret, men ingen enheter mottok varslingen.';
  if (data.failed || data.nativeSkipped) {
    return `Endringen ble lagret. ${data.sent} varslinger ble sendt, men noen enheter feilet.`;
  }
  return null;
}

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
  const isImportedWeek = !!week?.external_ref;

  const [newWeek, setNewWeek] = useState({ name: '', start_date: '', end_date: '' });
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', due_at: '' });
  const [taskAssignAll, setTaskAssignAll] = useState(true);
  const [taskLeaderIds, setTaskLeaderIds] = useState<string[]>([]);

  const { data: allLeaders } = useQuery({
    queryKey: ['leirskole-all-leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, email, phone, profile_image_url')
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
      if (!data?.length) return [];

      const { data: completions, error: completionsError } = await supabase
        .from('leirskole_task_completions')
        .select('task_id, leader_id, completed_at')
        .in('task_id', data.map((task) => task.id));
      if (completionsError) throw completionsError;

      return data.map((task) => ({
        ...task,
        completions: (completions ?? []).filter((completion) => completion.task_id === task.id),
      }));
    },
  });

  const { data: jobImports } = useQuery({
    queryKey: ['leirskole-job-imports', week?.id],
    enabled: !!week?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_job_imports')
        .select('*')
        .eq('week_id', week!.id)
        .eq('source_status', 'hired')
        .order('name');
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
    qc.invalidateQueries({ queryKey: ['leirskole-job-imports'] });
  };

  const createWeek = useMutation({
    mutationFn: async () => {
      if (!newWeek.name || !newWeek.start_date || !newWeek.end_date) throw new Error('Fyll ut navn og datoer');
      if (newWeek.start_date > newWeek.end_date) throw new Error('Til-dato må være etter fra-dato');
      const { error } = await supabase.from('leirskole_weeks').insert({ ...newWeek, is_active: false });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Uke opprettet');
      setNewWeek({ name: '', start_date: '', end_date: '' });
      invalidate();
    },
    onError: (e: any) => showError(e.message),
  });

  const syncJobb = useMutation({
    mutationFn: syncFromJobb,
    onSuccess: (res) => {
      const linked = res.linked + res.already_linked;
      toast.success(
        `Hentet ${res.weeks} uker · ${linked} ansatte · ${res.posts} vaktposter · ${res.assignments} vakter`,
      );
      if (res.unmatched?.length) {
        toast.info(`${res.unmatched.length} personer må kobles til en appbruker`);
      }
      if (res.skipped_assignments) {
        toast.info(`${res.skipped_assignments} vakter venter på at personer kobles`);
      }
      if (res.errors?.length) {
        toast.warning(`${res.errors.length} rader kunne ikke importeres`);
      }
      invalidate();
    },
    onError: (e: any) => showError(e.message ?? 'Kunne ikke hente fra jobb-plattformen'),
  });

  const linkJobImport = useMutation({
    mutationFn: async ({ importId, leaderId }: { importId: string; leaderId: string }) => {
      const { error } = await supabase.rpc('link_leirskole_job_import', {
        _import_id: importId,
        _leader_id: leaderId,
      });
      if (error) throw error;
      try {
        await syncFromJobb();
        return null;
      } catch {
        return 'Personen er koblet, men vaktplanen må hentes på nytt.';
      }
    },
    onSuccess: (warning) => {
      warning ? toast.warning(warning) : toast.success('Personen og vaktplanen er koblet');
      invalidate();
    },
    onError: (e: any) => showError(e.message ?? 'Kunne ikke koble personen'),
  });

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('set_active_leirskole_week', { _week_id: id });
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
          return sendLeirskolePush({
            title: 'Leirskole-vaktplan',
            message: 'Vaktplanen for leirskolen er publisert. Se dine vakter i appen.',
            leader_ids: ids,
            sender_leader_id: leader?.id,
          });
        }
      }
      return null;
    },
    onSuccess: (pushWarning) => {
      pushWarning ? toast.warning(pushWarning) : toast.success('Oppdatert');
      invalidate();
    },
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
      if (targets.length === 0) throw new Error('Legg til minst én leder på uken først');
      const { error } = await supabase.from('leirskole_tasks').insert({
        week_id: week.id,
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || null,
        due_at: taskDraft.due_at ? new Date(taskDraft.due_at).toISOString() : null,
        assign_all: taskAssignAll,
        assigned_leader_ids: taskAssignAll ? [] : taskLeaderIds,
        created_by: leader?.id ?? null,
      });
      if (error) throw error;
      const ids = targets;
      if (ids.length) {
        return sendLeirskolePush({
          title: 'Ny leirskole-oppgave',
          message: taskDraft.title.trim(),
          leader_ids: ids,
          sender_leader_id: leader?.id,
        });
      }
      return null;
    },
    onSuccess: (pushWarning) => {
      pushWarning ? toast.warning(pushWarning) : toast.success('Oppgave sendt');
      setTaskDraft({ title: '', description: '', due_at: '' });
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
    if (isImportedWeek) {
      showError('Denne vaktplanen styres fra jobbplattformen');
      return;
    }
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
  const unmatchedImports = (jobImports ?? []).filter((row) => !row.linked_leader_id);

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

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium">Jobbplattform</p>
            <Button
              variant="secondary"
              onClick={() => syncJobb.mutate()}
              disabled={syncJobb.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncJobb.isPending ? 'animate-spin' : ''}`} />
              {syncJobb.isPending ? 'Henter…' : 'Hent ansatte og vaktplan'}
            </Button>
          </div>
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
                {isImportedWeek ? (
                  <Badge variant="secondary" className="gap-1.5 py-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Fra jobbplattformen
                  </Badge>
                ) : (
                  <Button onClick={runGenerator} disabled={generate.isPending} className="gap-2">
                    <Play className="h-4 w-4" /> {generate.isPending ? 'Genererer…' : 'Generer vaktplan'}
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4 text-primary" />
                  {isImportedWeek ? 'Publisert fra jobbplattformen' : 'Publisert for lederne'}
                </div>
                <Switch
                  checked={!!week.schedule_published_at}
                  disabled={isImportedWeek}
                  onCheckedChange={(v) => publish.mutate({ id: week.id, published: v })}
                />
              </div>
            </CardContent>
          </Card>

          {(jobImports ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4 text-primary" /> Koble personer
                  {unmatchedImports.length > 0 && ` (${unmatchedImports.length} mangler)`}
                </CardTitle>
                <CardDescription>Kontroller eller endre hvilken appbruker hver ansatt er koblet til.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(jobImports ?? []).map((imported) => (
                  <div
                    key={imported.id}
                    className="grid gap-2 rounded-lg border bg-card/40 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{imported.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[imported.phone, imported.email].filter(Boolean).join(' · ') || 'Ingen kontaktinfo'}
                      </p>
                    </div>
                    <Select
                      disabled={linkJobImport.isPending}
                      value={imported.linked_leader_id ?? undefined}
                      onValueChange={(leaderId) => linkJobImport.mutate({ importId: imported.id, leaderId })}
                    >
                      <SelectTrigger aria-label={`Koble ${imported.name} til appbruker`}>
                        <SelectValue placeholder="Velg appbruker" />
                      </SelectTrigger>
                      <SelectContent>
                        {(allLeaders ?? []).map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name}
                            {candidate.phone ? ` · ${candidate.phone}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
              <CardDescription>Send til alle på uken, eller velg spesifikke ledere</CardDescription>
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
              <div>
                <Label className="text-xs">Frist (valgfritt)</Label>
                <Input
                  type="datetime-local"
                  value={taskDraft.due_at}
                  onChange={(e) => setTaskDraft({ ...taskDraft, due_at: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
                <span className="text-sm">Til alle på leirskolen</span>
                <Switch checked={taskAssignAll} onCheckedChange={setTaskAssignAll} />
              </div>
              {!taskAssignAll && (
                <div className="flex flex-wrap gap-2">
                  {(staff ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Legg til ledere på uken først.</p>
                  ) : (
                    (staff ?? []).map((s) => {
                      const on = taskLeaderIds.includes(s.leader_id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setTaskLeaderIds((prev) =>
                              on ? prev.filter((id) => id !== s.leader_id) : [...prev, s.leader_id],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            on ? 'bg-primary text-primary-foreground' : 'bg-card/60 text-muted-foreground'
                          }`}
                        >
                          {s.leader?.name ?? 'Ukjent'}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
              <Button onClick={() => createTask.mutate()} disabled={createTask.isPending} className="gap-2">
                <Send className="h-4 w-4" /> Send oppgave + varsling
              </Button>

              <div className="space-y-1">
                {(tasks ?? []).map((t: any) => (
                  <div key={t.id} className="flex items-start justify-between gap-2 rounded-xl border bg-card/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.assign_all
                          ? 'Alle på leirskolen'
                          : (t.assigned_leader_ids ?? [])
                              .map((id: string) => (allLeaders ?? []).find((l) => l.id === id)?.name ?? '—')
                              .join(', ')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {t.due_at && <span>Frist {formatDue(t.due_at)}</span>}
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {(t.completions ?? []).length}/
                          {t.assign_all ? (staff ?? []).length : (t.assigned_leader_ids ?? []).length} fullført
                        </span>
                      </div>
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
              <CardTitle className="flex items-center gap-2 text-base">
                Vaktplan
                {isImportedWeek && <Badge variant="outline">Synkronisert</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(posts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isImportedWeek
                    ? 'Ingen publisert vaktplan er hentet fra jobbplattformen ennå.'
                    : 'Ingen vaktposter ennå — generatoren lager standardposter.'}
                </p>
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
