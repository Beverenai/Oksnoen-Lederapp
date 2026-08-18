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
import { ArrowLeft, Send, Trash2, CalendarDays, Bell, CheckCircle2, Clock, Users, ChevronDown, HelpCircle } from 'lucide-react';
import {
  useActiveLeirskoleWeek,
  useLeirskoleActivities,
  useLeirskoleSchedule,
  useLeirskoleStaff,
  useLeirskoleWeekPlan,
  useLeirskoleWeeks,
} from '@/hooks/useLeirskole';
import { LeirskoleAccessCard } from '@/components/admin/LeirskoleAccessCard';
import { LeirskoleActivityTypesCard } from '@/components/admin/LeirskoleActivityTypesCard';
import { LeirskoleWeekPeriodsCard } from '@/components/admin/LeirskoleWeekPeriodsCard';
import { LeirskoleGuideCard } from '@/components/admin/LeirskoleGuideCard';
import { LeirskoleLeaderSheet } from '@/components/admin/LeirskoleLeaderSheet';
import { LeirskoleSessionInfoCard } from '@/components/admin/LeirskoleSessionInfoCard';
import { LeirskoleStaffPanel } from '@/components/admin/LeirskoleStaffPanel';
import { LeirskoleWeekBoard } from '@/components/admin/LeirskoleWeekBoard';
import { LeirskoleDayEditor } from '@/components/admin/LeirskoleDayEditor';
import { formatDue, shortDate, todayStr } from '@/lib/leirskoleDates';

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


type StepTone = 'todo' | 'warn' | 'done';

const TONE: Record<StepTone, string> = {
  todo: 'bg-muted/60 text-muted-foreground',
  warn: 'bg-amber-500/20 text-amber-500',
  done: 'bg-primary/20 text-primary',
};

/** Ett steg i arbeidsflyten — åpnes/lukkes og viser status. */
function Step({
  n,
  title,
  subtitle,
  status,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  subtitle: string;
  status: { label: string; tone: StepTone };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="oks-ls-pill overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            status.tone === 'done' ? 'oks-ls-gradient' : 'bg-muted/60 text-muted-foreground'
          }`}
        >
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE[status.tone]}`}>
          {status.label}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-3 border-t border-border/60 p-4 pt-3">{children}</div>}
    </div>
  );
}

