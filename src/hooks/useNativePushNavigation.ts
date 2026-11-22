import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { addNativePushListeners, initCapacitorPush, isNativePushAvailable } from '@/lib/capacitorPush';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { supabase } from '@/integrations/supabase/client';

/**
 * Håndterer trykk på push-varsler i iPhone-appen:
 *  - vanlig trykk: åpner lenken i varselet
 *  - «Svar» (chat): sender svaret som melding i samme kanal, med tag på avsenderen
 *  - «Merk som fikset» (FIX): markerer oppgaven som fikset
 *
 * Knappene er registrert i appen (AppDelegate) med kategoriene CHAT_MESSAGE og FIX_TASK.
 * Begge åpner appen, så handlingen gjøres her med lederens vanlige innlogging.
 * Kommer handlingen før innloggingen er klar, venter den.
 */

interface PushAction {
  actionId?: string;
  inputValue?: string;
  notification?: { data?: Record<string, unknown> };
}

export function useNativePushNavigation() {
  const navigate = useNavigate();
  const { leader } = useAuth();
  const { showSuccess, showError } = useStatusPopup();
  const pending = useRef<PushAction[]>([]);
  const leaderIdRef = useRef<string | null>(null);
  const handleRef = useRef<(a: PushAction) => Promise<void>>(async () => undefined);

  handleRef.current = async (action: PushAction) => {
    const data = action.notification?.data ?? {};
    const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);
    const url = str('url');

    if (action.actionId === 'reply') {
      const body = (action.inputValue ?? '').trim();
      const replyTo = str('message_id');
      if (!body || !replyTo) {
        navigate('/chat');
        return;
      }
      if (!leaderIdRef.current) {
        pending.current.push(action);
        return;
      }
      const channel = str('channel') || 'period';
      const author = str('author_id');
      const mentions = author && author !== leaderIdRef.current ? [author] : [];
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({ leader_id: leaderIdRef.current, body, channel, mentions, reply_to_id: replyTo })
        .select('id')
        .maybeSingle();
      navigate(`/chat?channel=${encodeURIComponent(channel)}`);
      if (error) {
        showError('Svaret ble ikke sendt', error.message);
        return;
      }
      showSuccess('Svar sendt');
      if (inserted?.id) {
        supabase.functions
          .invoke('push-chat-mention', { body: { message_id: inserted.id } })
          .catch(() => undefined);
      }
      return;
    }

    if (action.actionId === 'fix_done') {
      const taskId = str('fix_task_id');
      if (!taskId) {
        navigate('/fix');
        return;
      }
      if (!leaderIdRef.current) {
        pending.current.push(action);
        return;
      }
      const { error } = await supabase.rpc('mark_fix_task_fixed', { _task_id: taskId });
      navigate('/fix');
      if (error) showError('Kunne ikke merke som fikset', error.message);
      else showSuccess('Merket som fikset');
      return;
    }

    if (url && url.startsWith('/')) navigate(url);
  };

  useEffect(() => {
    leaderIdRef.current = leader?.id ?? null;
    if (leader?.id && pending.current.length) {
      const queued = pending.current.splice(0);
      queued.forEach((a) => void handleRef.current(a));
    }
  }, [leader?.id]);

  useEffect(() => {
    // Programtilleggene lastes samtidig med appen. Vent på push-tillegget, ellers
    // går trykk på varsler (også det som åpnet appen) tapt.
    let cancelled = false;
    (async () => {
      if (!isNativePushAvailable()) await initCapacitorPush();
      if (cancelled || !isNativePushAvailable()) return;
      addNativePushListeners(
        () => {},
        (action: PushAction) => {
          void handleRef.current(action);
        },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
