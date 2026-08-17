import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ListChecks } from 'lucide-react';
import {
  useLeirskoleActivities,
  useLeirskoleSchedule,
  useLeirskoleActivityTypes,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import {
  LEIRSKOLE_ACTIVITY_SESSIONS,
  activityEmoji,
  activityLabel,
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

/** Vaktplan-oversikt: hvem har hvilken økt, og hva de gjør — redigerbart manuelt. */
export function LeirskoleDayActivityCard({ week, staff }: Props) {
  const qc = useQueryClient();
  const days = useMemo(() => datesInWeek(week.start_date, week.end_date), [week.start_date, week.end_date]);
  const today = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(days.includes(today) ? today : days[0]);

  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: saved } = useLeirskoleActivities(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);

  const setActivity = useMutation({
    mutationFn: async ({ leaderId, session, activity }: { leaderId: string; session: string; activity: string }) => {
      const { error: delError } = await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', week.id)
        .eq('date', date)
        .eq('session', session)
        .eq('leader_id', leaderId);
      if (delError) throw delError;
      if (!activity) return;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: week.id,
        date,
        session,
        leader_id: leaderId,
        activity,
        auto_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-activities', week.id] });
      qc.invalidateQueries({ queryKey: ['leirskole-activity-history'] });
      toast.success('Aktivitet oppdatert');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
  });

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  /** Øktene lederen faktisk jobber denne dagen (fra vaktplanen). */
  const shiftsByLeader = useMemo(() => {
    const map = new Map<string, string[]>();
    (posts ?? [])
      .filter((p) => p.date === date)
      .forEach((p) =>
        p.assignments.forEach((a) => {
          const leaderId = staffById.get(a.staff_id)?.leader?.id;
          if (!leaderId) return;
          const list = map.get(leaderId) ?? [];
          if (!list.includes(p.name)) list.push(p.name);
          map.set(leaderId, list);
        }),
      );
    return map;
  }, [posts, date, staffById]);

  const rows = useMemo(() => {
    const forDay = (saved ?? []).filter((a) => a.date === date);
    const ids = new Set<string>([...shiftsByLeader.keys(), ...forDay.map((a) => a.leader_id)]);
    if (ids.size === 0) staff.forEach((s) => s.leader && ids.add(s.leader.id));
    return [...ids]
      .map((leaderId) => ({
        leaderId,
        name: staff.find((s) => s.leader?.id === leaderId)?.leader?.name ?? 'Ukjent',
        shifts: shiftsByLeader.get(leaderId) ?? [],
        bySession: Object.fromEntries(
          LEIRSKOLE_ACTIVITY_SESSIONS.map((s) => [
            s.key,
            forDay.find((a) => a.leader_id === leaderId && a.session === s.key)?.activity ?? '',
          ]),
        ) as Record<string, string>,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }, [saved, date, shiftsByLeader, staff]);

  return (
    <div className="oks-ls-pill space-y-3 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" /> Hvem har hvilken økt
        </p>
        <p className="text-xs text-muted-foreground">
          Oversikt per leder for dagen — endre aktiviteten manuelt om du vil.
        </p>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              d === date ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Ingen ledere registrert {dayLabel(date)}.</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.leaderId} className="rounded-2xl bg-muted/40 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold">{row.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {row.shifts.length ? row.shifts.join(' · ') : 'Fri'}
              </p>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {LEIRSKOLE_ACTIVITY_SESSIONS.map((s) => {
                const current = row.bySession[s.key] ?? '';
                return (
                  <div key={s.key} className="rounded-xl bg-background/70 p-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <select
                      value={current}
                      disabled={setActivity.isPending}
                      onChange={(e) =>
                        setActivity.mutate({ leaderId: row.leaderId, session: s.key, activity: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-lg border border-border bg-background px-1.5 py-1 text-xs"
                    >
                      <option value="">Fri</option>
                      {(types ?? []).map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.emoji} {t.label}
                        </option>
                      ))}
                      {current && !(types ?? []).some((t) => t.key === current) && (
                        <option value={current}>
                          {activityEmoji(current, types ?? [])} {activityLabel(current, types ?? [])}
                        </option>
                      )}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
