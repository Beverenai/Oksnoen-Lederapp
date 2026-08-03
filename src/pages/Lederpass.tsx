import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LederPass } from '@/components/passport/LederPass';

export default function LederpassPage() {
  const { effectiveLeader } = useAuth();
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('periods')
      .select('name')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPeriodLabel(data?.name ?? null);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 h-[calc(100dvh-8rem)]">
      <LederPass leader={effectiveLeader} fill periodLabel={periodLabel} />
    </div>
  );
}