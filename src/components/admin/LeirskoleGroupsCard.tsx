import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check, Minus, Plus, Trash2, Users } from 'lucide-react';
import { dayLabel, shortDate } from '@/lib/leirskoleDates';
import { useLeirskoleActivityTypes, type LeirskoleWeek } from '@/hooks/useLeirskole';
import {
  useAddLeirskoleGroupCompletion,
  useDeleteLeirskoleGroupCompletion,
  useLeirskoleGroupCompletions,
  useLeirskoleGroupRequirements,
  useSetLeirskoleGroupCount,
  useSetLeirskoleGroupRequirement,
} from '@/hooks/useLeirskoleGroups';

const SESSIONS = [
  { key: 'formiddag', label: 'Økt 1' },
  { key: 'ettermiddag', label: 'Økt 2' },
  { key: 'kveld', label: 'Økt 3' },
];

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 21) {
    out.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * «Elevgrupper»: hvor mange grupper som er på plass i uken, og hva hver gruppe
 * har gjennomført av de obligatoriske aktivitetene. Admin trykker på ruten for
 * å registrere at gruppen har gjort aktiviteten (flere ganger om nødvendig).
 */
export function LeirskoleGroupsCard({ week }: { week: LeirskoleWeek }) {
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: requirements } = useLeirskoleGroupRequirements();
  const { data: completions } = useLeirskoleGroupCompletions(week.id);
  const addDone = useAddLeirskoleGroupCompletion();
  const removeDone = useDeleteLeirskoleGroupCompletion();
  const setCount = useSetLeirskoleGroupCount();
  const setRequirement = useSetLeirskoleGroupRequirement();

  const [open, setOpen] = useState(() => localStorage.getItem('leirskole-groups-open') !== '0');
  const toggle = () =>
    setOpen((v) => {
      localStorage.setItem('leirskole-groups-open', v ? '0' : '1');
      return !v;
    });

  const groupCount = week.group_count ?? 5;
  const groups = useMemo(() => Array.from({ length: groupCount }, (_, i) => i + 1), [groupCount]);
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const labelOf = (key: string) => types?.find((t) => t.key === key)?.label ?? key;
  const emojiOf = (key: string) => types?.find((t) => t.key === key)?.emoji ?? '•';

  /** Gjennomførte aktiviteter per gruppe + aktivitet. */
  const doneBy = useMemo(() => {
    const map = new Map<string, { id: string; date: string | null; session: string | null }[]>();
    (completions ?? []).forEach((c) => {
      const k = `${c.group_number}|${c.activity_key}`;
      map.set(k, [...(map.get(k) ?? []), { id: c.id, date: c.date, session: c.session }]);
    });
    return map;
  }, [completions]);

  const reqs = requirements ?? [];
  const totalNeeded = groups.length * reqs.reduce((s, r) => s + r.required_count, 0);
  const totalDone = useMemo(
    () =>
      groups.reduce(
        (sum, g) =>
          sum +
          reqs.reduce(
            (s, r) => s + Math.min(r.required_count, (doneBy.get(`${g}|${r.activity_key}`) ?? []).length),
            0,
          ),
        0,
      ),
    [groups, reqs, doneBy],
  );

  const register = (group: number, activityKey: string, date?: string, session?: string) => {
    addDone.mutate(
      { weekId: week.id, groupNumber: group, activityKey, date: date ?? null, session: session ?? null },
      {
        onSuccess: () => toast.success(`Gruppe ${group}: ${labelOf(activityKey)} registrert`),
        onError: () => toast.error('Kunne ikke registrere'),
      },
    );
  };

  return (
    <div className="oks-ls-pill oks-ls-stripe overflow-hidden">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 p-4 text-left">
        <Users className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Elevgrupper</span>
          <span className="block truncate text-xs text-muted-foreground">
            Hva hver gruppe har gjort — så alle får oppleve alt
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {totalDone} av {totalNeeded}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-4">
          {/* Antall grupper denne uken */}
          <div className="flex items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2">
            <span className="flex-1 text-xs font-semibold">Grupper denne uken</span>
            <button
              type="button"
              aria-label="Én gruppe mindre"
              onClick={() => setCount.mutate({ weekId: week.id, groupCount: groupCount - 1 })}
              className="rounded-full bg-background p-1.5 shadow-sm"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{groupCount}</span>
            <button
              type="button"
              aria-label="Én gruppe mer"
              onClick={() => setCount.mutate({ weekId: week.id, groupCount: groupCount + 1 })}
              className="rounded-full bg-background p-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Rutenett: grupper nedover, obligatoriske aktiviteter bortover */}
          <div className="overflow-x-auto">
            <div className="min-w-max space-y-1">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `5rem repeat(${Math.max(reqs.length, 1)}, minmax(6.5rem, 1fr))` }}
              >
                <span />
                {reqs.map((r) => (
                  <div key={r.activity_key} className="px-1 pb-1 text-center">
                    <p className="truncate text-[11px] font-bold">
                      {emojiOf(r.activity_key)} {labelOf(r.activity_key)}
                    </p>
                    <p className="text-[9.5px] text-muted-foreground">{r.required_count}× kreves</p>
                  </div>
                ))}
                {reqs.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    Ingen obligatoriske aktiviteter satt opp ennå.
                  </p>
                )}
              </div>

              {groups.map((g) => (
                <div
                  key={g}
                  className="grid items-stretch gap-1"
                  style={{ gridTemplateColumns: `5rem repeat(${Math.max(reqs.length, 1)}, minmax(6.5rem, 1fr))` }}
                >
                  <div className="flex items-center px-1 text-xs font-bold">Gruppe {g}</div>
                  {reqs.map((r) => {
                    const list = doneBy.get(`${g}|${r.activity_key}`) ?? [];
                    const done = list.length;
                    const complete = done >= r.required_count;
                    return (
                      <Popover key={r.activity_key}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Gruppe ${g} · ${labelOf(r.activity_key)} — ${done} av ${r.required_count}`}
                            className={`flex min-h-[2.6rem] flex-col items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                              complete
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : done > 0
                                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-200'
                                  : 'border-dashed border-border/70 text-muted-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span className="flex items-center gap-1 tabular-nums">
                              {complete && <Check className="h-3 w-3" />}
                              {done}/{r.required_count}
                            </span>
                            {list.some((x) => x.date) && (
                              <span className="text-[9px] font-medium opacity-80">
                                {shortDate(list.find((x) => x.date)!.date as string)}
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="center" collisionPadding={12} className="z-50 w-[min(19rem,calc(100vw-2rem))] p-2">
                          <p className="px-1 text-xs font-bold">
                            Gruppe {g} · {emojiOf(r.activity_key)} {labelOf(r.activity_key)}
                          </p>
                          <p className="px-1 pb-1.5 text-[11px] text-muted-foreground">
                            {done} av {r.required_count} gjennomført
                          </p>

                          {list.map((x) => (
                            <div
                              key={x.id}
                              className="flex items-center gap-2 rounded-xl bg-muted/40 px-2 py-1.5 text-[11px]"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span className="min-w-0 flex-1 truncate">
                                {x.date
                                  ? `${dayLabel(x.date)}${x.session ? ` · ${SESSIONS.find((s) => s.key === x.session)?.label ?? x.session}` : ''}`
                                  : 'Registrert'}
                              </span>
                              <button
                                type="button"
                                aria-label="Fjern registreringen"
                                onClick={() => removeDone.mutate(x.id)}
                                className="shrink-0 p-0.5 text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}

                          <div className="mt-1.5 border-t border-border/60 pt-1.5">
                            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Registrer gjennomført
                            </p>
                            <button
                              type="button"
                              onClick={() => register(g, r.activity_key)}
                              className="mb-1 w-full rounded-xl bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground"
                            >
                              Uten dato
                            </button>
                            <div className="max-h-40 space-y-1 overflow-y-auto">
                              {dates.map((d) => (
                                <div key={d} className="flex items-center gap-1">
                                  <span className="w-14 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                                    {dayLabel(d)}
                                  </span>
                                  {SESSIONS.map((s) => (
                                    <button
                                      key={s.key}
                                      type="button"
                                      onClick={() => register(g, r.activity_key, d, s.key)}
                                      className="flex-1 rounded-lg bg-muted/60 px-1 py-1 text-[10px] font-semibold hover:bg-muted"
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Hvilke aktiviteter som er obligatoriske, og hvor mange ganger */}
          <div className="rounded-2xl border border-border/60 p-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Obligatoriske aktiviteter
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(types ?? []).map((t) => {
                const req = reqs.find((r) => r.activity_key === t.key);
                const n = req?.required_count ?? 0;
                return (
                  <div
                    key={t.key}
                    className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                      n > 0 ? 'border-primary/50 bg-primary/10' : 'border-border/60 text-muted-foreground'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setRequirement.mutate(
                          { activityKey: t.key, requiredCount: n + 1, sortOrder: req?.sort_order ?? t.sort_order },
                          { onError: () => toast.error('Kunne ikke lagre kravet') },
                        )
                      }
                      className="flex items-center gap-1"
                    >
                      <span>{t.emoji ?? '•'}</span>
                      <span className="max-w-[7rem] truncate">{t.label}</span>
                      {n > 0 && <span className="tabular-nums">×{n}</span>}
                    </button>
                    {n > 0 && (
                      <button
                        type="button"
                        aria-label={`Færre ganger ${t.label}`}
                        onClick={() =>
                          setRequirement.mutate({ activityKey: t.key, requiredCount: n - 1, sortOrder: req?.sort_order })
                        }
                        className="rounded-full bg-muted/70 p-0.5"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
