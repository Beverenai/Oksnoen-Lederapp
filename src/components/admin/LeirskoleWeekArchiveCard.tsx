import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Archive, Save, Download, Clock, Loader2 } from 'lucide-react';
import {
  useLeirskoleWeekSnapshot,
  useSaveLeirskoleWeekSnapshot,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

interface Props {
  week: LeirskoleWeek;
  allWeeks: { id: string; name: string; start_date: string; end_date: string }[];
}

/**
 * Lagrer alt som skjedde i en leirskoleuke (ledere, vakter, timer, kjøkken, aktiviteter)
 * på samme måte som periodearkivet i sommerleir – slik at det ligger fast per uke.
 */
export function LeirskoleWeekArchiveCard({ week, allWeeks }: Props) {
  const [viewWeekId, setViewWeekId] = useState(week.id);
  const { data: rows, isLoading } = useLeirskoleWeekSnapshot(viewWeekId);
  const save = useSaveLeirskoleWeekSnapshot();

  const viewWeek = allWeeks.find((w) => w.id === viewWeekId);
  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      leaders: list.length,
      hours: list.reduce((sum, r) => sum + Number(r.hours ?? 0), 0),
      shifts: list.reduce((sum, r) => sum + (r.shift_count ?? 0), 0),
      activities: list.reduce((sum, r) => sum + (r.activity_count ?? 0), 0),
    };
  }, [rows]);

  const savedAt = rows?.[0]?.snapshot_at ? new Date(rows[0].snapshot_at) : null;

  const exportCsv = () => {
    const list = rows ?? [];
    if (list.length === 0) return;
    const head = ['Navn', 'Rolle', 'Vakter', 'Timer', 'Kjøkkendager', 'Kjøkkentimer', 'Aktiviteter', 'Kompetanse'];
    const lines = list.map((r) => [
      r.leader_name,
      r.role_label ?? '',
      String(r.shift_count ?? 0),
      Number(r.hours ?? 0).toFixed(1),
      String(r.kitchen_days ?? 0),
      Number(r.kitchen_hours ?? 0).toFixed(1),
      (r.activities ?? []).join(' / '),
      (r.competencies ?? []).join(' / '),
    ]);
    const csv = [head, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `leirskole-${(viewWeek?.name ?? 'uke').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-heading font-bold">
          <Archive className="h-5 w-5 text-primary" /> Ukesarkiv
        </h2>
        <p className="text-sm text-muted-foreground">
          Lagrer lederne som var satt opp og hva de jobbet – fast per leirskoleuke.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allWeeks.map((w) => (
          <button
            key={w.id}
            onClick={() => setViewWeekId(w.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              w.id === viewWeekId
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {w.name}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {savedAt
                ? `Sist lagret ${savedAt.toLocaleDateString('nb-NO')} ${savedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
                : 'Ikke lagret ennå'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5 rounded-full"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(viewWeekId, {
                    onSuccess: (n) => toast.success(`Lagret ${n} ledere i arkivet`),
                    onError: (e) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
                  })
                }
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lagre uken
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-full"
                disabled={(rows ?? []).length === 0}
                onClick={exportCsv}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: totals.leaders, l: 'Ledere' },
              { v: totals.shifts, l: 'Vakter' },
              { v: `${totals.hours.toFixed(0)}t`, l: 'Timer' },
              { v: totals.activities, l: 'Aktiviteter' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-muted/40 px-2 py-1.5">
                <p className="text-base font-bold tabular-nums">{s.v}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laster…</p>
          ) : (rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingenting lagret for denne uken ennå. Trykk «Lagre uken» når uken er ferdig.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(rows ?? []).map((r) => (
                <div key={r.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{r.leader_name}</p>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {Number(r.hours ?? 0).toFixed(1)} t
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.shift_count ?? 0} vakter · {r.kitchen_days ?? 0} kjøkkendager · {r.activity_count ?? 0} aktiviteter
                    {r.role_label ? ` · ${r.role_label}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
