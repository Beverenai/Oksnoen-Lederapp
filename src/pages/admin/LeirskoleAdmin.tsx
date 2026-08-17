import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Send, Trash2, CalendarDays, Bell, CheckCircle2, Clock, Users, ChevronRight } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleActivities,
  useLeirskoleSchedule,
  useLeirskoleStaff,
} from '@/hooks/useLeirskole';
import { LeirskoleAccessCard } from '@/components/admin/LeirskoleAccessCard';
import { LeirskoleActivityCard } from '@/components/admin/LeirskoleActivityCard';
import { LeirskoleActivityTypesCard } from '@/components/admin/LeirskoleActivityTypesCard';
import { LeirskoleLeaderSheet } from '@/components/admin/LeirskoleLeaderSheet';
import { LeirskolePostsCard } from '@/components/admin/LeirskolePostsCard';
import { LeirskoleSessionInfoCard } from '@/components/admin/LeirskoleSessionInfoCard';
import { LeirskoleStaffPanel } from '@/components/admin/LeirskoleStaffPanel';
import { formatDue, hhmm, shortDate, todayStr } from '@/lib/leirskoleDates';
import { LeaderAvatarStack, type AvatarPerson } from '@/components/leirskole/LeaderAvatarStack';

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function sendLeirskolePush(body: {
  title: string;
  message: string;
  leader_ids: string[];
  sender_leader_id?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.functions.invoke('push-send', { body });
  if (error) return 'Lagret, men varslingen kunne ikke sendes.';
  return null;
}

export default function LeirskoleAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, leader } = useAuth();
  const { showError } = useStatusPopup();

  const { data: week, isLoading } = useActiveLeirskoleWeek();
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: posts } = useLeirskoleSchedule(week?.id);
  const { data: weekActivities } = useLeirskoleActivities(week?.id);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', due_at: '' });
  const [taskAssignAll, setTaskAssignAll] = useState(true);
  const [taskLeaderIds, setTaskLeaderIds] = useState<string[]>([]);

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
    qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
    qc.invalidateQueries({ queryKey: ['leirskole-admin-tasks'] });
  };

  const publish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase
        .from('leirskole_weeks')
        .update({ schedule_published_at: published ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      toast.success('Oppdatert');
      invalidate();
    },
    onError: (error: unknown) => showError(errorMessage(error, 'Kunne ikke publisere vaktplanen')),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!week) throw new Error('Ingen aktiv uke');
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
      return sendLeirskolePush({
        title: 'Ny leirskole-oppgave',
        message: taskDraft.title.trim(),
        leader_ids: targets,
        sender_leader_id: leader?.id,
      });
    },
    onSuccess: (pushWarning) => {
      if (pushWarning) toast.warning(pushWarning);
      else toast.success('Oppgave sendt');
      setTaskDraft({ title: '', description: '', due_at: '' });
      setTaskLeaderIds([]);
      invalidate();
    },
    onError: (error: unknown) => showError(errorMessage(error, 'Kunne ikke opprette oppgaven')),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    (posts ?? []).forEach((p) => {
      p.assignments.forEach((a) => {
        map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      });
    });
    return map;
  }, [posts]);

  const today = todayStr();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  /** Hvor mange ledere som er på vakt akkurat nå. */
  const onDutyCount = useMemo(() => {
    const ids = new Set<string>();
    (posts ?? [])
      .filter((p) => p.date === today)
      .forEach((p) => {
        const [sh, sm] = p.start_time.split(':').map(Number);
        const [eh, em] = p.end_time.split(':').map(Number);
        const start = sh * 60 + sm;
        let end = eh * 60 + em;
        if (end <= start) end += 24 * 60;
        if (nowMinutes >= start && nowMinutes <= end) {
          p.assignments.forEach((a) => ids.add(a.staff_id));
        }
      });
    return ids.size;
  }, [posts, today, nowMinutes]);

  const totalHours = useMemo(
    () => [...hoursByStaff.values()].reduce((a, b) => a + b, 0),
    [hoursByStaff],
  );

  const todayPosts = useMemo(
    () => (posts ?? []).filter((p) => p.date === today).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [posts, today],
  );

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => map.set(s.id, s.leader?.name ?? 'Ukjent'));
    return map;
  }, [staff]);

  /** staff_id → leder med bilde, for avatarrekkene. */
  const staffPeople = useMemo(() => {
    const map = new Map<string, AvatarPerson>();
    (staff ?? []).forEach((s) => {
      map.set(s.id, {
        id: s.id,
        name: s.leader?.name ?? 'Ukjent',
        imageUrl: s.leader?.profile_image_url ?? null,
      });
    });
    return map;
  }, [staff]);

  const activitiesByLeader = useMemo(() => {
    const map = new Map<string, string[]>();
    (weekActivities ?? []).forEach((a) => {
      map.set(a.leader_id, [...(map.get(a.leader_id) ?? []), a.activity]);
    });
    return map;
  }, [weekActivities]);

  const selectedStaff = (staff ?? []).find((s) => s.id === selectedStaffId) ?? null;

  if (!isAdmin) {
    return <p className="py-16 text-center text-muted-foreground">Kun for admin.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (!week) {
    return (
      <div className="py-16 text-center">
        <CalendarDays className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-heading font-bold">Ingen aktiv leirskoleuke</h1>
        <p className="mt-1 text-sm text-muted-foreground">Uken aktiveres automatisk ut fra datoene.</p>
      </div>
    );
  }

  const hasSchedule = (posts ?? []).length > 0;

  const taskPanel = (
      <div className="oks-ls-pill oks-ls-stripe space-y-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Oppgaver til lederne
          </p>
          <p className="text-xs text-muted-foreground">Send til alle på uken, eller velg spesifikke ledere</p>
        </div>

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
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2">
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
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    {s.leader?.name ?? 'Ukjent'}
                  </button>
                );
              })
            )}
          </div>
        )}
        <Button onClick={() => createTask.mutate()} disabled={createTask.isPending} className="w-full gap-2 rounded-full">
          <Send className="h-4 w-4" /> Send oppgave + varsling
        </Button>

        <div className="space-y-1.5">
          {(tasks ?? []).map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.title}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.assign_all
                    ? 'Alle på leirskolen'
                    : (t.assigned_leader_ids ?? [])
                        .map((id: string) => (staff ?? []).find((s) => s.leader_id === id)?.leader?.name ?? '—')
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
      </div>
  );

  return (
    <div className="space-y-3 animate-fade-in pb-8">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </Button>

      {/* Toppkort i logofargene */}
      <div className="oks-ls-gradient rounded-3xl p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Leirskole-admin</p>
            <h1 className="mt-0.5 truncate text-2xl font-heading font-bold">{week.name}</h1>
            <p className="mt-0.5 text-sm text-white/85">
              {shortDate(week.start_date)} – {shortDate(week.end_date)} · maks {Number(week.max_daily_hours ?? 8)}t/dag
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
            {week.schedule_published_at ? 'Publisert' : 'Utkast'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { v: `${(staff ?? []).length}`, l: 'Ledere' },
            { v: `${onDutyCount}`, l: 'På vakt nå' },
            { v: `${totalHours.toFixed(0)}t`, l: 'Timer' },
            { v: `${(posts ?? []).length}`, l: 'Vakter' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/15 px-2.5 py-2">
              <p className="text-lg font-bold tabular-nums">{s.v}</p>
              <p className="text-[10.5px] text-white/80">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 px-3 py-2">
          <span className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" /> Publisert for lederne
          </span>
          <Switch
            checked={!!week.schedule_published_at}
            onCheckedChange={(v) => publish.mutate({ id: week.id, published: v })}
          />
        </div>
      </div>

      {/* Arbeidsflyt: 1) vaktplan → 2) oppgaver per økt */}
      <div className="oks-ls-pill flex items-center gap-2 p-3 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${hasSchedule ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
          1. Vaktplan {hasSchedule ? '✓' : ''}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={`rounded-full px-2.5 py-1 font-semibold ${(weekActivities ?? []).length ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
          2. Oppgaver per økt
        </span>
      </div>

      <Tabs defaultValue="oversikt" className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl">
          <TabsTrigger value="oversikt" className="rounded-xl text-xs">Oversikt</TabsTrigger>
          <TabsTrigger value="vaktplan" className="rounded-xl text-xs">Vaktplan</TabsTrigger>
          <TabsTrigger value="okter" className="rounded-xl text-xs">Økter</TabsTrigger>
          <TabsTrigger value="oppgaver" className="rounded-xl text-xs">Oppgaver</TabsTrigger>
        </TabsList>

        <TabsContent value="oversikt" className="mt-3 space-y-3">
          {todayPosts.length > 0 && (
            <div className="oks-ls-pill oks-ls-stripe p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" /> I dag
              </p>
              <div className="space-y-1.5">
                {todayPosts.map((p) => (
                  <div key={p.id} className="rounded-2xl bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">{p.name}</p>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {hhmm(p.start_time)}–{hhmm(p.end_time)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <LeaderAvatarStack
                        people={p.assignments
                          .map((a) => staffPeople.get(a.staff_id))
                          .filter(Boolean) as AvatarPerson[]}
                        withNames
                        onSelect={(person) => setSelectedStaffId(person.id)}
                        emptyLabel="Ingen satt opp"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <LeirskoleStaffPanel
            weekName={week.name}
            weekDates={`${week.start_date} – ${week.end_date}`}
            staff={staff ?? []}
            hoursByStaff={hoursByStaff}
            maxDailyHours={week.max_daily_hours}
            activitiesByLeader={activitiesByLeader}
            onSelect={(s) => setSelectedStaffId(s.id)}
          />

          <LeirskoleAccessCard
            weekId={week.id}
            weekName={week.name}
            maxDailyHours={week.max_daily_hours}
          />
        </TabsContent>

        <TabsContent value="vaktplan" className="mt-3 space-y-3">
          <LeirskolePostsCard
            week={week}
            staff={staff ?? []}
            onSelectStaff={(staffId) => setSelectedStaffId(staffId)}
          />
        </TabsContent>

        <TabsContent value="okter" className="mt-3 space-y-3">
          {!hasSchedule && (
            <div className="oks-ls-pill p-4 text-sm text-muted-foreground">
              Generer vaktplanen først — da vet vi hvilke ledere som er på vakt hver økt.
            </div>
          )}
          <LeirskoleActivityCard week={week} staff={staff ?? []} />
          <LeirskoleActivityTypesCard />
          <LeirskoleSessionInfoCard weekId={week.id} staff={staff ?? []} />
        </TabsContent>

        <TabsContent value="oppgaver" className="mt-3 space-y-3">
          {taskPanel}
        </TabsContent>
      </Tabs>

      {selectedStaff?.leader && (
        <LeirskoleLeaderSheet
          open={!!selectedStaff}
          onOpenChange={(v) => !v && setSelectedStaffId(null)}
          weekId={week.id}
          leaderId={selectedStaff.leader.id}
          leaderName={selectedStaff.leader.name}
          imageUrl={selectedStaff.leader.profile_image_url}
          competencies={selectedStaff.leader.leirskole_competencies ?? []}
          hours={hoursByStaff.get(selectedStaff.id) ?? 0}
        />
      )}
    </div>
  );
}
