import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Lock, LockOpen } from 'lucide-react';
import { shortDate } from '@/lib/leirskoleDates';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import { useSetLeirskoleDayLock } from '@/hooks/useLeirskole';

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
  kind: 'over' | 'rest' | 'clash' | 'empty';
  date: string;
  text: string;
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
};

/**
 * Viser hva som må endres for at hele uken skal gå opp etter en endring,
 * og lar deg låse dagene du ikke vil at generatoren eller nye endringer skal røre.
 */
export function LeirskoleWeekImpact({
  weekId,
  dates,
  posts,
  staff,
  kitchenDays,
  lockedDates,
  maxHours,
  activeDate,
  onPickDate,
}: {
  weekId: string;
  dates: string[];
  posts: Post[];
  staff: StaffRow[];
  kitchenDays: { date: string; staff_id: string }[];
  lockedDates: Set<string>;
  maxHours: number;
  activeDate: string;
  onPickDate?: (date: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const setLock = useSetLeirskoleDayLock();
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
        out.push({ kind: 'empty', date: p.date, text: `${p.name} har ingen ledere.` }),
      );

    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [posts, kitchenDays, dates, maxHours, nameOf]);

  const byDate = useMemo(() => {
    const map = new Map<string, Impact[]>();
    impacts.forEach((i) => map.set(i.date, [...(map.get(i.date) ?? []), i]));
    return map;
  }, [impacts]);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {impacts.length === 0 ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span className="flex-1 text-sm font-semibold">
          {impacts.length === 0
            ? 'Uken går opp etter endringene'
            : `${impacts.length} ting må endres for at uken skal gå opp`}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dates.map((d) => {
              const locked = lockedDates.has(d);
              const bad = (byDate.get(d) ?? []).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setLock.mutate({ weekId, date: d, locked: !locked })}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    locked
                      ? 'bg-primary text-primary-foreground'
                      : bad
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted/60 text-muted-foreground'
                  } ${d === activeDate ? 'ring-2 ring-primary/40' : ''}`}
                  title={locked ? 'Låst — trykk for å åpne' : 'Åpen — trykk for å låse dagen'}
                >
                  {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  {shortDate(d)}
                  {bad ? <span className="opacity-80">· {bad}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            Trykk på en dag for å låse den. Låste dager rører verken generatoren eller nye endringer.
          </p>

          {impacts.slice(0, 12).map((i, idx) => (
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
          {impacts.length > 12 && (
            <p className="px-1 text-[11px] text-muted-foreground">+{impacts.length - 12} flere …</p>
          )}
        </div>
      )}
    </div>
  );
}
