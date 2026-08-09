import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Participant, Cabin } from '@/types/database';
import { useSeasonView } from '@/contexts/SeasonViewContext';
import { fetchSeasonParticipants } from './useSeasonParticipants';

export interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
}

export function useParticipants(cabinIds?: string[]) {
  const { seasonView } = useSeasonView();

  return useQuery<ParticipantWithCabin[]>({
    queryKey: ['participants', cabinIds ?? 'all', seasonView ? 'season' : 'active'],
    queryFn: async () => {
      if (seasonView) {
        const all = await fetchSeasonParticipants();
        return cabinIds && cabinIds.length > 0
          ? all.filter((p) => p.cabin_id && cabinIds.includes(p.cabin_id))
          : all;
      }

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
