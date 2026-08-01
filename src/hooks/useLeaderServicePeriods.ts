import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Periods that exist at Øksnøen. Order matters for display. */
export const PERIOD_CODES = ['1', '2', '3', '4', '4+', '5', '6', '7'] as const;
export type PeriodCode = (typeof PERIOD_CODES)[number];

export const FIRST_SERVICE_YEAR = 2013;

export function serviceYears(): number[] {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now; y >= FIRST_SERVICE_YEAR; y--) years.push(y);
  return years;
}

export interface ServicePeriodRow {
  id: string;
  leader_id: string;
  year: number;
  period_code: string;
}

export function useLeaderServicePeriods(leaderId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['leader-service-periods', leaderId];

  const query = useQuery<ServicePeriodRow[]>({
    queryKey,
    enabled: !!leaderId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_service_periods')
        .select('id, leader_id, year, period_code')
        .eq('leader_id', leaderId!)
        .order('year', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServicePeriodRow[];
    },
  });

  const toggle = useCallback(
    async (year: number, periodCode: string) => {
      if (!leaderId) return;
      const existing = (query.data ?? []).find(
        r => r.year === year && r.period_code === periodCode,
      );
      if (existing) {
        const { error } = await supabase
          .from('leader_service_periods')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leader_service_periods')
          .insert({ leader_id: leaderId, year, period_code: periodCode });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    [leaderId, query.data, queryClient],
  );

  return { ...query, toggle };
}