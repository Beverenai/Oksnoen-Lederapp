import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LeaderHomeMode = 'active' | 'inactive';

/**
 * Reads app_config.leader_home_mode. Missing/other value defaults to 'active'.
 * Subscribes to realtime changes so admins can flip mode without re-login.
 */
export function useLeaderHomeMode(): { mode: LeaderHomeMode; isLoading: boolean } {
  const [mode, setMode] = useState<LeaderHomeMode>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'leader_home_mode')
        .maybeSingle();
      if (cancelled) return;
      setMode(data?.value === 'inactive' ? 'inactive' : 'active');
      setIsLoading(false);
    };
    load();

    const channel = supabase
      .channel('leader-home-mode-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.leader_home_mode' },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { mode, isLoading };
}

export async function setLeaderHomeMode(mode: LeaderHomeMode): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'leader_home_mode', value: mode }, { onConflict: 'key' });
  if (error) throw error;
}