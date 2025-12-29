import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Cabin {
  id: string;
  name: string;
  sort_order: number | null;
  created_at: string | null;
}

export interface ParticipantWithCabin {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  cabin_id: string | null;
  room: string | null;
  image_url: string | null;
  has_arrived: boolean | null;
  notes: string | null;
  activity_notes: string | null;
  pass_written: boolean | null;
  pass_written_at: string | null;
  pass_written_by: string | null;
  pass_suggestion: string | null;
  pass_text: string | null;
  times_attended: number | null;
  created_at: string | null;
  updated_at: string | null;
  cabins: Cabin | null;
}

interface ParticipantActivity {
  id: string;
  participant_id: string;
  activity: string;
  completed_at: string | null;
  registered_by: string | null;
}

interface HealthInfo {
  id: string;
  participant_id: string;
  info: string;
  created_at: string | null;
  updated_at: string | null;
}

interface FetchParticipantsOptions {
  participantId?: string;
  includeHealthInfo?: boolean;
  includeActivities?: boolean;
}

async function fetchParticipantsFromEdge(leaderId: string, options: FetchParticipantsOptions = {}) {
  const { data, error } = await supabase.functions.invoke('get-participants', {
    body: {
      leader_id: leaderId,
      participant_id: options.participantId,
      include_health_info: options.includeHealthInfo,
      include_activities: options.includeActivities,
    },
  });

  if (error) {
    console.error('Error fetching participants:', error);
    throw new Error('Failed to fetch participants');
  }

  return data;
}

export function useParticipants(leaderId: string | null, options: FetchParticipantsOptions = {}) {
  return useQuery({
    queryKey: ['participants', leaderId, options],
    queryFn: () => {
      if (!leaderId) throw new Error('Not authenticated');
      return fetchParticipantsFromEdge(leaderId, options);
    },
    enabled: !!leaderId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useParticipant(leaderId: string | null, participantId: string | null) {
  return useQuery({
    queryKey: ['participant', leaderId, participantId],
    queryFn: async () => {
      if (!leaderId) throw new Error('Not authenticated');
      if (!participantId) throw new Error('No participant ID');
      
      const data = await fetchParticipantsFromEdge(leaderId, {
        participantId,
        includeHealthInfo: true,
        includeActivities: true,
      });
      
      return {
        participant: data.participant as ParticipantWithCabin,
        healthInfo: data.healthInfo as HealthInfo | null,
        activities: data.activities as ParticipantActivity[],
      };
    },
    enabled: !!leaderId && !!participantId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useInvalidateParticipants() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['participants'] });
    queryClient.invalidateQueries({ queryKey: ['participant'] });
  };
}
