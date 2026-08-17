import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wand2, Sparkles, CalendarDays, Users } from 'lucide-react';
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';
import {
  LEIRSKOLE_ACTIVITIES, LEIRSKOLE_SESSIONS, rotateActivities, sessionLabel, shiftInSession,
} from '@/lib/leirskoleActivities';
import {
  useLeirskoleActivityAssignments,
  useLeirskoleActivityHistory,
  useSaveLeirskoleActivityPlan,
  useSetLeirskoleActivity,
  type LeirskolePost,
  type LeirskoleStaff,
} from '@/hooks/useLeirskole';

type StaffRow = LeirskoleStaff & {
  leader: { id: string; name: string; profile_image_url: string | null; leirskole_competencies: string[] | null } | null;
};

interface Props {
  weekId: string;
  startDate: string;
  endDate: string;
  staff: StaffRow[];
  posts: (LeirskolePost & { assignments: { id: string; staff_id: string }[] })[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const [ys, ms, ds] = start.split('-').map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const [ye, me, de] = end.split('-').map(Number);
  const last = new Date(ye, me - 1, de);
  while (cur <= last && out.length < 21) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function dayChip(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export function LeirskoleActivityCard({ weekId, startDate, endDate, staff, posts }: Props) {
  const days = useMemo(() => datesBetween(startDate, endDate), [startDate, endDate]);
  const today = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(days.includes(today) ? today : days[0]);
  const [session, setSession] = useState<string>('formiddag');

  const { data: assignments } = useLeirskoleActivityAssignments(weekId);
  const { data: history } = useLeirskoleActivityHistory();
  const savePlan = useSaveLeirskoleActivityPlan();
  const setOne = useSetLeirskoleActivity();

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  /** Ledere som jobber valgt dag + økt (fra vaktplanen). */
  const onDuty = useMemo(() => {
    const ids = new Set<string>();
    posts
      .filter((p) => p.date === date && shiftInSession(p.start_time, p.end_time, session))
      .forEach((p) => (p.assignments ?? []).forEach((a) => {
        const leaderId = staffById.get(a.staff_id)?.leader?.id;
        if (leaderId) ids.add(leaderId);
      }));
    return staff.filter((s) => s.leader && ids.has(s.leader.id));
  }, [posts, date, session, staff, staffById]);

  const rows = onDuty.length ? onDuty : staff;
  const usingFallback = onDuty.length === 0;

  const current = useMemo(() => {
    const map = new Map<string, { activity: string; auto: boolean }>();
    (assignments ?? [])
      .filter((a) => a.date === date && a.session === session)
      .forEach((a) => map.set(a.leader_id, { activity: a.activity, auto: a.auto_generated }));
    return map;
  }, [assignments, date, session]);

  const generate = () => {
    const leaders = rows
      .filter((s) => s.leader)
      .map((s) => ({ id: s.leader!.id, competencies: s.leader!.leirskole_competencies ?? [] }));
    if (!leaders.length) {
      toast.error('Ingen ledere å fordele på');
      return;
    }
    const locked = new Map<string, string>();
    current.forEach((v, leaderId) => {
      if (!v.auto) locked.set(leaderId, v.activity);
    });
    const plan = rotateActivities({ leaders, history: history ?? new Map(), locked });
    // ikke skriv over de manuelle igjen
    locked.forEach((_v, id) => plan.delete(id));
    savePlan.mutate(
      { weekId, date, session, plan },
      {
        onSuccess: (n) => toast.success(`Fordelte aktiviteter til ${n} ledere`),
        onError: (e: any) => toast.error(e.message ?? 'Kunne ikke fordele'),
      },
    );
  };

  return (
    <Card className="oks-glass-card border-primary/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Aktiviteter denne økten
        </CardTitle>
        <CardDescription>
          Fordeler tube, klatring, rappellering, kanotur, båtkjøring og badevakt etter kompetanse og hva de har hatt før.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger className="h-10 w-[170px] rounded-full">
              <CalendarDays className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={d}>{dayChip(d)}{d === today ? ' · i dag' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className="h-10 w-[150px] rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEIRSKOLE_SESSIONS.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generate} disabled={savePlan.isPending} className="h-10 gap-2 rounded-full">
            <Wand2 className="h-4 w-4" /> Fordel automatisk
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {usingFallback
            ? `Ingen vakter registrert på ${dayChip(date)} ${sessionLabel(session).toLowerCase()} — viser alle ${staff.length} ledere.`
            : `${onDuty.length} ledere jobber ${sessionLabel(session).toLowerCase()}.`}
        </p>

        <div className="space-y-2">
          {rows.map((s) => {
            const cur = current.get(s.leader?.id ?? '');
            const comps = s.leader?.leirskole_competencies ?? [];
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-3 py-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader?.name ?? ''} />
                  <AvatarFallback className="text-[11px]">{initials(s.leader?.name ?? '?')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.leader?.name ?? 'Ukjent'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {comps.length ? comps.map(competenceLabel).join(' · ') : 'Ingen kompetanse lagt inn'}
                  </p>
                </div>
                {cur && !cur.auto && <Badge variant="secondary" className="shrink-0 text-[10px]">Manuell</Badge>}
                <Select
                  value={cur?.activity ?? 'none'}
                  onValueChange={(v) =>
                    setOne.mutate(
                      {
                        weekId,
                        leaderId: s.leader!.id,
                        date,
                        session,
                        activity: v === 'none' ? null : v,
                      },
                      { onError: (e: any) => toast.error(e.message ?? 'Kunne ikke lagre') },
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-full text-xs">
                    <SelectValue placeholder="Ingen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {LEIRSKOLE_ACTIVITIES.map((a) => (
                      <SelectItem key={a.key} value={a.key}>
                        {competenceEmoji(a.key)} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
