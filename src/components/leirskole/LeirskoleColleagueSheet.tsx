import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Moon, Sun } from 'lucide-react';
import { dayLabel, hhmm, todayStr } from '@/lib/leirskoleDates';

export type ColleagueShift = {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  is_night?: boolean | null;
  crosses_midnight?: boolean | null;
};

/** Enkelt ark som viser når en annen leder skal jobbe denne uken. */
export function LeirskoleColleagueSheet({
  open,
  onOpenChange,
  name,
  imageUrl,
  shifts,
  weekDates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  imageUrl?: string | null;
  shifts: ColleagueShift[];
  /** Alle datoer i uka, slik at fridager også vises. */
  weekDates?: string[];
}) {
  const today = todayStr();
  const total = shifts.reduce((sum, s) => sum + Number(s.duration_hours ?? 0), 0);
  const byDay = new Map<string, ColleagueShift[]>();
  shifts.forEach((s) => byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]));
  const dates = (weekDates?.length ? weekDates : [...byDay.keys()]).slice().sort((a, b) => a.localeCompare(b));
  const days = dates.map((date) => {
    const dayShifts = (byDay.get(date) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
    const hours = dayShifts.reduce((sum, s) => sum + Number(s.duration_hours ?? 0), 0);
    return { date, dayShifts, hours, works: dayShifts.length > 0 };
  });
  const workDays = days.filter((d) => d.works).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={imageUrl ?? undefined} alt={name} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate">{name}</span>
              <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                {total.toFixed(1)} t · {workDays} arbeidsdag{workDays === 1 ? '' : 'er'} denne uken
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-2.5 pb-6">
          {days.length === 0 && <p className="text-sm text-muted-foreground">Ingen vakter denne uken.</p>}
          {days.map(({ date, dayShifts, hours, works }) => {
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`rounded-2xl border p-3 ${
                  works
                    ? isToday
                      ? 'border-primary/70 bg-primary/15 ring-1 ring-primary/40'
                      : 'border-border/70 bg-muted/50'
                    : 'border-dashed border-border/50 bg-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`min-w-0 truncate text-sm font-bold ${
                      works ? '' : 'text-muted-foreground'
                    }`}
                  >
                    {dayLabel(date)}
                    {isToday && <span className="ml-1 text-primary">· i dag</span>}
                  </p>
                  {works ? (
                    <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary tabular-nums">
                      Jobb · {hours.toFixed(1)} t
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Sun className="h-3 w-3" /> Fri
                    </span>
                  )}
                </div>

                {works && (
                  <div className="mt-2 space-y-1.5">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl bg-background/70 px-3 py-2"
                      >
                        <p className="min-w-0 truncate text-sm font-medium">{s.name}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          {(s.is_night || s.crosses_midnight) && (
                            <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs font-bold tabular-nums">
                            {hhmm(s.start_time)}–{hhmm(s.end_time)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}