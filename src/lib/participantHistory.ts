import { supabase } from '@/integrations/supabase/client';
import type { SessionsPayload } from '@/components/admin/SessionActivitiesSheet';

export function arrivalChangeIds(
  participants: { id: string; has_arrived: boolean | null }[],
  arrived: boolean,
) {
  return participants.filter(p => Boolean(p.has_arrived) !== arrived).map(p => p.id);
}

export function arrivalTime(timestamp: string) {
  return new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(timestamp)).replace(':', '.');
}

export async function saveSessionWithHistory(
  key: string,
  payload: SessionsPayload,
  periodId: string | null,
  leaderId: string,
  client = supabase,
) {
  const { error } = await client.from('app_config').upsert(
    { key, value: JSON.stringify(payload), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (error) throw new Error('Kunne ikke lagre aktivitetene.');
  const { error: historyError } = await client.from('session_log').insert({
    period_id: periodId,
    active_session: payload.active,
    sessions: payload,
    saved_by: leaderId,
  });
  if (historyError) throw new Error('Aktivitetene er lagret, men historikken kunne ikke lagres. Prøv å lagre igjen.');
}