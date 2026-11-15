import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Copy } from 'lucide-react';
import { useCopyLeirskoleDay, useLeirskoleSchedule, useLeirskoleWeeks } from '@/hooks/useLeirskole';
import { shortDate } from '@/lib/leirskoleDates';

function datesOf(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 31) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Kopier øktene fra en dag i en annen leirskoleuke til denne dagen.
 * Bemanning kopieres ikke — bare øktene, tidene og «Dag til dag»-innholdet.
 */
export function LeirskoleCopyDaySheet({
  weekId,
  targetDate,
  className,
}: {
  weekId: string;
  targetDate: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fromWeekId, setFromWeekId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  const { data: weeks } = useLeirskoleWeeks();
  const otherWeeks = useMemo(
    () => (weeks ?? []).filter((w) => w.id !== weekId),
    [weeks, weekId],
  );
  const activeFromWeek = useMemo(
    () => otherWeeks.find((w) => w.id === fromWeekId) ?? null,
    [otherWeeks, fromWeekId],
  );
  const { data: fromPosts } = useLeirskoleSchedule(activeFromWeek?.id);
  const copy = useCopyLeirskoleDay();

  const sourceDates = useMemo(
    () => (activeFromWeek ? datesOf(activeFromWeek.start_date, activeFromWeek.end_date) : []),
    [activeFromWeek],
  );

  const countFor = (date: string) => (fromPosts ?? []).filter((p) => p.date === date).length;
  const preview = fromDate ? (fromPosts ?? []).filter((p) => p.date === fromDate) : [];

  const run = () => {
    if (!activeFromWeek || !fromDate) return;
    copy.mutate(
      { fromWeekId: activeFromWeek.id, fromDate, toWeekId: weekId, toDate: targetDate, replace },
      {
        onSuccess: (n) => {
          toast.success(`Kopierte ${n} økt${n === 1 ? '' : 'er'} til ${shortDate(targetDate)}`);
          setOpen(false);
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : 'Kunne ikke kopiere dagen'),
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`gap-1.5 ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        <Copy className="h-3.5 w-3.5" /> Kopier dag
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Kopier dag til {shortDate(targetDate)}</SheetTitle>
          </SheetHeader>

          <div className="mt-3 space-y-4 pb-8">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">1. Velg uke</p>
              <div className="flex flex-wrap gap-1.5">
                {otherWeeks.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setFromWeekId(w.id);
                      setFromDate(null);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      fromWeekId === w.id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
                {otherWeeks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ingen andre uker å kopiere fra ennå.</p>
                )}
              </div>
            </div>

            {activeFromWeek && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">2. Velg dag</p>
                <div className="flex flex-wrap gap-1.5">
                  {sourceDates.map((d) => {
                    const n = countFor(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={n === 0}
                        onClick={() => setFromDate(d)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                          fromDate === d ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                        }`}
                      >
                        {shortDate(d)} <span className="font-normal">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {preview.length > 0 && (
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Disse øktene kopieres (uten ledere)
                </p>
                <ul className="space-y-1 text-sm">
                  {preview.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 p-3">
              <span>
                <span className="block text-sm font-semibold">Erstatt dagen</span>
                <span className="block text-xs text-muted-foreground">
                  Slett øktene som allerede ligger på {shortDate(targetDate)} først.
                </span>
              </span>
              <Switch checked={replace} onCheckedChange={setReplace} />
            </label>

            <Button className="w-full" disabled={!fromDate || copy.isPending} onClick={run}>
              {copy.isPending ? 'Kopierer …' : 'Kopier dagen'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
