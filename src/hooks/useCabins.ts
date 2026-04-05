import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cabin } from '@/types/database';

export function useCabins() {
  return useQuery<Cabin[]>({
    queryKey: ['cabins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cabins')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 120000,
  });
}
