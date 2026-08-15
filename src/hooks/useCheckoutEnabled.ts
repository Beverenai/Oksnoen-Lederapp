import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

/**
 * Returns whether the global "checkout" / pass-flow flag is enabled.
 * Used to gate all pass-related UI from leaders until admin turns it on.
 */
export function useCheckoutEnabled() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['checkout-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'checkout_enabled')
        .maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName('checkout-enabled-global'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload: any) => {
        if (payload.new?.key === 'checkout_enabled' || payload.old?.key === 'checkout_enabled') {
          queryClient.invalidateQueries({ queryKey: ['checkout-enabled'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query.data ?? false;
}
