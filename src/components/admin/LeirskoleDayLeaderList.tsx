import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChefHat, History } from 'lucide-react';
import {
  useLeirskoleActivities,
  useLeirskoleActivityHistory,
  useLeirskoleActivityTypes,
} from '@/hooks/useLeirskole';
import { hhmm } from '@/lib/leirskoleDates';

export interface DayLeaderPost {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  assignments: { staff_id: string }[];
}

interface StaffRow {
  id: string;
  leader?: { id: string; name: string; profile_image_url: string | null } | null;
}

/** Øktnavn -> økt-nøkkel i aktivitetslisten. */
const SESSION_BY_NAME: Record<string, string> = {
  'økt 1': 'formiddag',
  'økt 2': 'ettermiddag',
  'økt 3': 'kveld',
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const minutes = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Dagsoversikt per leder: bilde, navn og hva de skal gjøre i hver økt —
 * med merke for hvor mange ganger de har hatt aktiviteten før.
 */
export function LeirskoleDayLeaderList({
  weekId,
  date,
  posts,
  staff,
  kitchenIds,
  maxHours,
}: {
  weekId: string;
  date: string;
  posts: DayLeaderPost[];
  staff: StaffRow[];
  kitchenIds: Set<string>;
  maxHours: number;
}) {
  const { data: activities } = useLeirskoleActivities(weekId);
  const { data: history } = useLeirskoleActivityHistory();
  const { data: types } = useLeirskoleActivityTypes(true);

  const typeLabel = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string | null }>();
    (types ?? []).forEach((t) => map.set(t.key, { label: t.label, emoji: t.emoji }));
    return map;
  }, [types]);

  /** `${leaderId}|${session}` -> aktiviteter denne dagen. */
  const actByLeaderSession = useMemo(() => {
    const map = new Map<string, { activity: string; note: string | null }[]>();
    (activities ?? [])
      .filter((a) => a.date === date)
      .forEach((a) => {
        const key = `${a.leader_id}|${a.session}`;
        map.set(key, [...(map.get(key) ?? []), { activity: a.activity, note: a.note ?? null }]);
      });
    return map;
  }, [activities, date]);

  /** Hvor mange ganger lederen har hatt aktiviteten tidligere (før denne dagen). */
  const doneBefore = useMemo(() => {
    const map = new Map<string, number>();
    (history ?? []).forEach((h) => {
      if (h.date >= date) return;
      const key = `${h.leader_id}|${h.activity}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [history, date]);

  const sorted = useMemo(
    () =>
      staff
        .filter((s) => s.leader)
        .slice()
        .sort((a, b) => (a.leader!.name ?? '').localeCompare(b.leader!.name ?? '')),
    [staff],
  );

  const dayPosts = useMemo(
    () => posts.slice().sort((a, b) => minutes(a.start_time) - minutes(b.start_time)),
    [posts],
  );

  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const leaderId = s.leader!.id;
        const mine = dayPosts.filter((p) => p.assignments.some((a) => a.staff_id === s.id));
        const hours =
          mine.reduce((sum, p) => sum + Number(p.duration_hours ?? 0), 0) + (kitchenIds.has(s.id) ? 8 : 0);
        const over = hours > maxHours + 0.01;
        return (
          <div key={s.id} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={s.leader!.profile_image_url ?? undefined} alt={s.leader!.name} />
              <AvatarFallback className="text-xs">{initials(s.leader!.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="truncate text-sm font-bold">{s.leader!.name}</p>
                <span
                  className={`shrink-0 text-xs font-semibold tabular-nums ${
                    over ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {hours.toFixed(1)}/{maxHours}t
                </span>
              </div>

              {kitchenIds.has(s.id) && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-300">
                  <ChefHat className="h-3.5 w-3.5" /> Kjøkken hele dagen
                </p>
              )}

              {mine.length === 0 && !kitchenIds.has(s.id) && (
                <p className="mt-1 text-xs text-muted-foreground">Fri denne dagen.</p>
              )}

              <div className="mt-1.5 space-y-1.5">
                {mine.map((p) => {
                  const session = SESSION_BY_NAME[(p.name ?? '').trim().toLowerCase()];
                  const acts = session ? actByLeaderSession.get(`${leaderId}|${session}`) ?? [] : [];
                  return (
                    <div key={p.id} className="rounded-xl bg-muted/40 px-2.5 py-1.5">
                      <p className="text-xs font-semibold">
                        {p.name}
                        <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                          {hhmm(p.start_time)}–{hhmm(p.end_time)}
                        </span>
                      </p>
                      {acts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {session ? 'Ingen aktivitet satt' : 'Vakt uten aktivitet'}
                        </p>
                      ) : (
                        <ul className="mt-0.5 space-y-0.5">
                          {acts.map((a, i) => {
                            const t = typeLabel.get(a.activity);
                            const before = doneBefore.get(`${leaderId}|${a.activity}`) ?? 0;
                            return (
                              <li key={`${a.activity}-${i}`} className="flex items-center gap-1.5 text-[11px]">
                                <span>{t?.emoji ?? '•'}</span>
                                <span className="font-medium">{t?.label ?? a.activity}</span>
                                {a.note && <span className="truncate text-muted-foreground">· {a.note}</span>}
                                {before > 0 && (
                                  <span
                                    title={`Har hatt ${t?.label ?? a.activity} ${before} gang(er) før`}
                                    className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
                                  >
                                    <History className="h-3 w-3" /> {before}× før
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}