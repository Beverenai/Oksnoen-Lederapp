import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';

/**
 * The secret word game is "live" when words have been assigned for the active period.
 * Used to hide the "Ord" entry point when the game is not running.
 */
export function useSecretWordsActive() {
  const { data: periodId } = useActivePeriodId();

  const query = useQuery({
    queryKey: ['secret-words-active', periodId],
    enabled: !!periodId,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('secret_word_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('period_id', periodId);
      return (count ?? 0) > 0;
    },
  });

  return query.data ?? false;
}
