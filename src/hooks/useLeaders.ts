import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Leader } from '@/types/database';

export function useLeaders() {
  return useQuery<Leader[]>({
    queryKey: ['leaders', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });
}

export function useAllLeaders() {
  return useQuery<Leader[]>({
    queryKey: ['leaders', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });
}
