import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';

/**
 * Participants marked as "Har dratt hjem" via an incident in the active period.
 * Used to show who has left camp and how many are left.
 */
export function useWentHomeParticipants(enabled: boolean) {
  const { data: periodId } = useActivePeriodId();

  return useQuery({
    queryKey: ['went-home-participants', periodId],
    enabled: enabled && !!periodId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('participant_incident_participants')
        .select('participant_id, participant_incidents!inner(period_id, category)')
        .eq('participant_incidents.period_id', periodId)
        .eq('participant_incidents.category', 'hjemreise');
      if (error) throw error;
      return new Set<string>(((data || []) as any[]).map((r) => r.participant_id as string));
    },
  });
}