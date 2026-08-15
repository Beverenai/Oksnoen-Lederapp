import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';
import { useParticipantTeams, type ParticipantTeam } from './useParticipantTeams';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

interface KitchenDutyRow {
  id: string;
  period_id: string;
  rotation_start_date: string | null;
  manual_override_date: string | null;
  manual_override_slot_a: number | null;
  manual_override_slot_b: number | null;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

/** 5 par-slots: (1,2),(3,4),(5,6),(7,8),(9,10). Cycle-index bestemmer paret. */
export function pairForCycleIndex(cycleIndex: number): [number, number] {
  const idx = ((cycleIndex % 5) + 5) % 5;
  return [idx * 2 + 1, idx * 2 + 2];
}

/** Compute today's kitchen duty slot pair from a duty config row. */
export function computeTodayPair(row: KitchenDutyRow | null, todayStr: string): [number, number] | null {
  if (!row) return null;
  if (row.manual_override_date === todayStr && row.manual_override_slot_a && row.manual_override_slot_b) {
    return [row.manual_override_slot_a, row.manual_override_slot_b];
  }
  if (!row.rotation_start_date) return null;
  const diff = daysBetween(row.rotation_start_date, todayStr);
  return pairForCycleIndex(diff);
}

export function useKitchenDutyConfig() {
  const qc = useQueryClient();
  const { data: periodId } = useActivePeriodId();

  useEffect(() => {
    if (!periodId) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName('team-kitchen-duty'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_kitchen_duty' }, () => {
        qc.invalidateQueries({ queryKey: ['team-kitchen-duty', periodId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [periodId, qc]);

  return useQuery({
    queryKey: ['team-kitchen-duty', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async (): Promise<KitchenDutyRow | null> => {
      const { data, error } = await (supabase as any)
        .from('team_kitchen_duty')
        .select('*')
        .eq('period_id', periodId!)
        .maybeSingle();
      if (error) throw error;
      return (data as KitchenDutyRow | null) ?? null;
    },
    staleTime: 60_000,
  });
}

/** Returns today's two duty teams (or null when not configured). */
export function useKitchenDutyToday(): { teamA: ParticipantTeam | null; teamB: ParticipantTeam | null; slotA: number | null; slotB: number | null } {
  const { data: config } = useKitchenDutyConfig();
  const { data: teams } = useParticipantTeams();
  const pair = computeTodayPair(config ?? null, todayIso());
  if (!pair || !teams) return { teamA: null, teamB: null, slotA: null, slotB: null };
  const [a, b] = pair;
  const teamA = teams.find((t) => t.slot === a) ?? null;
  const teamB = teams.find((t) => t.slot === b) ?? null;
  return { teamA, teamB, slotA: a, slotB: b };
}

export { todayIso };
