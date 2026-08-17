import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Repeat, Sparkles, Send } from 'lucide-react';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleActivityTypes,
  useLeirskoleSchedule,
  useLeirskoleWeekPlan,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import { activityEmoji, activityLabel, sessionLabel } from '@/lib/leirskoleActivities';
import { autoAssignWeek, type AutoAssignResult } from '@/lib/leirskoleAutoAssign';
import { dayLabel } from '@/lib/leirskoleDates';

type StaffRow = LeirskoleStaff & {
  leader: { id: string; name: string; leirskole_competencies: string[] | null } | null;
};

const ROW_TO_SESSION: Record<number, string> = { 1: 'formiddag', 2: 'ettermiddag', 3: 'kveld' };
const POST_TO_SESSION: Record<string, string> = {
  'økt 1': 'formiddag',
  'økt 2': 'ettermiddag',
  'økt 3': 'kveld',
};

/** Fordeler aktivitetene fra ukeplanleggeren på lederne som er på vakt. */
export function LeirskoleAutoActivityCard({ week, staff }: { week: LeirskoleWeek; staff: StaffRow[] }) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const { data: planCells } = useLeirskoleWeekPlan(week.id);
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: existing } = useLeirskoleActivities(week.id);
  const { data: history } = useLeirskoleActivityHistory();
  const [preview, setPreview] = useState<AutoAssignResult | null>(null);

  const staffToLeader = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => { if (s.leader) map.set(s.id, s.leader.id); });
    return map;
  }, [staff]);

  /** date|session -> leader_ids på vakt i den økten */
  const dutyBySlot = useMemo(() => {
    const map = new Map<string, string[]>();
    (posts ?? []).forEach((p) => {
      const session = POST_TO_SESSION[(p.name ?? '').trim().toLowerCase()];
      if (!session) return;
      const ids = p.assignments
        .map((a) => staffToLeader.get(a.staff_id))
        .filter(Boolean) as string[];
      const key = `${p.date}|${session}`;
      map.set(key, [...(map.get(key) ?? []), ...ids]);
    });
    return map;
  }, [posts, staffToLeader]);

  /** Aktivitetene som ligger i ukeplanleggeren, per dag + økt. */
  const slots = useMemo(() => {
    const list: { date: string; session: string; activities: string[]; onDuty: string[] }[] = [];
    (planCells ?? []).forEach((cell) => {
      const session = ROW_TO_SESSION[cell.row_index];
      if (!session) return;
      const lines = (cell.content ?? '')
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);
      if (!lines.length) return;
      const activities = (types ?? [])
        .filter((t) => lines.some((l) => l.includes(t.label.toLowerCase())))
        .map((t) => t.key);
      if (!activities.length) return;
      list.push({
        date: cell.date,
        session,
        activities,
        onDuty: dutyBySlot.get(`${cell.date}|${session}`) ?? [],
      });
    });
    return list;
  }, [planCells, types, dutyBySlot]);

  const manual = useMemo(
    () =>
      (existing ?? [])
        .filter((a) => !a.auto_generated)
        .map((a) => ({ date: a.date, session: a.session, activity: a.activity, leader_id: a.leader_id })),
    [existing],
  );

  const run = () => {
    if (!slots.length) {
      toast.error('Legg inn aktiviteter i ukeplanleggeren først');
      return;
    }
    const result = autoAssignWeek({
      slots,
      staff: staff
        .filter((s) => s.leader)
        .map((s) => ({
          leaderId: s.leader!.id,
          name: s.leader!.name,
          competencies: s.leader!.leirskole_competencies ?? [],
        })),
      manual,
      history: (history ?? []).map((h) => ({ leader_id: h.leader_id, activity: h.activity })),
    });
    setPreview(result);
    if (!result.assignments.length) toast.warning('Fant ingen ledere å fordele på');
  };

  const save = useMutation({
    mutationFn: async () => {
      const rows = preview?.assignments ?? [];
      if (!rows.length) throw new Error('Ingen fordeling å lagre');

      const dates = [...new Set(rows.map((r) => r.date))];
      const { error: delError } = await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', week.id)
        .eq('auto_generated', true)
        .in('date', dates);
      if (delError) throw delError;

      const { error } = await supabase.from('leirskole_activity_assignments').insert(
        rows.map((r) => ({
          week_id: week.id,
          date: r.date,
          session: r.session,
          leader_id: r.leaderId,
          activity: r.activity,
          auto_generated: true,
          assigned_by: leader?.id ?? null,
        })),
      );
      if (error) throw error;

      const leaderIds = [...new Set(rows.map((r) => r.leaderId))];
      const { error: pushError } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Leirskole — aktiviteter',
          message: 'Aktivitetene dine for uken er klare.',
          leader_ids: leaderIds,
          sender_leader_id: leader?.id,
        },
      });
      return pushError ? 'Lagret, men varslingen kunne ikke sendes.' : null;
    },
    onSuccess: (warning) => {
      if (warning) toast.warning(warning);
      else toast.success('Aktivitetene er fordelt og lederne er varslet');
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['leirskole-activities', week.id] });
      qc.invalidateQueries({ queryKey: ['leirskole-activity-history'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof preview extends null ? never : NonNullable<typeof preview>['assignments']>();
    (preview?.assignments ?? []).forEach((a) => {
      const key = `${a.date}|${a.session}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [preview]);

  return (
    <div className="oks-ls-pill space-y-3 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Fordel aktiviteter
        </p>
        <p className="text-xs text-muted-foreground">
          Bruker ukeplanen: kun ledere med kompetansen og vakt i økten, og aldri samme aktivitet to økter på rad.
          Manuelle valg beholdes.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {slots.length} økter med aktiviteter i ukeplanen · {manual.length} manuelle tildelinger beholdes
      </p>

      <Button className="w-full gap-2 rounded-full" onClick={run}>
        <Sparkles className="h-4 w-4" /> Fordel aktiviteter for uken
      </Button>

      {preview && (
        <div className="space-y-2">
          {grouped.map(([key, rows]) => {
            const [date, session] = key.split('|');
            return (
              <div key={key} className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold">
                  {dayLabel(date)} · {sessionLabel(session)}
                </p>
                <div className="mt-1 space-y-1">
                  {rows.map((r) => (
                    <div key={`${r.activity}-${r.leaderId}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {activityEmoji(r.activity, types ?? [])} {activityLabel(r.activity, types ?? [])}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {r.repeat && <Repeat className="h-3 w-3" />}
                        {r.outsideCompetence && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        {r.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {preview.gaps.length > 0 && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Mangler leder ({preview.gaps.length})
              </p>
              <div className="mt-1 space-y-0.5">
                {preview.gaps.map((g, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    {dayLabel(g.date)} · {sessionLabel(g.session)} ·{' '}
                    {activityLabel(g.activity, types ?? [])} — {g.reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-full" onClick={() => setPreview(null)}>
              Avbryt
            </Button>
            <Button
              className="flex-1 gap-2 rounded-full"
              disabled={save.isPending || !preview.assignments.length}
              onClick={() => save.mutate()}
            >
              <Send className="h-4 w-4" /> {save.isPending ? 'Lagrer…' : 'Lagre + varsle'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
