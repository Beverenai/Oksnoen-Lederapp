import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Search } from 'lucide-react';
import type { LeirskoleIssue } from '@/lib/leirskoleValidate';

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

export interface LeaderWeekShift {
  name: string;
  hours: number;
  assignmentId?: string;
  postId?: string;
  kitchen?: boolean;
}

/** Full oversikt: én rad per leder, én kolonne per dag. */
export function LeirskoleLeaderWeekTable({
  dates,
  staff,
  shifts,
  kitchenSet,
  maxHours,
  issuesByLeader,
  onEditCell,
}: {
  dates: string[];
  staff: { staffId: string; leaderId: string; name: string }[];
  /** `${date}|${staffId}` -> vaktene lederen har den dagen. */
  shifts: Map<string, LeaderWeekShift[]>;
  /** `${date}|${staffId}` for kjøkkenvakt hele dagen. */
  kitchenSet: Set<string>;
  maxHours: number;
  issuesByLeader: Map<string, LeirskoleIssue[]>;
  /** Åpner redigering av én leders dag. */
  onEditCell?: (date: string, staffId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [day, setDay] = useState<string>('alle');

  const shownDates = day === 'alle' ? dates : dates.filter((d) => d === day);
  const rows = useMemo(
    () => staff.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())),
    [staff, q],
  );

  const shortName = (n: string) => n.replace(/vakt$/i, '').trim();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk etter leder"
            className="rounded-full pl-9"
          />
        </div>
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="alle">Alle dager</option>
          {dates.map((d) => {
            const dt = new Date(`${d}T12:00:00`);
            return (
              <option key={d} value={d}>
                {WEEKDAYS[dt.getDay()]} {dt.getDate()}.
              </option>
            );
          })}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-semibold">Leder</th>
              {shownDates.map((d) => {
                const dt = new Date(`${d}T12:00:00`);
                return (
                  <th key={d} className="px-2 py-2 text-left font-semibold">
                    {WEEKDAYS[dt.getDay()]} {dt.getDate()}.
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-semibold">Sum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const perDay = shownDates.map((date) => ({
                date,
                list: shifts.get(`${date}|${s.staffId}`) ?? [],
                kitchen: kitchenSet.has(`${date}|${s.staffId}`),
              }));
              const total = perDay.reduce(
                (sum, d) => sum + d.list.reduce((a, b) => a + b.hours, 0),
                0,
              );
              const leaderIssues = issuesByLeader.get(s.leaderId) ?? [];
              const freeDays = perDay.filter((d) => d.list.length === 0 && !d.kitchen).length;
              return (
                <tr key={s.staffId} className="border-t border-border/40 align-top">
                  <td className="sticky left-0 z-10 max-w-[11rem] bg-card px-3 py-2">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {freeDays} dag{freeDays === 1 ? '' : 'er'} uten vakt
                    </p>
                    {leaderIssues.length > 0 && (
                      <p
                        title={leaderIssues.map((i) => i.message).join('\n')}
                        className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-destructive"
                      >
                        <AlertTriangle className="h-3 w-3" /> {leaderIssues.length} varsel
                      </p>
                    )}
                  </td>
                  {perDay.map((d) => {
                    const hours = d.list.reduce((a, b) => a + b.hours, 0);
                    const over = hours > maxHours + 0.01;
                    return (
                      <td key={d.date} className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onEditCell?.(d.date, s.staffId)}
                          className={`w-full rounded-xl border px-2 py-1.5 text-left transition hover:brightness-95 ${
                            over
                              ? 'border-destructive/50 bg-destructive/10'
                              : hours === 0
                                ? 'border-dashed border-border/60 bg-muted/20'
                                : 'border-border/60 bg-muted/30'
                          }`}
                        >
                          <p
                            className={`text-xs font-bold tabular-nums ${
                              over ? 'text-destructive' : hours === 0 ? 'text-muted-foreground/60' : ''
                            }`}
                          >
                            {hours.toFixed(1)}t
                            {d.kitchen && <span className="ml-1 text-sky-500">Kjøkken</span>}
                          </p>
                          {d.list.length === 0 && !d.kitchen ? (
                            <p className="text-xs text-muted-foreground/60">fri</p>
                          ) : (
                            <p className="text-xs leading-snug text-muted-foreground">
                              {d.list.map((x) => shortName(x.name)).join(' · ')}
                            </p>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{total.toFixed(1)}t</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={shownDates.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                  Ingen ledere matcher søket.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
