import { useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ChefHat } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import {
  useLeirskoleKitchenDays,
  useSetLeirskoleKitchenDay,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

type StaffRow = {
  id: string;
  leader_id: string;
  leader?: { id?: string; name: string; profile_image_url?: string | null } | null;
};

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function dayLabel(d: string) {
  const x = parse(d);
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()}. ${MONTHS[x.getMonth()]}`;
}
function dayShort(d: string) {
  const x = parse(d);
  return { day: WEEKDAYS[x.getDay()], num: `${x.getDate()}.` };
}
function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const a = parse(start);
  const b = parse(end);
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

/**
 * Kjøkkenvakt: en leder kan settes på kjøkken hele dagen. Da tas de ut av
 * alle andre økter den dagen, og generatoren hopper over dem.
 */
export function LeirskoleKitchenCard({ week, staff }: { week: LeirskoleWeek; staff: StaffRow[] }) {
  const { showError } = useStatusPopup();
  const { data: kitchenDays } = useLeirskoleKitchenDays(week.id);
  const setKitchen = useSetLeirskoleKitchenDay();

  const days = useMemo(
    () => datesBetween(week.start_date, week.end_date),
    [week.start_date, week.end_date],
  );

  const isKitchen = (staffId: string, date: string) =>
    (kitchenDays ?? []).some((k) => k.staff_id === staffId && k.date === date);

  const toggle = async (staffId: string, date: string) => {
    const active = !isKitchen(staffId, date);
    try {
      await setKitchen.mutateAsync({ weekId: week.id, staffId, date, active });
      toast.success(active ? 'Satt på kjøkken hele dagen' : 'Kjøkkenvakt fjernet');
    } catch (error) {
      showError(
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Kunne ikke oppdatere kjøkkenvakten',
      );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ChefHat className="h-4 w-4 text-[hsl(var(--oks-ls-green))]" /> Kjøkken hele dagen
          {(kitchenDays ?? []).length > 0 && (
            <Badge variant="outline">{(kitchenDays ?? []).length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Kryss av i rutenettet: leder i rad, dag i kolonne. Grønn rute = kjøkken hele dagen, og
          lederen tas ut av alle andre økter den dagen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">Legg til ledere på uken først.</p>
        )}

        {staff.length > 0 && (
          <>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card pb-2 pr-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Leder
                    </th>
                    {days.map((d) => {
                      const s = dayShort(d);
                      return (
                        <th key={d} className="pb-2 text-center">
                          <span className="block text-[11px] font-semibold">{s.day}</span>
                          <span className="block text-[10px] text-muted-foreground">{s.num}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 max-w-[7.5rem] truncate bg-card py-1 pr-2 text-xs font-medium">
                        {s.leader?.name ?? 'Ukjent'}
                      </td>
                      {days.map((date) => {
                        const active = isKitchen(s.id, date);
                        return (
                          <td key={date} className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(s.id, date)}
                              disabled={setKitchen.isPending}
                              aria-label={`${s.leader?.name ?? 'Leder'} kjøkken ${dayLabel(date)}`}
                              aria-pressed={active}
                              className={`flex h-8 w-9 items-center justify-center rounded-xl border transition-colors ${
                                active
                                  ? 'border-[hsl(var(--oks-ls-green))] bg-[hsl(var(--oks-ls-green))]/25 text-[hsl(var(--oks-ls-green))]'
                                  : 'border-border/60 bg-muted/30 text-muted-foreground/40 hover:bg-muted/60'
                              }`}
                            >
                              {active ? (
                                <ChefHat className="h-4 w-4" />
                              ) : (
                                <Check className="h-3.5 w-3.5 opacity-40" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 rounded-2xl bg-muted/30 p-2.5">
              {days.map((date) => {
                const onKitchen = staff.filter((s) => isKitchen(s.id, date));
                return (
                  <div key={date} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-semibold">{dayLabel(date)}</span>
                    <span
                      className={
                        onKitchen.length
                          ? 'truncate font-medium text-[hsl(var(--oks-ls-green))]'
                          : 'text-muted-foreground'
                      }
                    >
                      {onKitchen.length
                        ? onKitchen.map((s) => s.leader?.name?.split(' ')[0] ?? 'Ukjent').join(', ')
                        : 'Ingen på kjøkken'}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
