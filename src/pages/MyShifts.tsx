import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ClipboardList, RefreshCw, CalendarX, ZoomIn, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type ShiftSchedule = Tables<'shift_schedules'>;
type ShiftAssignment = Tables<'shift_assignments'>;
type ShiftType = Tables<'shift_types'>;

const PROFILE_TO_TEAM: Record<string, string> = {
  '1': 'team1', '2': 'team2', '1f': 'team1f', '2f': 'team2f',
};

const DAY_TYPE_LABEL: Record<string, string> = {
  arrival: 'Ankomstdag',
  departure: 'Avreisedag',
  normal: '',
};

const TEAM_LABEL: Record<string, string> = {
  team1: 'Team 1', team2: 'Team 2', team1f: 'Team 1F', team2f: 'Team 2F',
};

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

function dateForDay(startDate: string | null | undefined, dayIndex: number): { weekday: string; dateStr: string } | null {
  if (!startDate) return null;
  // Parse YYYY-MM-DD as local date to avoid TZ shift
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dayIndex);
  return {
    weekday: WEEKDAYS[date.getDay()],
    dateStr: `${date.getDate()}. ${MONTHS[date.getMonth()]}`,
  };
}

export default function MyShifts() {
  const navigate = useNavigate();
  const { effectiveLeader, isAdmin } = useAuth();
  const leaderId = effectiveLeader?.id;
  const [zoomOpen, setZoomOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: scheduleImageUrl } = useQuery({
    queryKey: ['schedule-image-url'],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'schedule_image_url')
        .maybeSingle();
      return (data?.value as string | undefined) ?? null;
    },
  });

  // Realtime: refresh vaktplan-bilde når admin endrer det
  useEffect(() => {
    const channel = supabase
      .channel('schedule-image-url-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.schedule_image_url' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['schedule-image-url'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomOpen]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['my-shifts', leaderId],
    enabled: !!leaderId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      // Get latest schedule. Leaders see only published; admins also see latest draft.
      let scheduleQuery = supabase
        .from('shift_schedules')
        .select('*')
        .order('year', { ascending: false })
        .order('period_number', { ascending: false });
      if (!isAdmin) scheduleQuery = scheduleQuery.eq('status', 'published');
      const { data: schedules, error: schErr } = await scheduleQuery.limit(1);
      if (schErr) throw schErr;
      const schedule = (schedules || [])[0] as ShiftSchedule | undefined;
      if (!schedule) return { schedule: null, assignments: [], shiftTypes: [], myTeam: null };

      const [{ data: assignments, error: aErr }, { data: shiftTypes, error: tErr }, { data: leaderTeam }] = await Promise.all([
        supabase.from('shift_assignments').select('*').eq('schedule_id', schedule.id),
        supabase.from('shift_types').select('*'),
        supabase.from('leader_teams').select('team').eq('leader_id', leaderId!).eq('period_number', schedule.period_number).eq('year', schedule.year).maybeSingle(),
      ]);
      if (aErr) throw aErr;
      if (tErr) throw tErr;

      const teamFromRotation = leaderTeam?.team ? PROFILE_TO_TEAM[leaderTeam.team] : null;
      const teamFromProfile = effectiveLeader?.team ? PROFILE_TO_TEAM[effectiveLeader.team.trim()] : null;
      const myTeam = teamFromRotation ?? teamFromProfile;

      return {
        schedule,
        assignments: (assignments || []) as ShiftAssignment[],
        shiftTypes: (shiftTypes || []) as ShiftType[],
        myTeam,
      };
    },
  });

  const grouped = useMemo(() => {
    if (!data?.schedule) return [];
    const { schedule, assignments, shiftTypes, myTeam } = data;
    const typeById = new Map(shiftTypes.map((t) => [t.id, t]));

    const myAssignments = assignments.filter((a) => {
      if (a.assignment_type === 'leader') return a.leader_id === leaderId;
      if (a.assignment_type === 'team') {
        const excluded = Array.isArray(a.excluded_leader_ids) ? a.excluded_leader_ids : [];
        return !!myTeam && a.team_name === myTeam && !excluded.includes(leaderId!);
      }
      return false;
    });

    const days: { dayIndex: number; dayType: string; rows: { st: ShiftType; note: string | null }[] }[] = [];
    for (let d = 0; d < schedule.period_length; d++) {
      const dayItems = myAssignments
        .filter((a) => a.day_index === d)
        .map((a) => ({ st: typeById.get(a.shift_type_id)!, note: a.note }))
        .filter((r) => r.st)
        .sort((a, b) => (a.st.start_time || '').localeCompare(b.st.start_time || ''));
      const dayType = d === 0 ? 'arrival' : d === schedule.period_length - 1 ? 'departure' : 'normal';
      days.push({ dayIndex: d, dayType, rows: dayItems });
    }
    return days;
  }, [data, leaderId]);

  const startDate = (data?.schedule as any)?.start_date as string | null | undefined;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-heading font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Min vakt
            </h1>
            {data?.schedule && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                Periode {data.schedule.period_number} · {data.schedule.year}
                {data.myTeam && ` · ${TEAM_LABEL[data.myTeam] ?? data.myTeam}`}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {scheduleImageUrl && (
        <Card
          className="overflow-hidden cursor-zoom-in"
          onClick={() => setZoomOpen(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <ZoomIn className="w-4 h-4" />
              Vaktplan oversikt
            </CardTitle>
            <CardDescription>Trykk på bildet for å zoome</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <img
              src={scheduleImageUrl}
              alt="Vaktplan"
              className="w-full h-auto rounded-md border"
              loading="lazy"
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !data?.schedule ? null : grouped.every((d) => d.rows.length === 0) ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <CalendarX className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="font-heading font-semibold">Du har ingen vakter i denne perioden</h2>
            <p className="text-sm text-muted-foreground">
              Hvis dette er feil, ta kontakt med admin — du er kanskje lagt til etter at planen ble laget.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.map((day) => (
            (() => {
              const dateInfo = dateForDay(startDate, day.dayIndex);
              const hasKjokken = day.rows.some((r) => r.st.slug === 'kjokkenvakt');
              const visibleRows = hasKjokken
                ? day.rows.filter((r) => r.st.slug === 'kjokkenvakt')
                : day.rows;
              return (
                <Card key={day.dayIndex} className={day.rows.length === 0 ? 'opacity-70' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg sm:text-xl font-heading">
                          {dateInfo ? dateInfo.weekday : `Dag ${day.dayIndex + 1}`}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dateInfo ? `${dateInfo.dateStr} · Dag ${day.dayIndex + 1}` : `Dag ${day.dayIndex + 1}`}
                          {DAY_TYPE_LABEL[day.dayType] && ` · ${DAY_TYPE_LABEL[day.dayType]}`}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {visibleRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Fri</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {visibleRows.map((r, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-3 py-1">
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{r.st.name}</div>
                              {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {r.st.slug === 'kjokkenvakt'
                                ? 'Hele dagen'
                                : `${r.st.start_time?.slice(0, 5)}–${r.st.end_time?.slice(0, 5)}`}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ))}
          {data.schedule.status !== 'published' && (
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Denne planen er ikke publisert ennå (status: {data.schedule.status}).
            </p>
          )}
        </>
      )}

      {zoomOpen && scheduleImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setZoomOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={scheduleImageUrl}
            alt="Vaktplan"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
