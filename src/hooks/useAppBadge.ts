import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

async function applyBadge(count: number) {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Unsupported browsers simply ignore the badge.
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Badge')) {
      const mod: any = await import('@capawesome/capacitor-badge');
      if (count > 0) await mod.Badge.set({ count });
      else await mod.Badge.clear();
    }
  } catch {
    // Native badge plugin not installed — web badge already handled above.
  }
}

/**
 * Keeps the app icon badge in sync with the number of things waiting for the
 * current leader (klineliste requests, mailbox replies, murder claims).
 */
export function useAppBadge() {
  const { leader } = useAuth();

  const refresh = useCallback(async () => {
    if (!leader?.id) {
      await applyBadge(0);
      return;
    }
    const { data, error } = await supabase.rpc('get_my_unread_badge', {
      _leader_id: leader.id,
    });
    if (error) return;
    await applyBadge(Number(data) || 0);
  }, [leader?.id]);

  useEffect(() => {
    refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);

    const channel = supabase
      .channel('app-badge-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_hookups' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mailbox_messages' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'murder_kill_claims' }, () => refresh())
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return refresh;
}