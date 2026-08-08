import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeasonView } from '@/contexts/SeasonViewContext';
import type { ParticipantWithCabin } from './useParticipants';

export type SeasonParticipant = ParticipantWithCabin & { period_name?: string | null };

/** Loads participants from every period (admins/nurses only) plus their cabin. */
export async function fetchSeasonParticipants(): Promise<SeasonParticipant[]> {
  const [rowsRes, cabinsRes] = await Promise.all([
    (supabase.rpc as any)('get_season_participants'),
    supabase.from('cabins').select('*'),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  const cabinMap = new Map((cabinsRes.data || []).map((c: any) => [c.id, c]));
  return ((rowsRes.data || []) as any[]).map((r) => ({
    ...r,
    cabins: r.cabin_id ? cabinMap.get(r.cabin_id) ?? null : null,
  })) as SeasonParticipant[];
}

/** Query wrapper — only enabled while the season view is on. */
export function useSeasonParticipants() {
  const { seasonView } = useSeasonView();
  return useQuery({
    queryKey: ['season-participants'],
    enabled: seasonView,
    queryFn: fetchSeasonParticipants,
    staleTime: 5 * 60 * 1000,
  });
}
