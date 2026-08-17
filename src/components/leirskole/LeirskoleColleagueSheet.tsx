import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Moon } from 'lucide-react';
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  imageUrl?: string | null;
  shifts: ColleagueShift[];
}) {
  const today = todayStr();
  const total = shifts.reduce((sum, s) => sum + Number(s.duration_hours ?? 0), 0);
  const byDay = new Map<string, ColleagueShift[]>();
  shifts.forEach((s) => byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]));
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

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
                {total.toFixed(1)} t denne uken
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-3 pb-6">
          {days.length === 0 && <p className="text-sm text-muted-foreground">Ingen vakter denne uken.</p>}
          {days.map(([date, dayShifts]) => (
            <div key={date}>
              <p
                className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                  date === today ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {dayLabel(date)}
                {date === today ? ' · i dag' : ''}
              </p>
              <div className="space-y-1.5">
                {dayShifts
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 ${
                        date === today ? 'bg-primary/12' : 'bg-muted/40'
                      }`}
                    >
                      <p className="min-w-0 truncate text-sm font-medium">{s.name}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {(s.is_night || s.crosses_midnight) && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-xs font-semibold tabular-nums">
                          {hhmm(s.start_time)}–{hhmm(s.end_time)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}