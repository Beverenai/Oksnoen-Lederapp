import { useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChefHat } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { LeaderAvatarStack } from '@/components/leirskole/LeaderAvatarStack';
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
          Velg per dag hvem som står på kjøkkenet. De tas ut av alle andre økter den dagen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">Legg til ledere på uken først.</p>
        )}
        {days.map((date) => {
          const onKitchen = staff.filter((s) => isKitchen(s.id, date));
          return (
            <div key={date} className="overflow-hidden rounded-2xl border bg-card/40">
              <div className="flex items-center justify-between gap-2 bg-[hsl(var(--oks-ls-green))]/12 px-3 py-2">
                <p className="text-sm font-bold">{dayLabel(date)}</p>
                {onKitchen.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <LeaderAvatarStack
                      people={onKitchen.map((s) => ({
                        id: s.id,
                        name: s.leader?.name ?? 'Ukjent',
                        imageUrl: s.leader?.profile_image_url ?? null,
                      }))}
                      size="sm"
                    />
                    <span className="text-[11px] font-semibold text-[hsl(var(--oks-ls-green))]">
                      Kjøkken
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Ingen på kjøkken</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 p-2.5">
                {staff.map((s) => {
                  const active = isKitchen(s.id, date);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id, date)}
                      disabled={setKitchen.isPending}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-[hsl(var(--oks-ls-green))] bg-[hsl(var(--oks-ls-green))]/20 text-[hsl(var(--oks-ls-green))]'
                          : 'bg-card/60 text-muted-foreground'
                      }`}
                    >
                      {active && <ChefHat className="h-3 w-3" />}
                      {s.leader?.name?.split(' ')[0] ?? 'Ukjent'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
