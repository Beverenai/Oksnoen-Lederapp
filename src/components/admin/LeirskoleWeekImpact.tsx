import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { shortDate } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import { resolveLeirskoleConflicts } from '@/lib/leirskoleAutoActivity';
import {
  useLeirskoleActivities,
  useLeirskoleActivityTypes,
  useLeirskoleWeekPlan,
} from '@/hooks/useLeirskole';
import { planSlots, splitPlanLines, SESSION_ROWS } from '@/lib/leirskolePlanSlots';

type Post = {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  assignments: { id: string; staff_id: string }[];
};

type StaffRow = { id: string; leader?: { id: string; name: string } | null };

type Impact = {
  kind: 'over' | 'rest' | 'clash' | 'empty' | 'plan';
  date: string;
  text: string;
  /** Kan «Løs» gjøre noe med denne? */
  fixable?: boolean;
};

const mins = (t: string) => {
  const [h, m] = (t ?? '00:00').slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const first = (n: string) => (n ?? '?').split(' ')[0];

const TONE: Record<Impact['kind'], string> = {
  over: 'text-destructive',
  rest: 'text-destructive',
  clash: 'text-destructive',
  empty: 'text-amber-700 dark:text-amber-200',
  plan: 'text-amber-700 dark:text-amber-200',
};

/**
 * Viser hva som må endres for at hele uken skal gå opp etter en endring,
 * og lar deg låse dagene du ikke vil at generatoren eller nye endringer skal røre.
 */
export function LeirskoleWeekImpact({
  dates,
  posts,
  staff,
  kitchenDays,
  maxHours,
  onPickDate,
  weekId,
  lockedDates,
}: {
  dates: string[];
  posts: Post[];
  staff: StaffRow[];
  kitchenDays: { date: string; staff_id: string }[];
  maxHours: number;
  onPickDate?: (date: string) => void;
  weekId?: string;
  /** Låste dager røres ikke av «Løs». */
  lockedDates?: string[];
}) {
  const [open, setOpen] = useState(true);
  const [fixing, setFixing] = useState(false);
  const qc = useQueryClient();
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: activities } = useLeirskoleActivities(weekId);
  const { data: planCells } = useLeirskoleWeekPlan(weekId);
  const nameOf = useMemo(
    () => new Map(staff.map((s) => [s.id, s.leader?.name ?? 'Leder'])),
    [staff],
  );

  const impacts = useMemo<Impact[]>(() => {
    const out: Impact[] = [];

    // Timer per leder per dag (kjøkkenvakt = full dag)
    const hours = new Map<string, Map<string, number>>();
    const add = (date: string, staffId: string, h: number) => {
      const day = hours.get(date) ?? new Map<string, number>();
      day.set(staffId, (day.get(staffId) ?? 0) + h);
      hours.set(date, day);
    };
    posts.forEach((p) =>
      p.assignments.forEach((a) => add(p.date, a.staff_id, Number(p.duration_hours ?? 0))),
    );
    kitchenDays.forEach((k) => add(k.date, k.staff_id, KITCHEN_DAY_HOURS));

    dates.forEach((date) => {
      (hours.get(date) ?? new Map<string, number>()).forEach((v, staffId) => {
        if (v > maxHours + 0.01) {
          out.push({
            kind: 'over',
            date,
            text: `${first(nameOf.get(staffId) ?? '?')} har ${v.toFixed(1)}t — ${(v - maxHours).toFixed(
              1,
            )}t over planleggingsgrensen. Flytt en økt til en annen leder eller dag.`,
          });
        }
      });
    });

    // Overlapp og hvile etter endt arbeidsdag
    const byStaff = new Map<string, { p: Post; s: number; e: number }[]>();
    posts.forEach((p) => {
      const dayIdx = dates.indexOf(p.date);
      if (dayIdx < 0) return;
      const s = dayIdx * 1440 + mins(p.start_time);
      let e = dayIdx * 1440 + mins(p.end_time);
      if (e <= s) e += 1440;
      p.assignments.forEach((a) =>
        byStaff.set(a.staff_id, [...(byStaff.get(a.staff_id) ?? []), { p, s, e }]),
      );
    });

    byStaff.forEach((list, staffId) => {
      const sorted = [...list].sort((a, b) => a.s - b.s);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const who = first(nameOf.get(staffId) ?? '?');
        if (cur.s < prev.e) {
          out.push({
            kind: 'clash',
            date: cur.p.date,
            text: `${who} står på både ${prev.p.name} og ${cur.p.name} samtidig — fjern én av dem.`,
          });
          continue;
        }
        const rest = (cur.s - prev.e) / 60;
        if (prev.p.date !== cur.p.date && rest < 10.99) {
          out.push({
            kind: 'rest',
            date: cur.p.date,
            text: `${who} får bare ${rest.toFixed(1)}t hvile etter ${prev.p.name} — start senere eller bytt leder på ${cur.p.name}.`,
          });
        }
      }
    });

    // Økter uten ledere
    posts
      .filter((p) => p.assignments.length === 0)
      .forEach((p) =>
        out.push({ kind: 'empty', date: p.date, fixable: true, text: `${p.name} har ingen ledere.` }),
      );

    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [posts, kitchenDays, dates, maxHours, nameOf]);

  /** Avvik mellom «Dag til dag» og aktivitetene: tomme plasser og aktiviteter utenfor planen. */
  const planImpacts = useMemo<Impact[]>(() => {
    if (!types?.length) return [];
    const out: Impact[] = [];
    dates.forEach((date) => {
      SESSION_ROWS.forEach((row) => {
        const post = posts.find(
          (p) => p.date === date && (p.name ?? '').trim().toLowerCase() === row.label.toLowerCase(),
        );
        if (!post) return;
        const lines = splitPlanLines(
          (planCells ?? []).find((c) => c.date === date && c.row_index === row.row)?.content,
        );
        const acts = (activities ?? [])
          .filter((a) => a.date === date && a.session === row.session)
          .map((a) => ({ leader_id: a.leader_id, activity: a.activity }));
        const { slots, staleLeaderIds } = planSlots(lines, types, acts);
        const openSlots = slots.filter((s) => !s.leaderId);
        if (openSlots.length > 0) {
          // Hvor mange ledere står på vakten uten aktivitet? Uten dem kan «Løs» ikke fylle noe.
          const filled = slots.filter((s) => s.leaderId).length;
          const free = Math.max(0, post.assignments.length - filled);
          const list = openSlots.map((s) => s.label).join(', ');
          out.push({
            kind: 'plan',
            date,
            fixable: true,
            text:
              free > 0
                ? `${row.label}: ${openSlots.length} plass${openSlots.length === 1 ? '' : 'er'} uten leder (${list}).`
                : `${row.label}: ${openSlots.length} plass${openSlots.length === 1 ? '' : 'er'} uten leder (${list}) — ingen på vakten er ledig. «Løs» prøver å sette inn flere ledere.`,
          });
        }
        if (staleLeaderIds.length > 0) {
          out.push({
            kind: 'plan',
            date,
            fixable: true,
            text: `${row.label}: ${staleLeaderIds.length} leder(e) har en aktivitet som ikke står i «Dag til dag».`,
          });
        }
      });
    });
    return out;
  }, [dates, posts, planCells, activities, types]);

  const all = useMemo(
    () => [...impacts, ...planImpacts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [impacts, planImpacts],
  );

  const fixableImpacts = useMemo(
    () => [...planImpacts, ...impacts.filter((i) => i.fixable)],
    [planImpacts, impacts],
  );
  const canFix = !!weekId && fixableImpacts.length > 0;

  const fix = async () => {
    if (!weekId) return;
    setFixing(true);
    try {
      const locked = new Set(lockedDates ?? []);
      const targets = Array.from(new Set(fixableImpacts.map((i) => i.date))).filter((d) => !locked.has(d));
      if (!targets.length) {
        toast.info('Alt som står igjen må løses manuelt — det mangler ledere på vaktene.');
        return;
      }
      const res = await resolveLeirskoleConflicts({ weekId, dates: targets, maxHours });
      qc.invalidateQueries({ queryKey: ['leirskole-activities'] });
      qc.invalidateQueries({ queryKey: ['leirskole-activity-history'] });
      qc.invalidateQueries({ queryKey: ['leirskole-my-activities'] });
      qc.invalidateQueries({ queryKey: ['leirskole-week-plan'] });
      qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
      qc.invalidateQueries({ queryKey: ['leirskole-my-shifts'] });
      if (res.removed === 0 && res.created === 0) {
        toast.info('Ingen ledere er ledige innenfor timegrensen — løs resten manuelt.');
      } else {
        toast.success(`Ryddet ${res.removed} og fylte ${res.created} plasser`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunne ikke løse konfliktene');
    } finally {
      setFixing(false);
    }
  };

  // Ingenting å vise når alt går opp.
  if (all.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/70">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1 text-sm font-semibold">
            {all.length} ting må løses
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {canFix && (
          <button
            type="button"
            onClick={fix}
            disabled={fixing}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Løs
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          {all.slice(0, 12).map((i, idx) => (
            <button
              key={`${i.date}-${idx}`}
              type="button"
              onClick={() => onPickDate?.(i.date)}
              className="flex w-full items-start gap-2 rounded-xl bg-muted/40 px-2.5 py-2 text-left text-xs hover:bg-muted"
            >
              <span className="w-16 shrink-0 font-bold uppercase text-muted-foreground">{shortDate(i.date)}</span>
              <span className={`min-w-0 flex-1 ${TONE[i.kind]}`}>{i.text}</span>
            </button>
          ))}
          {all.length > 12 && (
            <p className="px-1 text-[11px] text-muted-foreground">+{all.length - 12} flere …</p>
          )}
        </div>
      )}
    </div>
  );
}