export default function LeirskoleAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, leader } = useAuth();
  const { showError } = useStatusPopup();

  const { data: activeWeek, isLoading } = useActiveLeirskoleWeek();
  const { data: weeks } = useLeirskoleWeeks();
  const [pickedWeekId, setPickedWeekId] = useState<string | null>(null);
  // Admin planlegger én uke om gangen: valgt uke, ellers uken vi er inne i.
  const week = useMemo(
    () => (weeks ?? []).find((w) => w.id === pickedWeekId) ?? activeWeek ?? null,
    [weeks, pickedWeekId, activeWeek],
  );
  const { data: staff } = useLeirskoleStaff(week?.id);
  const { data: posts } = useLeirskoleSchedule(week?.id);
  const { data: weekActivities } = useLeirskoleActivities(week?.id);
  const { data: planCells } = useLeirskoleWeekPlan(week?.id);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewDate, setViewDate] = useState<string | null>(null);

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

  /** Alle dagene i uken – for dagvelgeren. */
  const weekDates = useMemo(() => {
    if (!week) return [] as string[];
    const out: string[] = [];
    const d = new Date(`${week.start_date}T12:00:00`);
    const last = new Date(`${week.end_date}T12:00:00`);
    while (d <= last && out.length < 21) {
      out.push(d.toLocaleDateString('sv-SE'));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [week]);

  const activeDate = viewDate ?? (weekDates.includes(today) ? today : weekDates[0] ?? today);


  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    (staff ?? []).forEach((s) => map.set(s.id, s.leader?.name ?? 'Ukjent'));
    return map;
  }, [staff]);


  const activitiesByLeader = useMemo(() => {
    const map = new Map<string, string[]>();
    (weekActivities ?? []).forEach((a) => {
      map.set(a.leader_id, [...(map.get(a.leader_id) ?? []), a.activity]);
    });
    return map;
  }, [weekActivities]);

  const missingCompetence = (staff ?? []).filter(
    (s) => (s.leader?.leirskole_competencies ?? []).length === 0,
  ).length;

  /** Hvor mange ruter i ukeplanen som er fylt ut (3 økter per dag). */
  const { planFilled, planTotal } = useMemo(() => {
    if (!week) return { planFilled: 0, planTotal: 0 };
    const start = new Date(`${week.start_date}T12:00:00`);
    const end = new Date(`${week.end_date}T12:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const filled = (planCells ?? []).filter(
      (c) => c.row_index >= 1 && c.row_index <= 3 && (c.content ?? '').trim().length > 0,
    ).length;
    return { planFilled: filled, planTotal: days * 3 };
  }, [week, planCells]);

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
      <div className="space-y-3 pb-8">
        <div className="py-10 text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-heading font-bold">Ingen leirskoleuke ennå</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lag en uke med datoer, og legg til lederne som skal jobbe.</p>
        </div>
        <LeirskoleWeekPeriodsCard selectedWeekId={pickedWeekId} onSelect={setPickedWeekId} />
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
              {shortDate(week.start_date)} – {shortDate(week.end_date)} · planleggingsgrense {Number(week.max_daily_hours ?? 8)}t/dag
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
              {week.schedule_published_at ? 'Publisert' : 'Utkast'}
            </span>
            <button
              type="button"
              aria-label="Hvordan fungerer dette?"
              onClick={() => setGuideOpen((v) => !v)}
              className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { v: `${(staff ?? []).length}`, l: 'Ledere' },
            { v: `${(posts ?? []).length}`, l: 'Vakter' },
            { v: `${totalHours.toFixed(0)}t`, l: 'Timer' },
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

      {guideOpen && <LeirskoleGuideCard />}

      <LeirskoleWeekPeriodsCard
        selectedWeekId={week.id}
        activeWeekId={activeWeek?.id}
        onSelect={(id) => {
          setPickedWeekId(id);
          setViewDate(null);
        }}
      />

      <LeirskoleWeekBoard week={week} staff={staff ?? []} />

      {week && <LeirskoleDayEditor week={week} staff={staff ?? []} />}

      {/* Stegvis arbeidsflyt */}
      <div className="space-y-2">
        <Step
          n={1}
          title="Aktivitetstyper"
          subtitle="Hvilke aktiviteter kan gis til lederne"
          status={
            planFilled === 0
              ? { label: 'Ukeplan ikke fylt ut', tone: 'todo' }
              : { label: `${planFilled} av ${planTotal} ruter`, tone: planFilled >= planTotal ? 'done' : 'warn' }
          }
          open={openStep === 1}
          onToggle={() => setOpenStep(openStep === 1 ? null : 1)}
        >
          <LeirskoleActivityTypesCard />
        </Step>

        <Step
          n={2}
          title="Oppgaver"
          subtitle="Beskjeder og oppgaver til lederne"
          status={{ label: `${(tasks ?? []).length} sendt`, tone: (tasks ?? []).length ? 'done' : 'todo' }}
          open={openStep === 2}
          onToggle={() => setOpenStep(openStep === 2 ? null : 2)}
        >
          {taskPanel}
          <LeirskoleSessionInfoCard weekId={week.id} staff={staff ?? []} />
        </Step>

        <Step
          n={3}
          title="Ledere"
          subtitle="Hvem jobber denne uken + kompetanse"
          status={
            (staff ?? []).length === 0
              ? { label: 'Ingen ledere', tone: 'todo' }
              : missingCompetence > 0
                ? { label: `${missingCompetence} mangler kompetanse`, tone: 'warn' }
                : { label: `${(staff ?? []).length} ledere`, tone: 'done' }
          }
          open={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? null : 3)}
        >
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
        </Step>
      </div>

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
