import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { BulkActivityRegistration } from '@/components/passport/BulkActivityRegistration';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';

async function fetchParticipants(periodId: string) {
  const { data, error } = await supabase
    .from('participants')
    .select('*, cabins(*), participant_activities(activity, completed_at)')
    .eq('period_id', periodId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as any[];
}

export default function PassportActivity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: periodId } = useActivePeriodId();

  const { data: participants = [], isLoading, refetch } = useQuery({
    queryKey: ['participants-bulk-activity', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: () => fetchParticipants(periodId!),
    staleTime: 60_000,
  });

  const handleClose = () => navigate('/passport');

  const handleComplete = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['participant-activities-map'] });
    queryClient.invalidateQueries({ queryKey: ['participants'] });
    queryClient.invalidateQueries({ queryKey: ['styrkeprove-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dash-styrkeprove-nearly'] });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" onClick={handleClose} className="mb-2 hidden lg:inline-flex">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til passkontroll
      </Button>

      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Registrer aktivitet
        </h1>
        <p className="text-muted-foreground mt-1">
          Velg en aktivitet og registrer den på flere deltakere samtidig
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <BulkActivityRegistration
          participants={participants}
          onComplete={handleComplete}
          onClose={handleClose}
        />
      )}
    </div>
  );
}