import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Plus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
const HOUR_CHOICES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];

/** 1.5 -> "1,5" */
function fmtHours(h: number) {
  return Number(h).toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

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

  const hoursFor = (staffId: string, date: string) =>
    Number(
      (kitchenDays ?? []).find((k) => k.staff_id === staffId && k.date === date)?.hours ?? 8,
    );

  const toggle = async (staffId: string, date: string, hours?: number) => {
    const active = hours !== undefined ? true : !isKitchen(staffId, date);
    try {
      await setKitchen.mutateAsync({ weekId: week.id, staffId, date, active, hours });
      toast.success(
        !active
          ? 'Kjøkkenvakt fjernet'
          : (hours ?? 8) >= 8
            ? 'Satt på kjøkken hele dagen'
            : `Satt på kjøkken i ${fmtHours(hours ?? 0)}t`,
      );
    } catch (error) {
      showError(
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Kunne ikke oppdatere kjøkkenvakten',
      );
    }
  };

  const today = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(days.includes(today) ? today : days[0]);

  const countFor = (d: string) => staff.filter((s) => isKitchen(s.id, d)).length;
  const onKitchen = staff.filter((s) => isKitchen(s.id, date));
  const free = staff.filter((s) => !isKitchen(s.id, date));

  const row = (s: StaffRow, active: boolean) => {
    const hours = active ? hoursFor(s.id, date) : 0;
    return (
      <div
        key={s.id}
        className={`space-y-1.5 rounded-2xl border px-3 py-2 transition-colors ${
          active
            ? 'border-[hsl(var(--oks-ls-green))] bg-[hsl(var(--oks-ls-green))]/12'
            : 'border-border/60 bg-muted/25'
        }`}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt="" />
            <AvatarFallback className="text-[10px]">
              {(s.leader?.name ?? '?')
                .split(' ')
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join('')}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {s.leader?.name ?? 'Ukjent'}
            {active && (
              <span className="ml-1.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--oks-ls-green))]">
                {hours}t
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => toggle(s.id, date, active ? undefined : 8)}
            disabled={setKitchen.isPending}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
              active
                ? 'bg-[hsl(var(--oks-ls-green))]/20 text-[hsl(var(--oks-ls-green))]'
                : 'bg-background text-muted-foreground'
            }`}
          >
            {active ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {active ? 'Ta av' : 'Hele dagen'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {HOUR_CHOICES.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => toggle(s.id, date, h)}
              disabled={setKitchen.isPending}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                active && hours === h
                  ? 'border-[hsl(var(--oks-ls-green))] bg-[hsl(var(--oks-ls-green))]/20 text-[hsl(var(--oks-ls-green))]'
                  : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {h}t
            </button>
          ))}
        </div>
      </div>
    );
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
          Velg dag øverst, så setter du ledere på kjøkken. Hele dagen (8t) tar dem ut av alle andre
          økter – færre timer betyr at de bare hjelper til og beholder resten av vaktene.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">Legg til ledere på uken først.</p>
        )}

        {staff.length > 0 && (
          <>
            {/* Dagvelger med antall på kjøkken */}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {days.map((d) => {
                const n = countFor(d);
                const selected = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2 ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 bg-muted/30'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{dayLabel(d)}</span>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-medium ${
                        selected
                          ? 'text-primary-foreground/85'
                          : n
                            ? 'text-[hsl(var(--oks-ls-green))]'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <ChefHat className="h-3 w-3" /> {n}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Valgt dag */}
            <div className="space-y-2 rounded-2xl border bg-card/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                På kjøkken {dayLabel(date)}
              </p>
              {onKitchen.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen satt på kjøkken denne dagen.</p>
              ) : (
                <div className="space-y-1.5">{onKitchen.map((s) => row(s, true))}</div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tilgjengelige ledere
              </p>
              <div className="space-y-1.5">{free.map((s) => row(s, false))}</div>
            </div>

            {/* Ukesoppsummering */}
            <div className="space-y-1 rounded-2xl bg-muted/30 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Uken
              </p>
              {days.map((d) => {
                const names = staff.filter((s) => isKitchen(s.id, d));
                return (
                  <div key={d} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-semibold">{dayLabel(d)}</span>
                    <span
                      className={
                        names.length
                          ? 'truncate font-medium text-[hsl(var(--oks-ls-green))]'
                          : 'text-muted-foreground'
                      }
                    >
                      {names.length
                        ? names
                            .map(
                              (s) =>
                                `${s.leader?.name?.split(' ')[0] ?? 'Ukjent'} ${hoursFor(s.id, d)}t`,
                            )
                            .join(', ')
                        : '—'}
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
