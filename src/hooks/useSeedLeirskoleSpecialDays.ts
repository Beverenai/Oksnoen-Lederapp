import { useEffect, useMemo, useRef } from 'react';
import {
  useLeirskoleWeekDays,
  useLeirskoleWeeks,
  useSetLeirskoleDayType,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 21) {
    out.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Sørger for at første og siste dag i en leirskoleuke er markert som ankomst/avreise.
 * Hvis en annen uke slutter samme dag som denne starter (eller starter samme dag som denne slutter),
 * markeres dagen som «avreise + ankomst» — en skole drar og en ny kommer samme dag.
 * Kalles fra både ukeplanen og ukeoversikten, slik at markeringen finnes uansett hvor admin starter.
 */
export function useSeedLeirskoleSpecialDays(week: LeirskoleWeek, enabled = true) {
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const { data: allWeeks } = useLeirskoleWeeks();
  const setDayType = useSetLeirskoleDayType();
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const others = useMemo(() => (allWeeks ?? []).filter((w) => w.id !== week.id), [allWeeks, week.id]);
  /** En annen uke slutter samme dag som denne starter → avreise + ankomst. */
  const isFollowUpWeek = useMemo(
    () => others.some((w) => w.end_date === week.start_date) || others.some((w) => w.start_date < week.start_date),
    [others, week.start_date],
  );
  /** En annen uke starter samme dag som denne slutter → avreise + ankomst også på siste dag. */
  const lastDayIsBoth = useMemo(
    () => others.some((w) => w.start_date === week.end_date),
    [others, week.end_date],
  );
  const firstDayType: 'arrival' | 'both' = isFollowUpWeek ? 'both' : 'arrival';
  const lastDayType: 'departure' | 'both' = lastDayIsBoth ? 'both' : 'departure';
  const seeded = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !weekDays || !allWeeks || dates.length < 2) return;
    const stamp = `${week.id}:${first}:${last}:${firstDayType}:${lastDayType}`;
    if (seeded.current === stamp) return;
    seeded.current = stamp;
    const typeOf = (date: string) => weekDays.find((d) => d.date === date)?.day_type ?? 'normal';
    if (typeOf(first) !== firstDayType) setDayType.mutate({ weekId: week.id, date: first, dayType: firstDayType });
    if (typeOf(last) !== lastDayType) setDayType.mutate({ weekId: week.id, date: last, dayType: lastDayType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, weekDays, allWeeks, first, last, week.id, firstDayType, lastDayType]);

  return { firstDayType, lastDayType, isFollowUpWeek };
}