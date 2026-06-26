import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Trash2, Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface NursePeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export function NursePeriodsTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [periods, setPeriods] = useState<NursePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nurse_periods')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) showError('Kunne ikke laste perioder');
    else setPeriods((data || []) as NursePeriod[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPeriod = async () => {
    if (!name || !startDate || !endDate) {
      showError('Fyll inn navn, start- og slutt-dato');
      return;
    }
    const { error } = await supabase
      .from('nurse_periods')
      .insert({ name, start_date: startDate, end_date: endDate });
    if (error) { showError('Kunne ikke opprette periode'); return; }
    setName(''); setStartDate(''); setEndDate('');
    showSuccess('Periode opprettet');
    load();
  };

  const toggleActive = async (p: NursePeriod) => {
    if (!p.is_active) {
      await supabase.from('nurse_periods').update({ is_active: false }).neq('id', p.id);
    }
    const { error } = await supabase
      .from('nurse_periods')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) showError('Kunne ikke oppdatere');
    else load();
  };

  const deletePeriod = async (id: string) => {
    if (!confirm('Slett denne perioden?')) return;
    const { error } = await supabase.from('nurse_periods').delete().eq('id', id);
    if (error) showError('Kunne ikke slette');
    else { showSuccess('Slettet'); load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Ny periode</CardTitle>
          <CardDescription>Opprett en nurse-periode (f.eks. "Periode 1") som rapporter knyttes til.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Navn</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Periode 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fra</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Til</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={addPeriod}><Plus className="w-4 h-4 mr-2" /> Opprett</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Perioder</CardTitle>
          <CardDescription>Slå på "Aktiv" for perioden som rapporter skal lagres i. Kun én kan være aktiv om gangen.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Laster...</p>
          ) : periods.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen perioder enda</p>
          ) : (
            <div className="space-y-2">
              {periods.map((p) => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.is_active && <Badge>Aktiv</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.start_date), 'd. MMM', { locale: nb })} – {format(new Date(p.end_date), 'd. MMM yyyy', { locale: nb })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Aktiv</Label>
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePeriod(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
