import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppMode = 'active' | 'inactive';

let channelSeq = 0;

/**
 * Global app mode. When set to 'inactive', all features are hidden for
 * non-superadmin users; only the chat page remains available.
 * Backed by app_config where key='app_mode'.
 */
export function useAppMode(): { mode: AppMode; isLoading: boolean } {
  const [mode, setMode] = useState<AppMode>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const channelName = `app-mode-changes-${++channelSeq}-${Math.random().toString(36).slice(2, 8)}`;

    const load = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'app_mode')
        .maybeSingle();
      if (cancelled) return;
      setMode((data?.value as AppMode) === 'inactive' ? 'inactive' : 'active');
      setIsLoading(false);
    };
    load();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.app_mode' },
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

export async function setAppMode(mode: AppMode): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'app_mode', value: mode }, { onConflict: 'key' });
  if (error) throw error;
}