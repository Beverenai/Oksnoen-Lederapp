import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';

export interface ParticipantTeam {
  id: string;
  period_id: string;
  slot: number;
  name: string;
  color: string;
  bonus_points?: number;
}

/**
 * Fetches the 10 teams for the active period.
 */
export function useParticipantTeams() {
  const { data: periodId } = useActivePeriodId();

  return useQuery({
    queryKey: ['participant-teams', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async (): Promise<ParticipantTeam[]> => {
      const { data, error } = await supabase
        .from('participant_teams')
        .select('*')
        .eq('period_id', periodId!)
        .order('slot');
      if (error) throw error;
      return (data || []) as ParticipantTeam[];
    },
    staleTime: 60_000,
  });
}

/**
 * Convenience: returns a Map<team_id, ParticipantTeam> for quick lookup.
 */
export function useTeamMap() {
  const { data } = useParticipantTeams();
  const map = new Map<string, ParticipantTeam>();
  (data || []).forEach((t) => map.set(t.id, t));
  return map;
}