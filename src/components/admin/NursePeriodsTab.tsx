import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Calendar, Loader2, Power } from 'lucide-react';
import { useAppMode, setAppMode } from '@/hooks/useAppMode';
import { useAuth } from '@/contexts/AuthContext';
import { LeaderHistoryImportCard } from '@/components/admin/LeaderHistoryImportCard';

interface Period {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export function NursePeriodsTab() {
  const { showSuccess, showError } = useStatusPopup();
  const { isSuperAdmin } = useAuth();
  const { mode: appMode } = useAppMode();
  const [changingMode, setChangingMode] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [savingLeaders, setSavingLeaders] = useState(false);

  const saveLeadersNow = async () => {
    setSavingLeaders(true);
    const { data, error } = await (supabase as any).rpc('snapshot_period_leaders', { _period_id: null });
    if (error) showError('Kunne ikke lagre ledere');
    else showSuccess(`${data ?? 0} ledere lagret for perioden`);
    setSavingLeaders(false);
  };

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
    // Freeze which leaders (cabins, teams, roles) belonged to the period we are leaving —
    // leader/cabin links are not period-scoped, so without this the history is lost.
    try {
      await (supabase as any).rpc('snapshot_period_leaders', { _period_id: null });
    } catch (e) {
      console.error('Kunne ikke lagre ledersnapshot', e);
    }
    const { error: e1 } = await supabase.from('periods').update({ is_active: false }).neq('id', p.id);
    const { error: e2 } = await supabase.from('periods').update({ is_active: true }).eq('id', p.id);
    if (e1 || e2) {
      showError('Kunne ikke bytte periode');
    } else {
      // Reset feature toggles so the new period starts with everything off.
      // Admins re-enable Utsjekk / Overnatting / Lag / Gensere / Roulette as needed.
      const resetKeys = [
        'checkout_enabled',
        'overnatting_enabled',
        'teams_enabled',
        'sweaters_enabled',
        'roulette_enabled',
        'hookups_enabled',
      ];
      await supabase
        .from('app_config')
        .upsert(
          resetKeys.map((key) => ({ key, value: 'false' })),
          { onConflict: 'key' },
        );
      showSuccess(`Aktiv periode: ${p.name}`);
      setPeriods((prev) => prev.map((x) => ({ ...x, is_active: x.id === p.id })));
    }
    setSwitching(null);
  };

  const active = periods.find((p) => p.is_active);

  const toggleAppMode = async () => {
    const next = appMode === 'inactive' ? 'active' : 'inactive';
    const confirmMsg = next === 'inactive'
      ? 'Sette appen til INAKTIV? Alle ledere blir aktivert og ser kun Hjem + Lederhuset. Superadmin beholder full tilgang.'
      : 'Skru på AKTIV-modus igjen? Alle funksjoner blir tilgjengelig for alle.';
    if (!confirm(confirmMsg)) return;
    setChangingMode(true);
    try {
      await setAppMode(next);
      if (next === 'inactive') {
        // Activate every leader so off-season broadcasts + login work for all.
        const { data, error } = await supabase.functions.invoke('activate-all-leaders');
        if (error) {
          console.error(error);
          showError('Modus satt, men klarte ikke aktivere alle ledere');
        } else {
          const n = (data as { activated?: number } | null)?.activated ?? 0;
          showSuccess(`Appen er nå inaktiv. ${n} ledere ble aktivert.`);
        }
      } else {
        showSuccess('Appen er nå aktiv');
      }
    } catch (e) {
      console.error(e);
      showError('Kunne ikke endre app-modus');
    } finally {
      setChangingMode(false);
    }
  };

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <Card className={`p-4 border-2 ${appMode === 'inactive' ? 'border-destructive bg-destructive/5' : 'border-primary/20'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg ${appMode === 'inactive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
                <Power className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">
                  App-modus: {appMode === 'inactive' ? 'Inaktiv' : 'Aktiv'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {appMode === 'inactive'
                    ? 'Alle ledere ser kun Lederhuset-chatten.'
                    : 'Alle funksjoner er tilgjengelig.'}
                </p>
              </div>
            </div>
            <Button
              variant={appMode === 'inactive' ? 'default' : 'destructive'}
              size="sm"
              disabled={changingMode}
              onClick={toggleAppMode}
            >
              {appMode === 'inactive' ? 'Aktiver app' : 'Sett inaktiv'}
            </Button>
          </div>
        </Card>
      )}

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
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                disabled={savingLeaders || !active}
                onClick={saveLeadersNow}
              >
                {savingLeaders ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lagre ledere for aktiv periode'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <LeaderHistoryImportCard />
    </div>
  );
}
