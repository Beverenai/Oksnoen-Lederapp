import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';
import type { IncidentSeverity } from './useParticipantIncidents';

export interface IncidentCount {
  count: number;
  highest: IncidentSeverity;
}

const RANK: Record<IncidentSeverity, number> = { low: 0, medium: 1, high: 2 };

/**
 * Counts of registered incidents per participant for the active period.
 * Only fetched when enabled (admin/nurse).
 */
export function useIncidentCounts(enabled: boolean) {
  const { data: periodId } = useActivePeriodId();

  return useQuery({
    queryKey: ['incident-counts', periodId],
    enabled: enabled && !!periodId,
    staleTime: 30_000,
    queryFn: async () => {
      const map = new Map<string, IncidentCount>();
      const { data, error } = await (supabase as any)
        .from('participant_incident_participants')
        .select('participant_id, participant_incidents!inner(id, period_id, severity)')
        .eq('participant_incidents.period_id', periodId);
      if (error) throw error;
      for (const row of (data || []) as any[]) {
        const sev = (row.participant_incidents?.severity ?? 'low') as IncidentSeverity;
        const prev = map.get(row.participant_id);
        if (!prev) {
          map.set(row.participant_id, { count: 1, highest: sev });
        } else {
          prev.count += 1;
          if (RANK[sev] > RANK[prev.highest]) prev.highest = sev;
        }
      }
      return map;
    },
  });
}
