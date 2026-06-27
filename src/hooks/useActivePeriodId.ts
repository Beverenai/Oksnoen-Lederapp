import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the id of the currently active period.
 * Used to scope queries to data belonging to the active period only.
 */
export function useActivePeriodId() {
  return useQuery({
    queryKey: ['active-period-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}