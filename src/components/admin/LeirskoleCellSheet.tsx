import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertTriangle, Check } from 'lucide-react';
import { useSaveLeirskoleWeekPlanCell, type LeirskoleActivityType } from '@/hooks/useLeirskole';
import { dayLabel } from '@/lib/leirskoleDates';
import { activityLine } from '@/lib/leirskoleRandomPlan';

export interface CellTarget {
  date: string;
  /** formiddag | ettermiddag | kveld | postId for egne økter på ankomst/avreise. */
  session: string | null;
  rowIndex: number | null;
  postId?: string | null;
  label: string;
  /** 'normal' | 'arrival' | 'departure' — ankomst krever ikke kompetanse. */
  dayType?: 'normal' | 'arrival' | 'departure';
}

export interface CellLeader {
  id: string;
  name: string;
  competencies: string[];
}

/** Rediger én rute: hvilke aktiviteter, og hvilken leder som tar hver av dem. */
export function LeirskoleCellSheet({
  open,
  onOpenChange,
  weekId,
  target,
  content,
  types,
  onDuty,
  allStaff,
  assignments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekId: string;
  target: CellTarget | null;
  content: string;
  types: LeirskoleActivityType[];
  onDuty: CellLeader[];
  /** Alle ledere som jobber denne uken — kan velges selv om de ikke står på vakten. */
  allStaff?: CellLeader[];
  /** Aktivitetstildelinger for denne dagen + økten. */
  assignments: { leader_id: string; activity: string }[];
}) {
  const qc = useQueryClient();
  const savePlan = useSaveLeirskoleWeekPlanCell();

  const lines = useMemo(
    () => content.split('\n').map((l) => l.trim()).filter(Boolean),
    [content],
  );

  const selected = useMemo(
    () => types.filter((t) => lines.some((l) => l.toLowerCase().includes(t.label.toLowerCase()))),
    [types, lines],
  );

  const setLines = (next: string[]) => {
    if (!target) return;
    savePlan.mutate(
      {
        weekId,
        date: target.date,
        rowIndex: target.rowIndex,
        content: next.join('\n'),
        color: 'neutral',
        postId: target.postId ?? undefined,
      },
      { onError: () => toast.error('Kunne ikke lagre ruten') },
    );
  };

  const setLeader = useMutation({
    mutationFn: async ({ activity, leaderId }: { activity: string; leaderId: string }) => {
      if (!target?.session) throw new Error('Denne økten kan ikke få aktivitetsansvar');
      const base = supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', weekId)
        .eq('date', target.date)
        .eq('session', target.session);
      const { error: delError } = await base.eq('activity', activity);
      if (delError) throw delError;
      if (!leaderId) return;
      const { error: delLeader } = await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', weekId)
        .eq('date', target.date)
        .eq('session', target.session)
        .eq('leader_id', leaderId);
      if (delLeader) throw delLeader;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date: target.date,
        session: target.session,
        leader_id: leaderId,
        activity,
        auto_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-activities'] });
      qc.invalidateQueries({ queryKey: ['leirskole-activity-history'] });
      toast.success('Oppdatert');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
  });

  const leaderFor = (activity: string) =>
    assignments.find((a) => a.activity === activity)?.leader_id ?? '';

  const isArrival = target?.dayType === 'arrival';

  /** Ledere som ikke står på denne vakten, men som er med i uken. */
  const offDuty = useMemo(
    () => (allStaff ?? []).filter((l) => !onDuty.some((d) => d.id === l.id)),
    [allStaff, onDuty],
  );
  const pool = useMemo(() => [...onDuty, ...offDuty], [onDuty, offDuty]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>
            {target ? `${dayLabel(target.date)} · ${target.label}` : ''}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-4 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktiviteter i økten
            </p>
            <div className="flex flex-wrap gap-1.5">
              {types.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen aktiviteter lagt inn ennå.</p>
              )}
              {types.map((t) => {
                const text = activityLine(t);
                const active = selected.some((s) => s.key === t.key);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setLines(
                        active
                          ? lines.filter((l) => !l.toLowerCase().includes(t.label.toLowerCase()))
                          : [...lines, text],
                      )
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{t.emoji ?? '•'}</span>
                    <span>{t.label}</span>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {target?.session && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hvem tar hva ({onDuty.length} på vakt)
              </p>
              {selected.length === 0 && (
                <p className="text-sm text-muted-foreground">Velg aktiviteter først.</p>
              )}
              <div className="space-y-2">
                {selected.map((t) => {
                  const current = leaderFor(t.key);
                  const leader = pool.find((l) => l.id === current);
                  const lacks =
                    !isArrival &&
                    !!leader &&
                    leader.competencies.length > 0 &&
                    !leader.competencies.includes(t.key);
                  return (
                    <div key={t.key} className="rounded-2xl bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {t.emoji} {t.label}
                        </span>
                        {lacks && (
                          <span className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3" /> mangler kompetanse
                          </span>
                        )}
                        {isArrival && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Ankomst — kompetanse fri</span>
                        )}
                      </div>
                      <select
                        value={current}
                        disabled={setLeader.isPending}
                        onChange={(e) => setLeader.mutate({ activity: t.key, leaderId: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
                      >
                        <option value="">Ingen valgt</option>
                        {onDuty.length > 0 && (
                          <optgroup label="På vakt">
                            {onDuty.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                                {!isArrival && l.competencies.length > 0 && !l.competencies.includes(t.key)
                                  ? ' (uten kompetanse)'
                                  : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {offDuty.length > 0 && (
                          <optgroup label="Andre i uken">
                            {offDuty.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                                {!isArrival && l.competencies.length > 0 && !l.competencies.includes(t.key)
                                  ? ' (uten kompetanse)'
                                  : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {current && !pool.some((l) => l.id === current) && (
                          <option value={current}>Leder utenfor uken</option>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
