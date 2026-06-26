import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings2, Calendar, Lock } from 'lucide-react';
import { DyngaBoard } from '@/components/admin/dynga/DyngaBoard';
import { AddParticipantsSheet } from '@/components/admin/dynga/AddParticipantsSheet';
import { ManageColumnsSheet } from '@/components/admin/dynga/ManageColumnsSheet';
import { useDyngaRealtime } from '@/hooks/useDynga';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function Dynga() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  useDyngaRealtime();

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('id,name,slug,is_active,start_date')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const activePeriod = useMemo(() => periods.find((p: any) => p.is_active) || null, [periods]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedPeriodId && activePeriod) setSelectedPeriodId(activePeriod.id);
  }, [activePeriod, selectedPeriodId]);

  const isViewingActive = !!activePeriod && selectedPeriodId === activePeriod.id;
  const readOnly = !isViewingActive;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Du har ikke tilgang til Dynga.
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in h-[calc(100dvh-140px)] gap-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate flex items-center gap-2">
              Dynga
              {readOnly && (
                <Badge variant="secondary" className="text-[10px]">
                  <Lock className="h-3 w-3 mr-1" /> Arkiv
                </Badge>
              )}
            </h1>
            <p className="hidden sm:block text-sm text-muted-foreground">
              {readOnly ? 'Ser på tidligere periode (skrivebeskyttet)' : 'Oversikt over deltageroppførsel'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Select value={selectedPeriodId ?? ''} onValueChange={(v) => setSelectedPeriodId(v)}>
            <SelectTrigger className="h-9 w-[130px] sm:w-[170px]">
              <Calendar className="h-4 w-4 mr-1.5 shrink-0" />
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.is_active ? ' (aktiv)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!readOnly && (
            <>
              <Button variant="default" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Legg til deltager</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Kolonner</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DyngaBoard periodId={selectedPeriodId} readOnly={readOnly} />
      </div>

      <AddParticipantsSheet open={addOpen} onOpenChange={setAddOpen} periodId={selectedPeriodId} />
      <ManageColumnsSheet open={manageOpen} onOpenChange={setManageOpen} periodId={selectedPeriodId} />
    </div>
  );
}
