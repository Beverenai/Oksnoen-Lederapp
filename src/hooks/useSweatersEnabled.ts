import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

/**
 * Whether the "Gensere" (sweater pickup) module is enabled globally.
 * Realtime-synced via app_config so leaders see it on/off instantly.
 */
export function useSweatersEnabled() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sweaters-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'sweaters_enabled')
        .maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName('sweaters-enabled-global'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload: any) => {
        if (payload.new?.key === 'sweaters_enabled' || payload.old?.key === 'sweaters_enabled') {
          queryClient.invalidateQueries({ queryKey: ['sweaters-enabled'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query.data ?? false;
}
