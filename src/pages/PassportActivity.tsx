import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { BulkActivityRegistration } from '@/components/passport/BulkActivityRegistration';
import type { Tables } from '@/integrations/supabase/types';

type Cabin = Tables<'cabins'>;

async function fetchParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('*, cabins(*)')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as any[];
}

export default function PassportActivity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading, refetch } = useQuery({
    queryKey: ['participants-with-cabins'],
    queryFn: fetchParticipants,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const handleClose = () => navigate('/passport');

  const handleComplete = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['participant-activities-map'] });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" onClick={handleClose} className="mb-2">
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