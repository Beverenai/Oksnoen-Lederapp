import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';
import type { IncidentCategory, IncidentSeverity } from './useParticipantIncidents';

export interface DashParticipant {
  id: string;
  name: string;
  birth_date: string | null;
  image_url: string | null;
  image_thumb_url: string | null;
  room: string | null;
  team_id: string | null;
  cabin_id: string | null;
  has_arrived: boolean | null;
}

export interface DashBirthday extends DashParticipant {
  turns: number | null;
  inDays: number;
  cabinName: string | null;
}

export interface DashIncident {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  created_at: string;
  participants: DashParticipant[];
}

export interface DashNote {
  id: string;
  title: string | null;
  kind: string;
  is_pinned: boolean | null;
  updated_at: string;
}

export interface DashFixTask {
  id: string;
  title: string;
  location: string | null;
  status: string;
  created_at: string;
}

export interface DashMailbox {
  id: string;
  category: string | null;
  content: string;
  created_at: string;
  is_anonymous: boolean | null;
}

export interface DashTask {
  id: string;
  message: string;
  status: string;
  created_at: string;
  is_broadcast: boolean | null;
  participant: DashParticipant | null;
}

export interface AdminDashboardData {
  period: { id: string; name: string; start_date: string | null; end_date: string | null } | null;
  totalParticipants: number;
  arrived: number;
  notArrived: number;
  wentHome: number;
  inCamp: number;
  activeLeaders: number;
  birthdaysToday: DashBirthday[];
  birthdaysSoon: DashBirthday[];
  incidents: DashIncident[];
  notes: DashNote[];
  nurseReports: number;
  importantHealthInfo: number;
  openFix: number;
  fixTasks: DashFixTask[];
  unansweredMail: number;
  mailbox: DashMailbox[];
  openTasks: DashTask[];
}

/** Days until next occurrence of the birthday (0 = today). */
function daysUntilBirthday(birth: string): { inDays: number; turns: number | null } {
  const b = new Date(birth + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next.getTime() < today.getTime()) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  const inDays = Math.round((next.getTime() - today.getTime()) / 86400000);
  const turns = next.getFullYear() - b.getFullYear();
  return { inDays, turns: Number.isFinite(turns) ? turns : null };
}

export function useAdminDashboard(enabled: boolean) {
  const { data: periodId } = useActivePeriodId();

  return useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard', periodId],
    enabled: enabled && !!periodId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [
        periodRes,
        participantsRes,
        cabinsRes,
        leadersRes,
        incidentsRes,
        wentHomeRes,
        notesRes,
        nurseRes,
        healthRes,
        fixRes,
        mailRes,
        tasksRes,
      ] = await Promise.all([
        supabase.from('periods').select('id, name, start_date, end_date').eq('id', periodId!).maybeSingle(),
        supabase
          .from('participants')
          .select('id, name, birth_date, image_url, image_thumb_url, room, team_id, cabin_id, has_arrived')
          .eq('period_id', periodId!),
        supabase.from('cabins').select('id, name'),
        supabase.from('leaders').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase
          .from('participant_incidents')
          .select('id, title, category, severity, created_at, participant_incident_participants(participant_id)')
          .eq('period_id', periodId!)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('participant_incident_participants')
          .select('participant_id, participant_incidents!inner(period_id, category)')
          .eq('participant_incidents.period_id', periodId!)
          .eq('participant_incidents.category', 'hjemreise'),
        supabase
          .from('admin_notes')
          .select('id, title, kind, is_pinned, updated_at')
          .order('is_pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase.from('nurse_reports').select('id', { count: 'exact', head: true }).eq('period_id', periodId!),
        supabase.from('participant_health_info').select('id', { count: 'exact', head: true }).eq('period_id', periodId!),
        supabase
          .from('fix_tasks')
          .select('id, title, location, status, created_at')
          .in('status', ['pending', 'assigned'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('mailbox_messages')
          .select('id, category, content, created_at, is_anonymous, admin_reply')
          .eq('period_id', periodId!)
          .is('admin_reply', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('participant_tasks')
          .select('id, message, status, created_at, is_broadcast, participant_id')
          .eq('period_id', periodId!)
          .in('status', ['open', 'claimed'])
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const participants = (participantsRes.data || []) as DashParticipant[];
      const pMap = new Map(participants.map((p) => [p.id, p]));
      const cabinMap = new Map(((cabinsRes.data || []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
      const wentHomeSet = new Set(((wentHomeRes.data || []) as any[]).map((r) => r.participant_id as string));

      const withBirthday = participants
        .filter((p) => !!p.birth_date)
        .map((p) => {
          const { inDays, turns } = daysUntilBirthday(p.birth_date as string);
          return { ...p, inDays, turns, cabinName: p.cabin_id ? cabinMap.get(p.cabin_id) ?? null : null } as DashBirthday;
        });

      const incidents: DashIncident[] = ((incidentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        severity: row.severity,
        created_at: row.created_at,
        participants: ((row.participant_incident_participants || []) as any[])
          .map((l) => pMap.get(l.participant_id))
          .filter(Boolean) as DashParticipant[],
      }));

      const openTasks: DashTask[] = ((tasksRes.data || []) as any[]).map((t) => ({
        id: t.id,
        message: t.message,
        status: t.status,
        created_at: t.created_at,
        is_broadcast: t.is_broadcast,
        participant: t.participant_id ? pMap.get(t.participant_id) ?? null : null,
      }));

      const arrived = participants.filter((p) => p.has_arrived).length;
      const wentHome = participants.filter((p) => wentHomeSet.has(p.id)).length;

      return {
        period: (periodRes.data as any) ?? null,
        totalParticipants: participants.length,
        arrived,
        notArrived: participants.length - arrived,
        wentHome,
        inCamp: Math.max(arrived - wentHome, 0),
        activeLeaders: leadersRes.count ?? 0,
        birthdaysToday: withBirthday.filter((b) => b.inDays === 0).sort((a, b) => a.name.localeCompare(b.name, 'nb')),
        birthdaysSoon: withBirthday
          .filter((b) => b.inDays > 0 && b.inDays <= 3)
          .sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, 'nb')),
        incidents,
        notes: (notesRes.data || []) as DashNote[],
        nurseReports: nurseRes.count ?? 0,
        importantHealthInfo: healthRes.count ?? 0,
        openFix: (fixRes.data || []).length,
        fixTasks: ((fixRes.data || []) as DashFixTask[]).slice(0, 3),
        unansweredMail: (mailRes.data || []).length,
        mailbox: ((mailRes.data || []) as DashMailbox[]).slice(0, 3),
        openTasks,
      };
    },
  });
}