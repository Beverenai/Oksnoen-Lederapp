import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarRange, Loader2 } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Props {
  leaderId: string;
}

/** Hvilke perioder lederen hører til. Brukes når admin bytter aktiv periode. */
export function LeaderPeriodsCard({ leaderId }: Props) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('id,name,is_active,start_date')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: assigned = [], isLoading } = useQuery({
    queryKey: ['leader-periods', leaderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('period_leader_assignments')
        .select('period_id')
        .eq('leader_id', leaderId);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => r.period_id as string);
    },
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ periodId, on }: { periodId: string; on: boolean }) => {
      if (on) {
        const { error } = await (supabase as any)
          .from('period_leader_assignments')
          .insert({ period_id: periodId, leader_id: leaderId });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await (supabase as any)
          .from('period_leader_assignments')
          .delete()
          .eq('period_id', periodId)
          .eq('leader_id', leaderId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leader-periods', leaderId] }),
    onError: () => showError('Kunne ikke lagre perioden'),
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <CalendarRange className="w-4 h-4 text-muted-foreground" />
        Perioder
        {(isLoading || toggle.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </Label>
      <p className="text-xs text-muted-foreground">
        Velg periodene lederen jobber. Når du bytter aktiv periode aktiveres disse automatisk, og
        ledere uten den perioden settes i off-season.
      </p>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        {periods.map((p: any) => {
          const checked = assigned.includes(p.id);
          return (
            <div key={p.id} className="flex items-center space-x-2">
              <Checkbox
                id={`period-${p.id}`}
                checked={checked}
                onCheckedChange={(c) => toggle.mutate({ periodId: p.id, on: c === true })}
              />
              <Label htmlFor={`period-${p.id}`} className="cursor-pointer text-sm">
                {p.name}
                {p.is_active && <span className="ml-1 text-[11px] text-primary">(aktiv)</span>}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
