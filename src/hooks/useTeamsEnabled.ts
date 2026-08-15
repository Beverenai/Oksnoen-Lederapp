import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

/**
 * Returns whether the global "teams" flag is enabled.
 * When on, team badges are shown on participant cards.
 */
export function useTeamsEnabled() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['teams-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'teams_enabled')
        .maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName('teams-enabled-global'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload: any) => {
        if (payload.new?.key === 'teams_enabled' || payload.old?.key === 'teams_enabled') {
          queryClient.invalidateQueries({ queryKey: ['teams-enabled'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query.data ?? false;
}
