import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Minus, Plus, Settings2, Undo2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveLeirskoleWeek, useLeirskoleActivityTypes } from '@/hooks/useLeirskole';
import {
  useAddLeirskoleGroupCompletion,
  useDeleteLeirskoleGroupCompletion,
  useLeirskoleGroupCompletions,
  useLeirskoleGroupRequirements,
  useSetLeirskoleGroupCount,
  useSetLeirskoleGroupRequirement,
} from '@/hooks/useLeirskoleGroups';

/**
 * Elevgrupper: én side hvor man ser hva hver gruppe har gjennomført.
 * Ett trykk = gruppen har gjort aktiviteten. Ingen valg av dag eller økt.
 */
export default function LeirskoleGrupper() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: week, isLoading: weekLoading } = useActiveLeirskoleWeek();
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: requirements, isLoading: reqLoading } = useLeirskoleGroupRequirements();
  const { data: completions } = useLeirskoleGroupCompletions(week?.id);
  const addDone = useAddLeirskoleGroupCompletion();
  const removeDone = useDeleteLeirskoleGroupCompletion();
  const setCount = useSetLeirskoleGroupCount();
  const setRequirement = useSetLeirskoleGroupRequirement();
  const [setupOpen, setSetupOpen] = useState(false);

  const groupCount = week?.group_count ?? 5;
  const groups = useMemo(() => Array.from({ length: groupCount }, (_, i) => i + 1), [groupCount]);
  const reqs = requirements ?? [];

  const labelOf = (key: string) => types?.find((t) => t.key === key)?.label ?? key;
  const emojiOf = (key: string) => types?.find((t) => t.key === key)?.emoji ?? '•';

  /** Registreringer per gruppe + aktivitet. */
  const doneBy = useMemo(() => {
    const map = new Map<string, string[]>();
    (completions ?? []).forEach((c) => {
      const k = `${c.group_number}|${c.activity_key}`;
      map.set(k, [...(map.get(k) ?? []), c.id]);
    });
    return map;
  }, [completions]);

  const totalNeeded = groups.length * reqs.reduce((s, r) => s + r.required_count, 0);
  const totalDone = groups.reduce(
    (sum, g) =>
      sum + reqs.reduce((s, r) => s + Math.min(r.required_count, (doneBy.get(`${g}|${r.activity_key}`) ?? []).length), 0),
    0,
  );
  const pct = totalNeeded ? Math.round((totalDone / totalNeeded) * 100) : 0;

  const register = (group: number, activityKey: string) =>
    addDone.mutate(
      { weekId: week!.id, groupNumber: group, activityKey },
      {
        onSuccess: () => toast.success(`Gruppe ${group}: ${labelOf(activityKey)} ✓`),
        onError: () => toast.error('Kunne ikke registrere'),
      },
    );

  const undo = (group: number, activityKey: string) => {
    const list = doneBy.get(`${group}|${activityKey}`) ?? [];
    const last = list[list.length - 1];
    if (!last) return;
    removeDone.mutate(last, { onError: () => toast.error('Kunne ikke angre') });
  };

  if (weekLoading || reqLoading) {
    return (
      <div className="space-y-3 pb-6">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (!week) {
    return (
      <div className="space-y-3 pb-6">
        <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/mer')}>
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Button>
        <p className="oks-ls-pill px-4 py-3 text-sm text-muted-foreground">Ingen aktiv leirskoleuke.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in pb-8">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/mer')}>
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </Button>

      {/* Toppkort med fremdrift for hele uken */}
      <div className="oks-ls-pill oks-ls-stripe p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Elevgrupper</p>
        <h1 className="mt-0.5 text-2xl font-heading font-bold">{week.name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Trykk på en aktivitet når gruppen har gjennomført den — alle gruppene skal oppleve alt.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums">
            {totalDone}/{totalNeeded}
          </span>
        </div>

        {isAdmin && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5 text-primary" /> {groupCount} grupper
            </span>
            <button
              type="button"
              aria-label="Én gruppe mindre"
              onClick={() => setCount.mutate({ weekId: week.id, groupCount: groupCount - 1 })}
              className="rounded-full bg-muted/70 p-1.5"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Én gruppe mer"
              onClick={() => setCount.mutate({ weekId: week.id, groupCount: groupCount + 1 })}
              className="rounded-full bg-muted/70 p-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-semibold"
            >
              <Settings2 className="h-3.5 w-3.5" /> Krav
            </button>
          </div>
        )}
      </div>

      {/* Hvilke aktiviteter som er obligatoriske */}
      {isAdmin && setupOpen && (
        <div className="oks-ls-pill p-3">
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Obligatoriske aktiviteter — trykk for å øke antall ganger
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(types ?? []).map((t) => {
              const req = reqs.find((r) => r.activity_key === t.key);
              const n = req?.required_count ?? 0;
              return (
                <div
                  key={t.key}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
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
                    <span className="max-w-[8rem] truncate">{t.label}</span>
                    {n > 0 && <span className="tabular-nums">×{n}</span>}
                  </button>
                  {n > 0 && (
                    <button
                      type="button"
                      aria-label={`Færre ganger ${t.label}`}
                      onClick={() => setRequirement.mutate({ activityKey: t.key, requiredCount: n - 1, sortOrder: req?.sort_order })}
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
      )}

      {reqs.length === 0 ? (
        <p className="oks-ls-pill px-4 py-3 text-sm text-muted-foreground">
          Ingen obligatoriske aktiviteter er satt opp ennå.
        </p>
      ) : (
        groups.map((g) => {
          const groupDone = reqs.reduce(
            (s, r) => s + Math.min(r.required_count, (doneBy.get(`${g}|${r.activity_key}`) ?? []).length),
            0,
          );
          const groupNeeded = reqs.reduce((s, r) => s + r.required_count, 0);
          const complete = groupDone >= groupNeeded;

          return (
            <div key={g} className="oks-ls-pill p-3">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    complete ? 'bg-emerald-500 text-white' : 'bg-primary/15 text-primary'
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" /> : g}
                </span>
                <span className="flex-1 text-sm font-semibold">Gruppe {g}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {groupDone}/{groupNeeded}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {reqs.map((r) => {
                  const done = (doneBy.get(`${g}|${r.activity_key}`) ?? []).length;
                  const full = done >= r.required_count;
                  return (
                    <div
                      key={r.activity_key}
                      className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-colors ${
                        full
                          ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm'
                          : done > 0
                            ? 'border-amber-500/50 bg-amber-500/12'
                            : 'border-dashed border-border/70'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => register(g, r.activity_key)}
                        aria-label={`Registrer ${labelOf(r.activity_key)} for gruppe ${g}`}
                        className={`flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-100 ${
                          full ? 'text-white' : ''
                        }`}
                      >
                        <span className="text-base leading-none">{emojiOf(r.activity_key)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{labelOf(r.activity_key)}</span>
                          <span className="flex items-center gap-1 pt-0.5">
                            {Array.from({ length: r.required_count }, (_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-4 rounded-full ${
                                  i < done ? (full ? 'bg-white' : 'bg-amber-500') : 'bg-muted'
                                }`}
                              />
                            ))}
                            {!full && <span className="pl-0.5 text-[10px] text-muted-foreground">trykk</span>}
                          </span>
                        </span>
                        {full ? (
                          <Check className="h-4 w-4 shrink-0 text-white" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {done > 0 && (
                        <button
                          type="button"
                          aria-label={`Angre siste ${labelOf(r.activity_key)} for gruppe ${g}`}
                          onClick={() => undo(g, r.activity_key)}
                          className={`shrink-0 rounded-full p-1 ${full ? 'text-white/90 hover:text-white' : 'text-muted-foreground'}`}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
