import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, Wand2, Send, Repeat, AlertTriangle, Zap } from 'lucide-react';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleSchedule,
  useSaveLeirskoleActivities,
  useDeleteLeirskoleActivity,
  useLeirskoleActivityTypes,
  useLeirskoleWeekPlan,
  useLeirskoleWeekDays,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import {
  LEIRSKOLE_ACTIVITY_SESSIONS,
  activityEmoji,
  activityLabel,
  generateActivityAssignments,
  sessionLabel,
  type GeneratedActivity,
} from '@/lib/leirskoleActivities';
import { dayLabel } from '@/lib/leirskoleDates';

type StaffRow = LeirskoleStaff & {
  leader: { id: string; name: string; leirskole_competencies: string[] | null } | null;
};

interface Props {
  week: LeirskoleWeek;
  staff: StaffRow[];
}

function datesInWeek(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 14) {
    out.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function LeirskoleActivityCard({ week, staff }: Props) {
  const { leader } = useAuth();
  const days = useMemo(() => datesInWeek(week.start_date, week.end_date), [week.start_date, week.end_date]);
  const today = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(days.includes(today) ? today : days[0]);
  const [session, setSession] = useState<string>('formiddag');
  const [draft, setDraft] = useState<GeneratedActivity[] | null>(null);

  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: saved } = useLeirskoleActivities(week.id);
  const { data: history } = useLeirskoleActivityHistory();
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: planCells } = useLeirskoleWeekPlan(week.id);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const save = useSaveLeirskoleActivities();
  const removeOne = useDeleteLeirskoleActivity();

  const dayType = weekDays?.find((d) => d.date === date)?.day_type ?? 'normal';
  const isArrival = dayType === 'ankomst';
  const requireCompetence = !isArrival;


  /** Ukeplanleggeren styrer hva som gjelder: økt 1/2/3 = formiddag/ettermiddag/kveld. */
  const rowIndexFor = (sessionKey: string) =>
    sessionKey === 'formiddag' ? 1 : sessionKey === 'ettermiddag' ? 2 : 3;

  /** Aktivitetene som er lagt inn i ukeplanleggeren for denne dagen + økten. */
  const keysFor = (sessionKey: string) => {
    const cell = (planCells ?? []).find(
      (c) => c.date === date && c.row_index === rowIndexFor(sessionKey),
    );
    const lines = (cell?.content ?? '')
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (!lines.length) return [] as string[];
    return (types ?? [])
      .filter((t) => lines.some((l) => l.includes(t.label.toLowerCase())))
      .map((t) => t.key);
  };

  const selectedKeys = keysFor(session);

  const staffIdToLeader = useMemo(() => {
    const map = new Map<string, StaffRow>();
    staff.forEach((s) => map.set(s.id, s));
    return map;
  }, [staff]);

  /** Ledere som faktisk er på vakt denne datoen (fallback: alle på uken). */
  const onDuty = useMemo(() => {
    const ids = new Set<string>();
    (posts ?? [])
      .filter((p) => p.date === date)
      .forEach((p) => p.assignments.forEach((a) => {
        const row = staffIdToLeader.get(a.staff_id);
        if (row?.leader?.id) ids.add(row.leader.id);
      }));
    const list = staff.filter((s) => s.leader && ids.has(s.leader.id));
    return list.length ? list : staff;
  }, [posts, date, staff, staffIdToLeader]);

  const savedForSession = useMemo(
    () => (saved ?? []).filter((a) => a.date === date && a.session === session),
    [saved, date, session],
  );


  const generate = () => {
    const candidates = onDuty
      .filter((s) => s.leader)
      .map((s) => ({
        leaderId: s.leader!.id,
        name: s.leader!.name,
        competencies: s.leader!.leirskole_competencies ?? [],
      }));
    if (candidates.length === 0) {
      toast.error('Ingen ledere på vakt denne datoen');
      return;
    }
    if (selectedKeys.length === 0) {
      toast.error('Legg inn aktiviteter for denne økten i ukeplanleggeren først');
      return;
    }
    const result = generateActivityAssignments(
      candidates,
      (history ?? []).map((h) => ({ leader_id: h.leader_id, activity: h.activity })),
      selectedKeys,
      requireCompetence,
    );
    setDraft(result);
  };

  const publish = useMutation({
    mutationFn: async () => {
      if (!draft?.length) throw new Error('Ingen forslag å lagre');
      await save.mutateAsync({
        weekId: week.id,
        date,
        session,
        rows: draft.map((d) => ({ leader_id: d.leaderId, activity: d.activity, auto_generated: true })),
      });
      const { error } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Leirskole — aktiviteter',
          message: `${dayLabel(date)} ${sessionLabel(session).toLowerCase()}: du har fått en aktivitet.`,
          leader_ids: draft.map((d) => d.leaderId),
          sender_leader_id: leader?.id,
        },
      });
      return error ? 'Lagret, men varslingen kunne ikke sendes.' : null;
    },
    onSuccess: (warning) => {
      if (warning) toast.warning(warning);
      else toast.success('Aktiviteter lagret og varslet');
      setDraft(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
  });

  /** Én knapp: fordeler aktiviteter på formiddag og ettermiddag denne dagen og varsler lederne. */
  const generateDay = useMutation({
    mutationFn: async () => {
      const candidates = onDuty
        .filter((s) => s.leader)
        .map((s) => ({
          leaderId: s.leader!.id,
          name: s.leader!.name,
          competencies: s.leader!.leirskole_competencies ?? [],
        }));
      if (candidates.length === 0) throw new Error('Ingen ledere på vakt denne datoen');

      const running = (history ?? []).map((h) => ({ leader_id: h.leader_id, activity: h.activity }));
      const notified = new Set<string>();

      for (const s of LEIRSKOLE_ACTIVITY_SESSIONS) {
        const keys = keysFor(s.key);
        if (!keys.length) continue;
        const rows = generateActivityAssignments(
          candidates,
          running,
          keys,
        );
        if (!rows.length) continue;
        await save.mutateAsync({
          weekId: week.id,
          date,
          session: s.key,
          rows: rows.map((d) => ({ leader_id: d.leaderId, activity: d.activity, auto_generated: true })),
        });
        rows.forEach((d) => {
          running.push({ leader_id: d.leaderId, activity: d.activity });
          notified.add(d.leaderId);
        });
      }

      if (notified.size === 0)
        throw new Error('Ingen aktiviteter i ukeplanleggeren for denne dagen');
      const { error } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Leirskole — aktiviteter',
          message: `${dayLabel(date)}: aktivitetene for dagen er klare.`,
          leader_ids: [...notified],
          sender_leader_id: leader?.id,
        },
      });
      return error ? 'Lagret, men varslingen kunne ikke sendes.' : null;
    },
    onSuccess: (warning) => {
      if (warning) toast.warning(warning);
      else toast.success('Aktiviteter for hele dagen er lagret og varslet');
      setDraft(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke generere dagen'),
  });

  return (
    <div className="oks-ls-pill space-y-3 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" /> Aktiviteter per økt
        </p>
        <p className="text-xs text-muted-foreground">
          Aktivitetene hentes fra ukeplanleggeren: økt 1 = formiddag, økt 2 = ettermiddag.
          Endre rutene i ukeplanleggeren, så fordeles nettopp de aktivitetene til lederne.
        </p>
      </div>

      {/* Dato */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => { setDate(d); setDraft(null); }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              d === date ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>

      {/* Økt */}
      <div className="flex gap-1.5">
        {LEIRSKOLE_ACTIVITY_SESSIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setSession(s.key); setDraft(null); }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
              s.key === session ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {onDuty.length} ledere tilgjengelig · {selectedKeys.length} aktiviteter valgt ·{' '}
        {savedForSession.length} lagret på denne økten
      </p>

      {/* Aktivitetene som ligger i ukeplanleggeren for denne økten */}
      <div className="flex flex-wrap gap-1.5">
        {selectedKeys.map((key) => (
          <span
            key={key}
            className="rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-medium"
          >
            {activityEmoji(key, types ?? [])} {activityLabel(key, types ?? [])}
          </span>
        ))}
        {selectedKeys.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ingen aktiviteter i ukeplanleggeren for {dayLabel(date)} {sessionLabel(session).toLowerCase()}.
          </p>
        )}
      </div>

      {/* Lagret */}
      {savedForSession.length > 0 && (
        <div className="space-y-1.5">
          {savedForSession.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {activityEmoji(a.activity, types ?? [])} {activityLabel(a.activity, types ?? [])}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {staff.find((s) => s.leader?.id === a.leader_id)?.leader?.name ?? 'Ukjent'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeOne.mutate(a.id)} aria-label="Slett">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Forslag */}
      {draft && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Forslag — juster før du lagrer</p>
          {draft.map((d, idx) => (
            <div key={`${d.leaderId}-${idx}`} className="rounded-2xl bg-muted/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{d.name}</p>
                <div className="flex items-center gap-1.5">
                  <select
                    value={d.activity}
                    onChange={(e) =>
                      setDraft((prev) =>
                        (prev ?? []).map((row, i) => (i === idx ? { ...row, activity: e.target.value } : row)),
                      )
                    }
                    className="rounded-full border border-border bg-background px-2 py-1 text-xs"
                  >
                    {(types ?? []).map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.emoji} {a.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Fjern"
                    onClick={() => setDraft((prev) => (prev ?? []).filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                {d.repeat && (
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> har hatt denne før
                  </span>
                )}
                {d.outsideCompetence && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> mangler kompetanse
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          className="w-full gap-2 rounded-full"
          disabled={generateDay.isPending}
          onClick={() => generateDay.mutate()}
        >
          <Zap className="h-4 w-4" />
          {generateDay.isPending ? 'Genererer…' : 'Generer dagen + varsle'}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1 gap-2 rounded-full" onClick={generate}>
          <Wand2 className="h-4 w-4" /> Kun denne økten
        </Button>
        <Button
          className="flex-1 gap-2 rounded-full"
          disabled={!draft?.length || publish.isPending}
          onClick={() => publish.mutate()}
        >
          <Send className="h-4 w-4" /> Lagre + varsle
        </Button>
      </div>
    </div>
  );
}
