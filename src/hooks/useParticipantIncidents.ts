import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';

export type IncidentCategory = 'konflikt' | 'skade' | 'hjemlengsel' | 'positivt' | 'annet';
export type IncidentSeverity = 'low' | 'medium' | 'high';

export interface IncidentParticipant {
  id: string;
  name: string;
  image_url?: string | null;
  image_thumb_url?: string | null;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  leader_id: string;
  period_id: string | null;
  created_at: string;
  updated_at: string;
  participants: IncidentParticipant[];
  leader?: { id: string; name: string } | null;
}

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  konflikt: 'Konflikt',
  skade: 'Skade',
  hjemlengsel: 'Hjemlengsel',
  positivt: 'Positivt',
  annet: 'Annet',
};

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
};

export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  high: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  konflikt: 'bg-red-500/15 text-red-700 dark:text-red-400',
  skade: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  hjemlengsel: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  positivt: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  annet: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

interface UseIncidentsOptions {
  leaderId?: string | null; // filter to this leader only
  adminAll?: boolean; // fetch all (admin)
}

async function fetchIncidents(periodId: string | null, opts: UseIncidentsOptions): Promise<Incident[]> {
  if (!periodId) return [];
  let query = (supabase as any)
    .from('participant_incidents')
    .select(`
      id, title, description, category, severity, leader_id, period_id, created_at, updated_at,
      leader:leaders(id, name),
      participant_incident_participants(
        participants(id, name, image_url, image_thumb_url)
      )
    `)
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });

  if (opts.leaderId) query = query.eq('leader_id', opts.leaderId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as IncidentCategory,
    severity: row.severity as IncidentSeverity,
    leader_id: row.leader_id,
    period_id: row.period_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    leader: row.leader,
    participants: (row.participant_incident_participants || [])
      .map((p: any) => p.participants)
      .filter(Boolean),
  }));
}

export function useParticipantIncidents(opts: UseIncidentsOptions = {}) {
  const { data: periodId } = useActivePeriodId();
  const qc = useQueryClient();
  const key = ['participant-incidents', periodId, opts.leaderId ?? 'all', opts.adminAll ?? false];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchIncidents(periodId ?? null, opts),
    enabled: !!periodId,
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['participant-incidents'] });
    qc.invalidateQueries({ queryKey: ['participant-incidents-detail'] });
    qc.invalidateQueries({ queryKey: ['incident-counts'] });
  };

  const createIncident = useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      category: IncidentCategory;
      severity: IncidentSeverity;
      leaderId: string;
      participantIds: string[];
    }) => {
      const { data: inc, error } = await (supabase as any)
        .from('participant_incidents')
        .insert({
          title: input.title,
          description: input.description || null,
          category: input.category,
          severity: input.severity,
          leader_id: input.leaderId,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (input.participantIds.length > 0) {
        const rows = input.participantIds.map((pid) => ({
          incident_id: inc.id,
          participant_id: pid,
        }));
        const { error: linkErr } = await (supabase as any)
          .from('participant_incident_participants')
          .insert(rows);
        if (linkErr) throw linkErr;
      }
      return inc.id as string;
    },
    onSuccess: invalidate,
  });

  const updateIncident = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description: string;
      category: IncidentCategory;
      severity: IncidentSeverity;
      participantIds: string[];
    }) => {
      const { error } = await (supabase as any)
        .from('participant_incidents')
        .update({
          title: input.title,
          description: input.description || null,
          category: input.category,
          severity: input.severity,
        })
        .eq('id', input.id);
      if (error) throw error;
      // Replace participants
      await (supabase as any)
        .from('participant_incident_participants')
        .delete()
        .eq('incident_id', input.id);
      if (input.participantIds.length > 0) {
        const rows = input.participantIds.map((pid) => ({
          incident_id: input.id,
          participant_id: pid,
        }));
        const { error: linkErr } = await (supabase as any)
          .from('participant_incident_participants')
          .insert(rows);
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: invalidate,
  });

  const deleteIncident = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('participant_incidents')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, createIncident, updateIncident, deleteIncident };
}