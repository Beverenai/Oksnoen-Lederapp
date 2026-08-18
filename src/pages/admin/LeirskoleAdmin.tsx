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
import { ArrowLeft, Send, Trash2, CalendarDays, Bell, CheckCircle2, Clock, Users, ChevronDown, ChevronRight, HelpCircle, ListChecks, FileSpreadsheet, KeyRound, Archive } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  useActiveLeirskoleWeek,
  useLeirskoleActivities,
  useAutoSaveLeirskoleWeek,
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
import { LeirskoleStaffPanel } from '@/components/admin/LeirskoleStaffPanel';
import { LeirskoleWeekBoard } from '@/components/admin/LeirskoleWeekBoard';
import { LeirskolePayrollExportCard } from '@/components/admin/LeirskolePayrollExportCard';
import { LeirskoleWeekArchiveCard } from '@/components/admin/LeirskoleWeekArchiveCard';
import { QuickNotificationSheet } from '@/components/admin/QuickNotificationSheet';
import { LeirskoleDayEditor } from '@/components/admin/LeirskoleDayEditor';
import { LeirskoleDayToDayCard } from '@/components/admin/LeirskoleDayToDayCard';
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

/** Rad som åpner en egen detaljvisning (sheet) i stedet for en toggle. */
function OpenRow({
  icon,
  title,
  subtitle,
  status,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status?: { label: string; tone: StepTone };
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="oks-ls-pill flex w-full items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        {status && (
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[status.tone]}`}>
            {status.label}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
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
  const [panel, setPanel] = useState<'leaders' | 'activities' | 'access' | 'payroll' | 'archive' | null>(null);
  const [quickPushOpen, setQuickPushOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewDate, setViewDate] = useState<string | null>(null);

  // Autolagring: signaturen endrer seg når bemanning, vaktplan, aktiviteter
  // eller ukesoppsett endres — da lagres ukesarkivet automatisk.
  const autoSaveSignature = useMemo(() => {
    const stamp = (rows?: { updated_at?: string | null }[]) =>
      (rows ?? []).reduce((max, r) => (r.updated_at && r.updated_at > max ? r.updated_at : max), '');
    return [
      (staff ?? []).length,
      (posts ?? []).length,
      (weekActivities ?? []).length,
      (planCells ?? []).length,
      stamp(staff as { updated_at?: string | null }[]),
      stamp(posts as { updated_at?: string | null }[]),
      stamp(weekActivities as { updated_at?: string | null }[]),
      stamp(planCells as { updated_at?: string | null }[]),
    ].join(':');
  }, [staff, posts, weekActivities, planCells]);

  useAutoSaveLeirskoleWeek(week?.id, autoSaveSignature);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
    qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
    qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
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

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 animate-fade-in pb-8">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </Button>

      {/* Toppkort i logofargene */}
      <div className="oks-ls-gradient rounded-3xl p-4 shadow-lg lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Leirskole-admin</p>
            <h1 className="mt-0.5 truncate text-2xl font-heading font-bold lg:text-4xl">{week.name}</h1>
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

        <div className="mt-3 grid grid-cols-3 gap-2 lg:gap-4">
          {[
            { v: `${(staff ?? []).length}`, l: 'Ledere' },
            { v: `${(posts ?? []).length}`, l: 'Vakter' },
            { v: `${totalHours.toFixed(0)}t`, l: 'Timer' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/20 bg-white/15 px-2.5 py-2 lg:px-4 lg:py-3">
              <p className="text-lg font-bold tabular-nums lg:text-3xl">{s.v}</p>
              <p className="text-[10.5px] uppercase tracking-wide text-white/80">{s.l}</p>
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

      {/* Verktøyrad — hver åpner sin egen detaljvisning */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <OpenRow
          icon={<Users className="h-5 w-5" />}
          title="Ledere"
          subtitle="Hvem jobber denne uken"
          status={
            (staff ?? []).length === 0
              ? { label: 'Ingen ledere', tone: 'todo' }
              : missingCompetence > 0
                ? { label: `${missingCompetence} mangler kompetanse`, tone: 'warn' }
                : { label: `${(staff ?? []).length} ledere`, tone: 'done' }
          }
          onOpen={() => setPanel('leaders')}
        />
        <OpenRow
          icon={<ListChecks className="h-5 w-5" />}
          title="Aktivitetstyper"
          subtitle="Hvilke aktiviteter kan gis til lederne"
          status={
            planFilled === 0
              ? { label: 'Ukeplan ikke fylt ut', tone: 'todo' }
              : { label: `${planFilled} av ${planTotal} ruter`, tone: planFilled >= planTotal ? 'done' : 'warn' }
          }
          onOpen={() => setPanel('activities')}
        />
        <OpenRow
          icon={<KeyRound className="h-5 w-5" />}
          title="Tilgang og varsling"
          subtitle="Inviter ledere og send beskjed"
          onOpen={() => setPanel('access')}
        />
        <OpenRow
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Timer og lønn"
          subtitle="Eksporter til Excel"
          status={
            hasSchedule
              ? { label: `${totalHours.toFixed(0)}t klar`, tone: 'done' }
              : { label: 'Ingen vakter ennå', tone: 'todo' }
          }
          onOpen={() => setPanel('payroll')}
        />
        <OpenRow
          icon={<Archive className="h-5 w-5" />}
          title="Ukesarkiv"
          subtitle="Lagre ledere, vakter og timer for uken"
          onOpen={() => setPanel('archive')}
        />
        <OpenRow
          icon={<Bell className="h-5 w-5" />}
          title="Hurtigvarslinger"
          subtitle={`Sendes kun til ${(staff ?? []).length} ledere denne uken`}
          onOpen={() => setQuickPushOpen(true)}
        />
      </div>

      {/* Planlegging i full bredde — hele uken skal få plass */}
      <div className="space-y-3">
        <LeirskoleWeekPeriodsCard
          selectedWeekId={week.id}
          activeWeekId={activeWeek?.id}
          onSelect={(id) => {
            setPickedWeekId(id);
            setViewDate(null);
          }}
        />

        <LeirskoleDayToDayCard week={week} />

        <LeirskoleDayEditor
          week={week}
          staff={staff ?? []}
          weekBoard={<LeirskoleWeekBoard week={week} staff={staff ?? []} />}
        />
      </div>

      <Sheet open={panel !== null} onOpenChange={(v) => !v && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>
              {panel === 'leaders'
                ? 'Ledere'
                : panel === 'activities'
                  ? 'Aktivitetstyper'
                  : panel === 'access'
                    ? 'Tilgang og varsling'
                    : panel === 'archive'
                      ? 'Ukesarkiv'
                      : 'Timer og lønn'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {panel === 'leaders' && (
              <LeirskoleStaffPanel
                weekName={week.name}
                weekDates={`${week.start_date} – ${week.end_date}`}
                staff={staff ?? []}
                hoursByStaff={hoursByStaff}
                maxDailyHours={week.max_daily_hours}
                activitiesByLeader={activitiesByLeader}
                onSelect={(s) => setSelectedStaffId(s.id)}
              />
            )}
            {panel === 'activities' && <LeirskoleActivityTypesCard />}
            {panel === 'access' && (
              <LeirskoleAccessCard weekId={week.id} weekName={week.name} maxDailyHours={week.max_daily_hours} />
            )}
            {panel === 'payroll' && (
              <LeirskolePayrollExportCard
                week={week}
                allWeeks={(weeks ?? []).map((w) => ({
                  id: w.id,
                  name: w.name,
                  start_date: w.start_date,
                  end_date: w.end_date,
                }))}
              />
            )}
            {panel === 'archive' && (
              <LeirskoleWeekArchiveCard
                week={week}
                allWeeks={(weeks ?? []).map((w) => ({
                  id: w.id,
                  name: w.name,
                  start_date: w.start_date,
                  end_date: w.end_date,
                }))}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <QuickNotificationSheet
        open={quickPushOpen}
        onOpenChange={setQuickPushOpen}
        leaderIds={(staff ?? []).map((s) => s.leader?.id).filter((id): id is string => !!id)}
        scopeLabel={`ledere på ${week.name}`}
      />

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
