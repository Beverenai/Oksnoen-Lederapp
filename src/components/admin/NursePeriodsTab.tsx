import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Calendar, Loader2 } from 'lucide-react';

interface Period {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export function NursePeriodsTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('periods')
      .select('id,name,slug,is_active')
      .order('start_date', { ascending: true });
    if (error) showError('Kunne ikke laste perioder');
    else setPeriods((data || []) as Period[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setActive = async (p: Period) => {
    if (p.is_active) return;
    setSwitching(p.id);
    const { error: e1 } = await supabase.from('periods').update({ is_active: false }).neq('id', p.id);
    const { error: e2 } = await supabase.from('periods').update({ is_active: true }).eq('id', p.id);
    if (e1 || e2) {
      showError('Kunne ikke bytte periode');
    } else {
      showSuccess(`Aktiv periode: ${p.name}`);
      setPeriods((prev) => prev.map((x) => ({ ...x, is_active: x.id === p.id })));
    }
    setSwitching(null);
  };

  const active = periods.find((p) => p.is_active);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Aktiv periode
          </CardTitle>
          <CardDescription>
            All data (deltakere, nurse-rapport, gjenglemt, helse-notater) lagres på den aktive perioden.
            Når du bytter periode ser lederne kun data fra den nye perioden — gammelt er trygt lagret.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Laster...
            </div>
          ) : (
            <>
              <div className="mb-3 text-sm">
                Aktiv: <Badge className="ml-1">{active?.name || 'Ingen'}</Badge>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {periods.map((p) => {
                  const label = p.name.replace(/^Periode\s*/i, '');
                  return (
                    <Button
                      key={p.id}
                      variant={p.is_active ? 'default' : 'outline'}
                      onClick={() => setActive(p)}
                      disabled={switching !== null}
                      className="h-16 text-lg font-semibold"
                    >
                      {switching === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
