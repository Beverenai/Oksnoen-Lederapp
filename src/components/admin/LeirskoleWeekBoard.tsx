import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertTriangle,
  LayoutGrid,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Moon,
  NotebookPen,
  Sparkles,
  Undo2,
  Users,
  Wand2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLeirskoleActivities,
  useLeirskoleActivityTypes,
  useLeirskoleSchedule,
  useLeirskoleWeekDays,
  useLeirskoleWeekPlan,
  useLeirskoleKitchenDays,
  useSetLeirskoleKitchenDay,
  useSetLeirskoleDayLock,
  useSetLeirskoleDayLog,
  type LeirskoleStaff,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';
import {
  runLeirskoleGenerate,
  previewLeirskoleGenerate,
  type LeirskoleGenerateMode,
  type LeirskoleGenerateSummary,
  type LeirskolePreview,
} from '@/lib/leirskoleGenerateAll';
import {
  takeLeirskoleSnapshot,
  restoreLeirskoleSnapshot,
  type LeirskoleSnapshot,
} from '@/lib/leirskoleSnapshot';
import { validateLeirskoleWeek, type LeirskoleIssue } from '@/lib/leirskoleValidate';
import { LeirskoleBoardIssues } from '@/components/admin/LeirskoleBoardIssues';
import { LeirskoleLeaderWeekTable } from '@/components/admin/LeirskoleLeaderWeekTable';
import { LeirskoleGeneratePreviewDialog } from '@/components/admin/LeirskoleGeneratePreviewDialog';
import { LeirskoleCellSheet, type CellTarget } from '@/components/admin/LeirskoleCellSheet';
import { LeirskoleSpecialDayTimeline } from '@/components/admin/LeirskoleSpecialDayTimeline';
import { LeirskolePostStaffPicker } from '@/components/admin/LeirskolePostStaffPicker';
import { trimDayHours, fillDayHours, KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';
import { assignMissingActivities } from '@/lib/leirskoleAutoActivity';
import { cellInstances } from '@/lib/leirskoleCellInstances';
import { useSeedLeirskoleSpecialDays } from '@/hooks/useSeedLeirskoleSpecialDays';

const MEAL_TIMES: Record<string, { start: string; end: string; hours: number }> = {
  Frokost: { start: '09:00', end: '10:00', hours: 1 },
  Middag: { start: '14:00', end: '15:00', hours: 1 },
  Kvelds: { start: '19:00', end: '20:00', hours: 1 },
  Sanitas: { start: '22:30', end: '23:00', hours: 0.5 },
};
const TEMPLATE_NAMES = new Set(['Frokost', 'Middag', 'Kvelds', 'Nattevakt', 'Sanitas', 'Økt 1', 'Økt 2', 'Økt 3']);
/** Navn som har egne rader (måltid/natt) og derfor ikke vises i tidslinjen. */
const ROW_NAMES = new Set(['Frokost', 'Middag', 'Kvelds', 'Nattevakt', 'Sanitas']);
/** Kveld/natt har egne rader nederst og skal aldri inn i dagtidslinjen. */
const NIGHT_ROW_NAMES = new Set(['Nattevakt', 'Sanitas']);

type StaffRow = LeirskoleStaff & {
  leader: {
    id: string;
    name: string;
    profile_image_url?: string | null;
    leirskole_competencies: string[] | null;
  } | null;
};

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const SESSIONS = [
  { row: 1, label: 'Økt 1', session: 'formiddag', time: '11–14' },
  { row: 2, label: 'Økt 2', session: 'ettermiddag', time: '16–19' },
  { row: 3, label: 'Økt 3', session: 'kveld', time: '20–21.30' },
];

/** Radene i dagbordet i kronologisk rekkefølge — måltidene ligger mellom øktene. */
const BOARD_ROWS: (
  | { kind: 'session'; sessionIdx: number; label: string; time: string }
  | { kind: 'meal'; meal: string; label: string; time: string }
)[] = [
  { kind: 'meal', meal: 'Frokost', label: 'Frokost', time: '09–10' },
  { kind: 'session', sessionIdx: 0, label: SESSIONS[0].label, time: SESSIONS[0].time },
  { kind: 'meal', meal: 'Middag', label: 'Middag', time: '14–15' },
  { kind: 'session', sessionIdx: 1, label: SESSIONS[1].label, time: SESSIONS[1].time },
  { kind: 'meal', meal: 'Kvelds', label: 'Kvelds', time: '19–20' },
  { kind: 'session', sessionIdx: 2, label: SESSIONS[2].label, time: SESSIONS[2].time },
];

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

const firstName = (name: string) => name.split(' ')[0];

/** Hele uken i ett bord: økter, aktiviteter, ledere, måltider, kjøkken, natt og timer. */
export function LeirskoleWeekBoard({ week, staff }: { week: LeirskoleWeek; staff: StaffRow[] }) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const { data: activities } = useLeirskoleActivities(week.id);
  const { data: types } = useLeirskoleActivityTypes(true);
  const { data: kitchenDays } = useLeirskoleKitchenDays(week.id);
  const setKitchenDay = useSetLeirskoleKitchenDay();
  const setDayLock = useSetLeirskoleDayLock();
  const setDayLog = useSetLeirskoleDayLog();
  const [target, setTarget] = useState<CellTarget | null>(null);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [logText, setLogText] = useState('');
  const [summary, setSummary] = useState<LeirskoleGenerateSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<'bord' | 'ledere'>('bord');
  const [big, setBig] = useState(() => localStorage.getItem('leirskole-board-big') === '1');
  const [pendingMode, setPendingMode] = useState<LeirskoleGenerateMode | null>(null);
  const [preview, setPreview] = useState<LeirskolePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<LeirskoleSnapshot | null>(null);
  /** Redigering av én leders dag fra lederoversikten. */
  const [editCell, setEditCell] = useState<{ date: string; staffId: string } | null>(null);

  const toggleBig = () => {
    setBig((v) => {
      localStorage.setItem('leirskole-board-big', v ? '0' : '1');
      return !v;
    });
  };

  /** Størrelser for kompakt vs. stor visning. */
  const ui = big
    ? { pad: 'p-3', txt: 'text-sm', sub: 'text-xs', chip: 'px-2 py-1 text-xs', gap: 'gap-2' }
    : { pad: 'p-2', txt: 'text-[11px]', sub: 'text-[10px]', chip: 'px-1.5 py-0.5 text-[10px]', gap: 'gap-1.5' };

  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  useSeedLeirskoleSpecialDays(week);

  const specialDays = useMemo(() => {
    const map = new Map<string, string>();
    (weekDays ?? []).forEach((d) => {
      if (d.day_type !== 'normal') map.set(d.date, d.day_type);
    });
    return map;
  }, [weekDays]);

  const lockedDays = useMemo(
    () => new Set((weekDays ?? []).filter((d) => d.is_locked).map((d) => d.date)),
    [weekDays],
  );
  const dayLogs = useMemo(() => {
    const map = new Map<string, string>();
    (weekDays ?? []).forEach((d) => {
      if (d.log_note) map.set(d.date, d.log_note);
    });
    return map;
  }, [weekDays]);

  const openLog = (date: string) => {
    setLogText(dayLogs.get(date) ?? '');
    setLogDate(date);
  };

  const staffToLeader = useMemo(() => {
    const map = new Map<string, { id: string; name: string; competencies: string[] }>();
    staff.forEach((s) => {
      if (s.leader) {
        map.set(s.id, {
          id: s.leader.id,
          name: s.leader.name,
          competencies: s.leader.leirskole_competencies ?? [],
        });
      }
    });
    return map;
  }, [staff]);

  /** `${date}|${rowIndex}` og `post|${postId}` -> innhold i ukeplanen. */
  const planContent = useMemo(() => {
    const map = new Map<string, string>();
    (cells ?? []).forEach((c) => {
      const key = c.post_id ? `post|${c.post_id}` : c.row_index != null ? `${c.date}|${c.row_index}` : null;
      if (key) map.set(key, c.content ?? '');
    });
    return map;
  }, [cells]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, typeof posts>();
    (posts ?? []).forEach((p) => {
      map.set(p.date, [...(map.get(p.date) ?? []), p]);
    });
    return map;
  }, [posts]);

  /** `${date}|${session}` -> ledere på vakt. Session = formiddag/ettermiddag/kveld, eller postId for egne økter. */
  const dutyBySlot = useMemo(() => {
    const map = new Map<string, { id: string; name: string; competencies: string[] }[]>();
    (posts ?? []).forEach((p) => {
      const session = p.is_custom
        ? p.id
        : SESSIONS.find((s) => s.label.toLowerCase() === (p.name ?? '').trim().toLowerCase())?.session;
      if (!session) return;
      const list = map.get(`${p.date}|${session}`) ?? [];
      p.assignments.forEach((a) => {
        const l = staffToLeader.get(a.staff_id);
        if (l && !list.some((x) => x.id === l.id)) list.push(l);
      });
      map.set(`${p.date}|${session}`, list);
    });
    return map;
  }, [posts, staffToLeader]);

  const activityBySlot = useMemo(() => {
    const map = new Map<string, { leader_id: string; activity: string }[]>();
    (activities ?? []).forEach((a) => {
      const key = `${a.date}|${a.session}`;
      map.set(key, [...(map.get(key) ?? []), { leader_id: a.leader_id, activity: a.activity }]);
    });
    return map;
  }, [activities]);

  const leaderName = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => s.leader && map.set(s.leader.id, s.leader.name));
    return map;
  }, [staff]);

  const staffOptions = useMemo(
    () => staff.filter((s) => s.leader).map((s) => ({ staffId: s.id, name: s.leader!.name })),
    [staff],
  );

  const maxHours = Number(week.max_daily_hours ?? 8);

  /** `${date}|${staffId}` for de som står på kjøkken hele dagen. */
  const kitchenSet = useMemo(
    () => new Set((kitchenDays ?? []).map((k) => `${k.date}|${k.staff_id}`)),
    [kitchenDays],
  );

  /** Timer per leirskole_staff-id per dag — kjøkkenvakt teller som en full dag. */
  const staffHoursByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    (posts ?? []).forEach((p) => {
      const day = map.get(p.date) ?? new Map<string, number>();
      p.assignments.forEach((a) => {
        day.set(a.staff_id, (day.get(a.staff_id) ?? 0) + Number(p.duration_hours ?? 0));
      });
      map.set(p.date, day);
    });
    (kitchenDays ?? []).forEach((k) => {
      const day = map.get(k.date) ?? new Map<string, number>();
      day.set(k.staff_id, (day.get(k.staff_id) ?? 0) + KITCHEN_DAY_HOURS);
      map.set(k.date, day);
    });
    return map;
  }, [posts, kitchenDays]);

  /** Timer per leder per dag, for å se om noen er langt fra 8t. */
  const hoursByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    (posts ?? []).forEach((p) => {
      const day = map.get(p.date) ?? new Map<string, number>();
      p.assignments.forEach((a) => {
        const l = staffToLeader.get(a.staff_id);
        if (!l) return;
        day.set(l.id, (day.get(l.id) ?? 0) + Number(p.duration_hours ?? 0));
      });
      map.set(p.date, day);
    });
    (kitchenDays ?? []).forEach((k) => {
      const l = staffToLeader.get(k.staff_id);
      if (!l) return;
      const day = map.get(k.date) ?? new Map<string, number>();
      day.set(l.id, (day.get(l.id) ?? 0) + KITCHEN_DAY_HOURS);
      map.set(k.date, day);
    });
    return map;
  }, [posts, staffToLeader, kitchenDays]);

  const generate = useMutation({
    mutationFn: async (mode: LeirskoleGenerateMode) => {
      // Uken må ha ledere før generatoren kan kjøre. Er den tom, kopierer vi
      // staben fra nærmeste tidligere uke som har ledere.
      if (staff.length === 0) {
        const { data: prevWeeks } = await supabase
          .from('leirskole_weeks')
          .select('id')
          .lt('start_date', week.start_date)
          .order('start_date', { ascending: false });
        let unique: Array<{ leader_id: string; max_daily_hours: number | null }> = [];
        for (const w of prevWeeks ?? []) {
          const { data: rows } = await supabase
            .from('leirskole_staff')
            .select('leader_id, max_daily_hours')
            .eq('week_id', w.id);
          if (rows && rows.length) {
            unique = rows;
            break;
          }
        }
        if (unique.length === 0) {
          throw new Error('Det er ikke nok ledere til å bemanne denne uken. Legg til flere ledere under «Tilgang» først.');
        }
        const { error: copyError } = await supabase.from('leirskole_staff').insert(
          unique.map((r) => ({
            week_id: week.id,
            leader_id: r.leader_id,
            max_daily_hours: r.max_daily_hours ?? 8,
          })),
        );
        if (copyError) throw copyError;
        qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
        toast.info(`Kopierte ${unique.length} ledere fra forrige uke`);
      }
      // Sikkerhetsnett: ta et bilde av uken slik den er nå, så alt kan angres.
      const snap = await takeLeirskoleSnapshot(week.id);
      setSnapshot(snap);
      return runLeirskoleGenerate({
        weekId: week.id,
        startDate: week.start_date,
        endDate: week.end_date,
        mode,
        createdBy: leader?.id ?? null,
        // «Tilfeldig ukeplan» skal faktisk lage en ny plan, ikke bare fylle
        // tomme ruter (ellers ser det ut som ingenting skjer).
        overwritePlan: mode === 'plan',
      });
    },
    onSuccess: (result) => {
      setSummary(result);
      setPendingMode(null);
      setPreview(null);
      ['leirskole-week-plan', 'leirskole-schedule', 'leirskole-activities', 'leirskole-activity-history', 'leirskole-my-shifts'].forEach(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      );
      const parts = [
        result.cellsFilled ? `${result.cellsFilled} ruter` : null,
        result.shifts ? `${result.shifts} vakter` : null,
        result.activityAssignments ? `${result.activityAssignments} aktiviteter` : null,
      ].filter(Boolean);
      if (parts.length) toast.success(`Generert: ${parts.join(' · ')}`);
      else toast.info('Ingenting ble endret — alt var allerede fylt ut');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke generere uken'),
  });

  /** Rydd en dag: fjern automatiske vakter til ingen ligger over dagstaket. */
  const createPost = useMutation({
    mutationFn: async ({ date, name }: { date: string; name: string }) => {
      const t = MEAL_TIMES[name] ?? { start: '22:30', end: '01:30', hours: 3 };
      const night = name === 'Nattevakt';
      const sanitas = name === 'Sanitas';
      const { error } = await supabase.from('leirskole_posts').insert({
        week_id: week.id,
        date,
        name,
        start_time: t.start,
        end_time: t.end,
        duration_hours: t.hours,
        is_night: night,
        crosses_midnight: night,
        is_custom: true,
        is_published: true,
        post_type: night ? 'night' : sanitas ? 'other' : 'meal',
        required_leaders: night ? 1 : sanitas ? 4 : 2,
        sort_order: night ? 90 : sanitas ? 70 : 50,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leirskole-schedule'] });
      toast.success('Økt lagt til');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke legge til økten'),
  });

  const fixDay = useMutation({
    mutationFn: async (date: string) => {
      const day = staffHoursByDate.get(date) ?? new Map<string, number>();
      const over = [...day.entries()].filter(([, v]) => v > maxHours + 0.01);
      let count = 0;
      for (const [staffId] of over) {
        const removed = await trimDayHours({ weekId: week.id, date, staffId, maxHours });
        count += removed.length;
      }
      const added = await fillDayHours({ weekId: week.id, date, maxHours });
      const acts = await assignMissingActivities({ weekId: week.id, date });
      return { count, added, acts };
    },
    onSuccess: ({ count, added, acts }) => {
      ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-activities', 'leirskole-week-plan'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success(
        count || added || acts
          ? `Fjernet ${count} vakter · la til ${added} mot ${maxHours}t · ${acts} fikk aktivitet`
          : 'Dagen er allerede balansert',
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke rydde dagen'),
  });

  /** Rydd hele uken: ingen leder over dagstaket noen dag. */
  const fixWeek = useMutation({
    mutationFn: async () => {
      let removed = 0;
      let added = 0;
      let acts = 0;
      for (const date of dates) {
        const day = staffHoursByDate.get(date) ?? new Map<string, number>();
        for (const [staffId, v] of day.entries()) {
          if (v <= maxHours + 0.01) continue;
          const gone = await trimDayHours({ weekId: week.id, date, staffId, maxHours });
          removed += gone.length;
        }
        // Fyll deretter opp de som ligger langt under taket.
        added += await fillDayHours({ weekId: week.id, date, maxHours });
        acts += await assignMissingActivities({ weekId: week.id, date });
      }
      return { removed, added, acts };
    },
    onSuccess: ({ removed, added, acts }) => {
      ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-activities', 'leirskole-week-plan'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success(
        removed || added || acts
          ? `Balansert uken: −${removed} / +${added} vakter mot ${maxHours}t · ${acts} fikk aktivitet`
          : `Alle ledere ligger nær ${maxHours}t`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke rydde uken'),
  });

  /** Angre siste generering ved å skrive tilbake bildet vi tok før kjøringen. */
  const undoGenerate = useMutation({
    mutationFn: async () => {
      if (!snapshot) throw new Error('Ingen generering å angre');
      await restoreLeirskoleSnapshot(snapshot);
    },
    onSuccess: () => {
      [
        'leirskole-week-plan',
        'leirskole-schedule',
        'leirskole-activities',
        'leirskole-activity-history',
        'leirskole-my-shifts',
        'leirskole-kitchen-days',
      ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      setSnapshot(null);
      setSummary(null);
      toast.success('Genereringen er angret');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke angre'),
  });

  /** Hent forhåndsvisning før noe skrives. */
  const openPreview = async (mode: LeirskoleGenerateMode) => {

    setPendingMode(mode);
    setPreviewLoading(true);
    try {
      const p = await previewLeirskoleGenerate({
        weekId: week.id,
        startDate: week.start_date,
        endDate: week.end_date,
        mode,
        overwritePlan: mode === 'plan',
      });
      setPreview(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunne ikke beregne forhåndsvisning');
      setPendingMode(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  /** Radene for en vanlig dag: økt 1–3. Ankomst/avreise bruker kalenderkolonne. */
  const rowsFor = (date: string): (CellTarget | null)[] => {
    if (specialDays.has(date)) return SESSIONS.map(() => null);
    return SESSIONS.map((s) => ({
      date,
      session: s.session,
      rowIndex: s.row,
      label: s.label,
      dayType: 'normal' as const,
    }));
  };

  const cellContent = (t: CellTarget) =>
    planContent.get(t.postId ? `post|${t.postId}` : `${t.date}|${t.rowIndex}`) ?? '';

  const gridStyle = {
    gridTemplateColumns: `${big ? 84 : 64}px repeat(${dates.length}, minmax(${big ? '240px' : '0'}, 1fr))`,
  };

  /** Aktiviteter i ukeplanen som ingen leder har fått ennå. */
  const missing = useMemo(() => {
    const out: { target: CellTarget; label: string; emoji: string | null }[] = [];
    dates.forEach((date) => {
      rowsFor(date).forEach((t) => {
        if (!t || !t.session) return;
        const lines = cellContent(t).split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return;
        const slotActivities = activityBySlot.get(`${date}|${t.session}`) ?? [];
        (types ?? [])
          .filter((ty) => lines.some((l) => l.toLowerCase().includes(ty.label.toLowerCase())))
          .filter((ty) => !slotActivities.some((a) => a.activity === ty.key))
          .forEach((ty) => out.push({ target: t, label: ty.label, emoji: ty.emoji }));
      });
    });
    return out;
  }, [dates, activityBySlot, types, planContent, postsByDate, specialDays]);

  const missingByDay = useMemo(() => {
    const map = new Map<string, typeof missing>();
    missing.forEach((m) => map.set(m.target.date, [...(map.get(m.target.date) ?? []), m]));
    return map;
  }, [missing]);

  /** `${date}|${staffId}` -> vaktene lederen har den dagen (til lederoversikten). */
  const shiftsByStaffDate = useMemo(() => {
    const map = new Map<
      string,
      { name: string; hours: number; assignmentId?: string; postId?: string; kitchen?: boolean }[]
    >();
    (posts ?? []).forEach((p) => {
      (p.assignments ?? []).forEach((a) => {
        const key = `${p.date}|${a.staff_id}`;
        map.set(key, [
          ...(map.get(key) ?? []),
          {
            name: p.name ?? 'Vakt',
            hours: Number(p.duration_hours ?? 0),
            assignmentId: a.id,
            postId: p.id,
          },
        ]);
      });
    });
    (kitchenDays ?? []).forEach((k) => {
      const key = `${k.date}|${k.staff_id}`;
      map.set(key, [...(map.get(key) ?? []), { name: 'Kjøkken', hours: KITCHEN_DAY_HOURS, kitchen: true }]);
    });
    return map;
  }, [posts, kitchenDays]);

  /** Alle brudd i uken — samme regler som brukes i redigeringspanelet. */
  const issues = useMemo(
    () =>
      validateLeirskoleWeek({
        dates,
        posts: (posts ?? []).map((p) => ({
          id: p.id,
          date: p.date,
          name: p.name ?? 'Vakt',
          start_time: String(p.start_time ?? '00:00'),
          end_time: String(p.end_time ?? '00:00'),
          duration_hours: Number(p.duration_hours ?? 0),
          leaderIds: (p.assignments ?? [])
            .map((a) => staffToLeader.get(a.staff_id)?.id)
            .filter((x): x is string => !!x),
        })),
        specialDates: new Set(specialDays.keys()),
        lockedDates: lockedDays,
        kitchenByDate: (() => {
          const map = new Map<string, string[]>();
          (kitchenDays ?? []).forEach((k) => {
            const l = staffToLeader.get(k.staff_id);
            if (l) map.set(k.date, [...(map.get(k.date) ?? []), l.id]);
          });
          return map;
        })(),
        kitchenHours: KITCHEN_DAY_HOURS,
        maxHours,
        leaderName,
        missingActivities: missing.map((m) => ({
          date: m.target.date,
          session: m.target.session,
          rowIndex: m.target.rowIndex,
          label: m.target.label,
          activityLabel: `${m.emoji ?? '•'} ${m.label}`,
        })),
      }),
    [dates, posts, specialDays, lockedDays, kitchenDays, staffToLeader, maxHours, leaderName, missing],
  );

  const issuesByLeader = useMemo(() => {
    const map = new Map<string, LeirskoleIssue[]>();
    issues.forEach((i) => {
      if (!i.leaderId) return;
      map.set(i.leaderId, [...(map.get(i.leaderId) ?? []), i]);
    });
    return map;
  }, [issues]);

  /** Timer og konflikter per leder for den ruten som redigeres. */
  const cellLeaderInfo = useMemo(() => {
    const map = new Map<string, { day: number; week: number; note?: string }>();
    if (!target) return map;
    staff.forEach((s) => {
      if (!s.leader) return;
      const day = staffHoursByDate.get(target.date)?.get(s.id) ?? 0;
      const weekTotal = dates.reduce((sum, d) => sum + (staffHoursByDate.get(d)?.get(s.id) ?? 0), 0);
      const notes = (issuesByLeader.get(s.leader.id) ?? [])
        .filter((i) => i.date === target.date)
        .map((i) => i.message);
      map.set(s.leader.id, { day, week: weekTotal, note: notes[0] });
    });
    return map;
  }, [target, staff, staffHoursByDate, dates, issuesByLeader]);

  /** Hopp fra varsel til riktig rute (eller til lederoversikten for timer/hvile). */
  const jumpToIssue = (issue: LeirskoleIssue) => {
    const session = issue.rowIndex != null ? SESSIONS.find((s) => s.row === issue.rowIndex) : null;
    if (session) {
      setTarget({
        date: issue.date,
        session: session.session,
        rowIndex: session.row,
        label: session.label,
        dayType: 'normal',
      });
      return;
    }
    setView('ledere');
  };

  const LabelCell = ({ children }: { children: React.ReactNode }) => (
    <div className="sticky left-0 z-10 flex items-center bg-card px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );

  /** Én måltidsrute i bordet — ligger mellom øktene så dagen leses kronologisk. */
  const MealCell = ({ date, meal, style }: { date: string; meal: string; style: React.CSSProperties }) => {
    const post = (postsByDate.get(date) ?? []).find(
      (p) => (p.name ?? '').trim().toLowerCase() === meal.toLowerCase(),
    );
    if (!post) {
      return (
        <button
          type="button"
          style={style}
          onClick={() => createPost.mutate({ date, name: meal })}
          disabled={createPost.isPending}
          className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-2 py-1 text-left text-[10px] text-muted-foreground hover:bg-muted"
        >
          + {meal}
        </button>
      );
    }
    return (
      <div style={style} className="flex">
        <LeirskolePostStaffPicker
          weekId={week.id}
          title={`${meal} · ${new Date(`${date}T12:00:00`).getDate()}.`}
          maxHours={maxHours}
          hoursByStaff={staffHoursByDate.get(date) ?? new Map()}
          staffOptions={staffOptions}
          post={{
            id: post.id,
            name: post.name ?? meal,
            date,
            duration_hours: post.duration_hours,
            assignments: post.assignments ?? [],
          }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-xl border border-border/60 bg-muted/30 px-2 py-1 text-left text-[10px] hover:brightness-105"
          >
            <span className="shrink-0 font-semibold">{meal}</span>
            <span className="flex-1 truncate text-muted-foreground">
              {(post.assignments ?? [])
                .map((a) => firstName(staffToLeader.get(a.staff_id)?.name ?? '?'))
                .join(', ') || 'ingen'}
            </span>
          </button>
        </LeirskolePostStaffPicker>
      </div>
    );
  };

  return (
    <div className="oks-ls-pill space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Hele uken
          </p>
          <p className="text-xs text-muted-foreground">
            Trykk på en rute for å endre aktiviteter eller hvem som tar dem.
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-background/70 px-1.5 py-0.5 font-medium text-foreground">Navn</span>
            har aktivitet
            <span className="rounded-full border border-dashed border-muted-foreground/40 px-1.5 py-0.5">Navn</span>
            på vakt uten aktivitet
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-muted/60 p-0.5">
            {[
              { key: 'bord' as const, label: 'Ukebord', icon: LayoutGrid },
              { key: 'ledere' as const, label: 'Ledere', icon: Users },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          {view === 'bord' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs"
              onClick={toggleBig}
              title={big ? 'Bytt til kompakt visning' : 'Bytt til stor visning'}
            >
              {big ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {big ? 'Kompakt' : 'Stor'}
            </Button>
          )}
          {snapshot && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs"
              onClick={() => undoGenerate.mutate()}
              disabled={undoGenerate.isPending}
            >
              <Undo2 className="h-3.5 w-3.5" />
              {undoGenerate.isPending ? 'Angrer…' : 'Angre generering'}
            </Button>
          )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button className="gap-2 rounded-full" disabled={generate.isPending}>
              <Wand2 className="h-4 w-4" />
              {generate.isPending ? 'Genererer…' : 'Generer uken'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            {[
              { mode: 'all' as const, title: 'Generer alt', sub: 'Ukeplan + vaktplan + aktiviteter' },
              {
                mode: 'schedule' as const,
                title: 'Vaktplan fra ukeplanen',
                sub: 'Ledere fylles inn, roterer på aktiviteter · maks 8t',
              },
              { mode: 'plan' as const, title: 'Ny tilfeldig ukeplan', sub: 'Lager plan på nytt (overskriver rutene)' },
            ].map((o) => (
              <button
                key={o.mode}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void openPreview(o.mode);
                }}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-muted"
              >
                <p className="text-sm font-semibold">{o.title}</p>
                <p className="text-xs text-muted-foreground">{o.sub}</p>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">
          <p className="font-semibold">
            {summary.cellsFilled} ruter fylt · {summary.shifts} vakter · {summary.activityAssignments} aktiviteter fordelt
          </p>
          {summary.scheduleWarning && (
            <p className="mt-1 flex items-center gap-1 text-amber-500">
              <AlertTriangle className="h-3 w-3" /> {summary.scheduleWarning}
            </p>
          )}
          {summary.gaps.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> {summary.gaps.length} vakter fikk ikke full bemanning ved forrige
              generering
            </p>
          )}
        </div>
      )}

      <LeirskoleBoardIssues issues={issues} onJump={jumpToIssue} />

      {view === "bord" && (
      <div className="-mx-2 px-2">
        <div className="space-y-1.5">
          {/* Dagoverskrifter */}
          <div className="grid gap-1.5" style={gridStyle}>
            <div className="sticky left-0 z-10 bg-card" />
            {dates.map((date) => {
              const d = new Date(`${date}T12:00:00`);
              const special = specialDays.get(date);
              const locked = lockedDays.has(date);
              return (
                <div
                  key={date}
                  className={`rounded-xl px-2 py-1.5 text-center ${
                    special ? 'border border-dashed border-amber-500/60 bg-amber-500/15' : 'oks-ls-gradient'
                  } ${locked ? 'ring-2 ring-sky-400' : ''}`}
                >
                  <p className={`text-xs font-bold ${special ? 'text-amber-700 dark:text-amber-200' : 'text-white'}`}>
                    {WEEKDAYS[d.getDay()]} {d.getDate()}.
                  </p>
                  {special && (
                    <p className="text-[10px] font-semibold uppercase text-amber-700/80 dark:text-amber-200/80">
                      {special === 'both' ? 'Avreise + ankomst' : special === 'arrival' ? 'Ankomst' : 'Avreise'}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      title={locked ? 'Åpne dagen for generering' : 'Lås dagen (generatoren endrer den ikke)'}
                      onClick={() =>
                        setDayLock.mutate(
                          { weekId: week.id, date, locked: !locked },
                          {
                            onSuccess: () => toast.success(locked ? 'Dagen er åpnet' : 'Dagen er låst'),
                            onError: () => toast.error('Kunne ikke endre låsen'),
                          },
                        )
                      }
                      className={`rounded-full p-1 ${
                        locked
                          ? 'bg-sky-500 text-white'
                          : special
                            ? 'bg-background/70 text-muted-foreground'
                            : 'bg-white/20 text-white'
                      }`}
                    >
                      {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      title="Logg: hvordan gikk dagen?"
                      onClick={() => openLog(date)}
                      className={`rounded-full p-1 ${
                        dayLogs.has(date)
                          ? 'bg-emerald-500 text-white'
                          : special
                            ? 'bg-background/70 text-muted-foreground'
                            : 'bg-white/20 text-white'
                      }`}
                    >
                      <NotebookPen className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Øktrader — måltidene ligger mellom øktene, slik at alt følger klokken.
              Ankomst/avreise vises som én kalenderkolonne over hele dagen. */}
          <div className="grid gap-1.5" style={gridStyle}>
            {BOARD_ROWS.map((r, rowIdx) => (
              <div key={`label-${r.label}`} style={{ gridColumn: 1, gridRow: rowIdx + 1 }} className="flex items-center">
                <LabelCell>
                  <span className="leading-tight">
                    {r.label}
                    <span className="block text-[9px] font-medium normal-case text-muted-foreground/70">{r.time}</span>
                  </span>
                </LabelCell>
              </div>
            ))}
            {dates.map((date, dayIdx) =>
              specialDays.has(date) ? (
                <div
                  key={`cal-${date}`}
                  style={{ gridColumn: dayIdx + 2, gridRow: `1 / span ${BOARD_ROWS.length}` }}
                  className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-1.5"
                >
                  <LeirskoleSpecialDayTimeline
                    weekId={week.id}
                    date={date}
                    posts={(postsByDate.get(date) ?? [])
                      .filter((p) => !NIGHT_ROW_NAMES.has((p.name ?? '').trim()))
                      .map((p) => ({
                        id: p.id,
                        name: p.name ?? '',
                        start_time: p.start_time,
                        end_time: p.end_time,
                        assignments: p.assignments ?? [],
                      }))}
                    staffOptions={staff
                      .filter((s) => s.leader)
                      .map((s) => ({ staffId: s.id, name: s.leader!.name }))}
                  />
                </div>
              ) : (
                BOARD_ROWS.map((r, rowIdx) => {
                  if (r.kind === 'meal') {
                    return (
                      <MealCell
                        key={`${date}-${r.meal}`}
                        date={date}
                        meal={r.meal}
                        style={{ gridColumn: dayIdx + 2, gridRow: rowIdx + 1 }}
                      />
                    );
                  }
                  const t = rowsFor(date)[r.sessionIdx];
                  if (!t) return null;
                const content = cellContent(t);
                const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
                const slotActivities = t.session ? activityBySlot.get(`${date}|${t.session}`) ?? [] : [];
                 // Aktiviteter kan stå flere ganger i samme rute (to på Klatring osv.),
                 // og hver forekomst vises med sin egen leder.
                 const instances = cellInstances(lines, types ?? [], slotActivities);
                 const withLeader = instances.filter((i) => i.leaderId).length;
                const tone =
                  lines.length === 0
                    ? 'border-border/60 bg-muted/25'
                     : withLeader >= instances.length && instances.length > 0
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-amber-500/50 bg-amber-500/10';
                return (
                  <button
                    key={`${date}-${r.label}`}
                    type="button"
                    style={{ gridColumn: dayIdx + 2, gridRow: rowIdx + 1 }}
                    onClick={() => setTarget(t)}
                    className={`rounded-xl border text-left ${ui.pad} transition-colors hover:brightness-105 ${tone}`}
                  >
                    {t.session === null && (
                      <p className={`mb-1 truncate ${ui.sub} font-semibold uppercase text-muted-foreground`}>
                        {t.label}
                      </p>
                    )}
                    {lines.length === 0 && <p className={`${ui.txt} text-muted-foreground`}>Tom — trykk for å fylle</p>}
                     <div className="space-y-1">
                       {instances.map((inst) => (
                         <div key={inst.id} className={`flex items-center gap-1 ${ui.txt}`}>
                           <span>{inst.emoji ?? '•'}</span>
                           <span className="flex-1 truncate font-medium">{inst.label}</span>
                           <span
                             className={`shrink-0 truncate ${ui.sub} ${
                               inst.leaderId ? 'font-semibold text-foreground' : 'text-amber-600 dark:text-amber-400'
                             }`}
                           >
                             {inst.leaderId ? firstName(leaderName.get(inst.leaderId) ?? '?') : 'ingen'}
                           </span>
                         </div>
                       ))}
                       {instances.length === 0 &&
                        lines.map((l, i) => (
                           <p key={`${l}-${i}`} className={`truncate ${ui.txt}`}>
                            {l}
                          </p>
                        ))}
                    </div>
                    {t.session && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(dutyBySlot.get(`${date}|${t.session}`) ?? []).length === 0 && (
                          <span className={`${ui.sub} text-muted-foreground`}>Ingen ledere</span>
                        )}
                        {/* Kun ledere uten aktivitet vises som brikker — de med aktivitet
                            står allerede i listen over, så navnene dupliseres ikke. */}
                        {(dutyBySlot.get(`${date}|${t.session}`) ?? [])
                          .filter((l) => !slotActivities.some((a) => a.leader_id === l.id))
                          .map((l) => (
                            <span
                              key={l.id}
                              title={`${l.name} – uten aktivitet`}
                              className={`truncate max-w-[6.5rem] rounded-full border border-dashed border-muted-foreground/40 bg-transparent font-medium text-muted-foreground ${ui.chip}`}
                            >
                              {firstName(l.name)}
                            </span>
                          ))}
                      </div>
                    )}
                  </button>
                );
                })
              ),
            )}
          </div>

          {/* Kjøkken hele dagen */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>Kjøkken</LabelCell>
            {dates.map((date) => {
              const onDuty = (kitchenDays ?? []).filter((k) => k.date === date);
              /** Kjøkkenvakt = 8t, så alt annet samme dag er en konflikt. */
              const clash = onDuty.filter((k) =>
                (postsByDate.get(date) ?? []).some((p) => (p.assignments ?? []).some((a) => a.staff_id === k.staff_id)),
              );
              return (
                <Popover key={date}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`rounded-xl border p-2 text-left text-[11px] hover:brightness-105 ${
                        clash.length ? 'border-destructive/60 bg-destructive/10' : 'border-sky-500/40 bg-sky-500/10'
                      }`}
                    >
                      {onDuty.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {onDuty.map((k) => firstName(staffToLeader.get(k.staff_id)?.name ?? '?')).join(', ')}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">{KITCHEN_DAY_HOURS}t</span>
                          {clash.length > 0 && (
                            <p className="mt-0.5 text-[10px] font-semibold text-destructive">
                              {clash
                                .map((k) => firstName(staffToLeader.get(k.staff_id)?.name ?? '?'))
                                .join(', ')}{' '}
                              er også satt på økt
                            </p>
                          )}
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2">
                    <p className="px-1 pb-1.5 text-xs font-semibold">
                      Kjøkken hele dagen · {KITCHEN_DAY_HOURS}t
                    </p>
                    <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
                      {staffOptions.map((s) => {
                        const on = onDuty.some((k) => k.staff_id === s.staffId);
                        const hours = staffHoursByDate.get(date)?.get(s.staffId) ?? 0;
                        return (
                          <button
                            key={s.staffId}
                            type="button"
                            onClick={() =>
                              setKitchenDay.mutate({ weekId: week.id, staffId: s.staffId, date, active: !on })
                            }
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted ${
                              on ? 'bg-primary/10 font-semibold' : ''
                            }`}
                          >
                            <span className="flex-1 truncate">
                              {on ? '✓ ' : ''}
                              {s.name}
                            </span>
                            <span
                              className={`tabular-nums text-[10px] ${
                                hours > maxHours + 0.01 ? 'text-destructive' : 'text-muted-foreground'
                              }`}
                            >
                              {hours.toFixed(1)}t
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>

          {/* Nattevakt */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>
              <span className="leading-tight">
                Sanitas
                <span className="block text-[9px] font-medium normal-case text-muted-foreground/70">22.30–23</span>
              </span>
            </LabelCell>
            {dates.map((date) => {
              const post = (postsByDate.get(date) ?? []).find((p) =>
                (p.name ?? '').toLowerCase().includes('sanitas'),
              );
              if (!post) {
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => createPost.mutate({ date, name: 'Sanitas' })}
                    disabled={createPost.isPending}
                    className="rounded-xl border border-dashed border-teal-500/40 bg-muted/25 p-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    + Sanitas
                  </button>
                );
              }
              return (
                <LeirskolePostStaffPicker
                  key={date}
                  weekId={week.id}
                  title="Sanitas · 22.30–23 (maks 4)"
                  maxHours={maxHours}
                  hoursByStaff={staffHoursByDate.get(date) ?? new Map()}
                  staffOptions={staffOptions}
                  post={{
                    id: post.id,
                    name: post.name ?? 'Sanitas',
                    date,
                    duration_hours: post.duration_hours,
                    assignments: post.assignments ?? [],
                  }}
                >
                  <button
                    type="button"
                    className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-2 text-left text-[11px] font-semibold hover:brightness-105"
                  >
                    {(post.assignments ?? [])
                      .map((a) => firstName(staffToLeader.get(a.staff_id)?.name ?? '?'))
                      .join(', ') || <span className="text-muted-foreground">ingen</span>}
                  </button>
                </LeirskolePostStaffPicker>
              );
            })}
          </div>

          {/* Nattevakt */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>
              <Moon className="mr-1 h-3 w-3" /> Natt
            </LabelCell>
            {dates.map((date) => {
              const post = (postsByDate.get(date) ?? []).find((p) =>
                (p.name ?? '').toLowerCase().includes('natt'),
              );
              if (!post) {
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => createPost.mutate({ date, name: 'Nattevakt' })}
                    disabled={createPost.isPending}
                    className="rounded-xl border border-dashed border-indigo-500/40 bg-muted/25 p-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    + Nattevakt
                  </button>
                );
              }
              return (
                <LeirskolePostStaffPicker
                  key={date}
                  weekId={week.id}
                  title="Nattevakt"
                  maxHours={maxHours}
                  hoursByStaff={staffHoursByDate.get(date) ?? new Map()}
                  staffOptions={staffOptions}
                  post={{
                    id: post.id,
                    name: post.name ?? 'Nattevakt',
                    date,
                    duration_hours: post.duration_hours,
                    assignments: post.assignments ?? [],
                  }}
                >
                  <button
                    type="button"
                    className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-2 text-left text-[11px] font-semibold hover:brightness-105"
                  >
                    {(post.assignments ?? [])
                      .map((a) => firstName(staffToLeader.get(a.staff_id)?.name ?? '?'))
                      .join(', ') || <span className="text-muted-foreground">ingen</span>}
                  </button>
                </LeirskolePostStaffPicker>
              );
            })}
          </div>

          {/* Timer */}
          <div className="grid gap-1.5" style={gridStyle}>
            <LabelCell>Timer</LabelCell>
            {dates.map((date) => {
              const day = hoursByDate.get(date) ?? new Map<string, number>();
              const values = [...day.values()];
              const max = Number(week.max_daily_hours ?? 8);
              const over = [...day.entries()].filter(([, v]) => v > max + 0.01);
              const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-[11px] ${
                    over.length ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border/60 bg-muted/25'
                  }`}
                >
                  <span className="font-bold tabular-nums">{avg.toFixed(1)}t</span>
                  <span className="text-muted-foreground"> snitt · {values.length} ledere</span>
                  {over.length > 0 && (
                    <>
                      <p className="font-semibold">{over.length} over {max}t</p>
                      <p className="text-[10px] leading-tight">
                        {over
                          .map(([id, v]) => `${firstName(leaderName.get(id) ?? '?')} ${v.toFixed(1)}t`)
                          .join(' · ')}
                      </p>
                      <button
                        type="button"
                        onClick={() => fixDay.mutate(date)}
                        disabled={fixDay.isPending}
                        className="mt-1 rounded-full border border-destructive/50 bg-background/70 px-2 py-0.5 text-[10px] font-semibold hover:bg-destructive/10"
                      >
                        Fiks timer
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Full oversikt: timer og vakter per leder gjennom uken */}
      {view === 'ledere' && (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">Ledere gjennom uken</p>
            <p className="text-[11px] text-muted-foreground">
              Alt lagres automatisk. Mål: så nær {maxHours}t som mulig hver dag.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => fixWeek.mutate()}
              disabled={fixWeek.isPending}
            >
              {fixWeek.isPending ? 'Rydder…' : `Fiks hele uken (${maxHours}t)`}
            </Button>
            <Button
              size="sm"
              className="gap-1 rounded-full text-xs"
              onClick={() => void openPreview('schedule')}
              disabled={generate.isPending}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {generate.isPending ? 'Genererer…' : 'Generer på nytt'}
            </Button>
          </div>
        </div>
        <LeirskoleLeaderWeekTable
          dates={dates}
          staff={staff
            .filter((s) => s.leader)
            .map((s) => ({ staffId: s.id, leaderId: s.leader!.id, name: s.leader!.name }))}
          shifts={shiftsByStaffDate}
          kitchenSet={kitchenSet}
          maxHours={maxHours}
          issuesByLeader={issuesByLeader}
        />
      </div>
      )}

      <LeirskoleGeneratePreviewDialog
        preview={preview}
        loading={previewLoading}
        running={generate.isPending}
        onCancel={() => {
          setPreview(null);
          setPendingMode(null);
        }}
        onConfirm={() => pendingMode && generate.mutate(pendingMode)}
      />


      <LeirskoleCellSheet
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        leaderInfo={cellLeaderInfo}
        weekId={week.id}
        target={target}
        content={target ? cellContent(target) : ''}
        types={types ?? []}
        onDuty={target?.session ? dutyBySlot.get(`${target.date}|${target.session}`) ?? [] : []}
        allStaff={staff
          .filter((s) => s.leader)
          .map((s) => ({
            id: s.leader!.id,
            name: s.leader!.name,
            competencies: s.leader!.leirskole_competencies ?? [],
          }))}
        assignments={target?.session ? activityBySlot.get(`${target.date}|${target.session}`) ?? [] : []}
        post={
          target?.postId
            ? (() => {
                const p = (posts ?? []).find((x) => x.id === target.postId);
                return p
                  ? {
                      id: p.id,
                      name: p.name ?? '',
                      start_time: p.start_time,
                      end_time: p.end_time,
                      assignments: p.assignments ?? [],
                    }
                  : null;
              })()
            : null
        }
        staffOptions={staff
          .filter((s) => s.leader)
          .map((s) => ({ staffId: s.id, leaderId: s.leader!.id, name: s.leader!.name }))}
      />

      {/* Logg for dagen: hva ble gjort, og hvem jobbet når */}
      <Dialog open={!!logDate} onOpenChange={(v) => !v && setLogDate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Logg ·{' '}
              {logDate
                ? `${WEEKDAYS[new Date(`${logDate}T12:00:00`).getDay()]} ${new Date(`${logDate}T12:00:00`).getDate()}.`
                : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-52 overflow-y-auto rounded-2xl border border-border/60 bg-muted/30 p-2 text-xs">
              <p className="mb-1 font-semibold text-muted-foreground">Hvem jobbet når</p>
              {(logDate ? postsByDate.get(logDate) ?? [] : []).length === 0 ? (
                <p className="text-muted-foreground">Ingen vakter satt opp denne dagen.</p>
              ) : (
                (logDate ? postsByDate.get(logDate) ?? [] : []).map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 py-0.5">
                    <span className="font-medium">
                      {p.name}{' '}
                      <span className="text-muted-foreground tabular-nums">
                        {String(p.start_time).slice(0, 5)}–{String(p.end_time).slice(0, 5)}
                      </span>
                    </span>
                    <span className="text-right text-muted-foreground">
                      {(p.assignments ?? [])
                        .map((a) => staffToLeader.get(a.staff_id)?.name ?? '—')
                        .map(firstName)
                        .join(', ') || 'Ingen'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              rows={6}
              placeholder="Hvordan gikk øktene? Hva ble faktisk gjort, endringer, avvik…"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="gap-1.5 rounded-full"
                onClick={() =>
                  logDate &&
                  setDayLock.mutate({ weekId: week.id, date: logDate, locked: !lockedDays.has(logDate) })
                }
              >
                {logDate && lockedDays.has(logDate) ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                {logDate && lockedDays.has(logDate) ? 'Låst' : 'Lås dagen'}
              </Button>
              <Button
                className="rounded-full"
                disabled={setDayLog.isPending}
                onClick={() =>
                  logDate &&
                  setDayLog.mutate(
                    { weekId: week.id, date: logDate, note: logText },
                    {
                      onSuccess: () => {
                        toast.success('Logg lagret');
                        setLogDate(null);
                      },
                      onError: () => toast.error('Kunne ikke lagre loggen'),
                    },
                  )
                }
              >
                Lagre logg
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
