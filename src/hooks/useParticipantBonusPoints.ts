import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useAuth } from '@/contexts/AuthContext';

export interface BonusPointRow {
  id: string;
  participant_id: string;
  period_id: string;
  team_id: string | null;
  activity_key: string;
  activity_label: string;
  variant: 'base' | 'extra';
  points: number;
  awarded_by: string | null;
  created_at: string;
}

export function useParticipantBonusPoints(participantId: string | null | undefined) {
  const qc = useQueryClient();
  const { data: periodId } = useActivePeriodId();
  const { leader } = useAuth();

  const query = useQuery({
    queryKey: ['participant-bonus-points', participantId, periodId ?? 'none'],
    enabled: !!participantId && !!periodId,
    queryFn: async (): Promise<BonusPointRow[]> => {
      const { data, error } = await (supabase as any)
        .from('participant_bonus_points')
        .select('*')
        .eq('participant_id', participantId!)
        .eq('period_id', periodId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BonusPointRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['participant-bonus-points', participantId] });
    qc.invalidateQueries({ queryKey: ['team-points'] });
  };

  const addBonus = useMutation({
    mutationFn: async (input: {
      activityKey: string;
      activityLabel: string;
      variant: 'base' | 'extra';
      points: number;
      teamId: string | null;
    }) => {
      if (!participantId || !periodId) throw new Error('Mangler periode/deltaker');
      const { error } = await (supabase as any)
        .from('participant_bonus_points')
        .insert({
          participant_id: participantId,
          period_id: periodId,
          team_id: input.teamId,
          activity_key: input.activityKey,
          activity_label: input.activityLabel,
          variant: input.variant,
          points: input.points,
          awarded_by: leader?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeBonus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('participant_bonus_points')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, addBonus, removeBonus };
}