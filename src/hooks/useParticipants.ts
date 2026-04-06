import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Participant, Cabin } from '@/types/database';

export interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
}

export function useParticipants(cabinIds?: string[]) {
  return useQuery<ParticipantWithCabin[]>({
    queryKey: ['participants', cabinIds ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('participants')
        .select('*, cabins(*)')
        .order('name', { ascending: true });

      if (cabinIds && cabinIds.length > 0) {
        query = query.in('cabin_id', cabinIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ParticipantWithCabin[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
