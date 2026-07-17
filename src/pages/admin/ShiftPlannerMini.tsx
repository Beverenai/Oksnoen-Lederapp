import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, Sparkles, Loader2, Users, AlertTriangle, Shield, CalendarDays,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;

interface Warning {
  leader_id: string | null;
  leader_name: string | null;
  day_index: number | null;
  rule: string;
  detail: string;
}

export default function ShiftPlannerMini() {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useStatusPopup();

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [periodNumber, setPeriodNumber] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodLength, setPeriodLength] = useState(7);
  const [includeArrival, setIncludeArrival] = useState(true);
  const [includeDeparture, setIncludeDeparture] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    schedule_id: string;
    assignments_count: number;
    days: number;
    understaffed: Warning[];
    validation: { warnings: Warning[] };
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('leaders')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        const rows = (data || []).filter((l) => l.phone !== '12345678');
        setLeaders(rows);
        setSelected(new Set(rows.map((r) => r.id)));
      } catch {
        showError('Kunne ikke laste ledere');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, showError]);

  const filteredLeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaders;
    return leaders.filter((l) => (l.name || '').toLowerCase().includes(q));
  }, [leaders, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(leaders.map((l) => l.id)));
  const clearAll = () => setSelected(new Set());

  const generate = async () => {
    if (selected.size === 0) {
      showError('Velg minst én leder');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-shift-schedule-mini', {
        body: {
          period_number: periodNumber,
          year,
          period_length: periodLength,
          leader_ids: Array.from(selected),
          include_arrival: includeArrival,
          include_departure: includeDeparture,
          force_regenerate: true,
        },
      });
      let errMsg = (error as any)?.message || (data as any)?.error || '';
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try { const b = await ctx.clone().json(); errMsg = b?.error || errMsg; } catch {}
      }
      if (error) throw new Error(errMsg || (error as Error).message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as any);
      showSuccess(`Generert: ${(data as any).assignments_count} tildelinger`);
    } catch (e) {
      console.error(e);
      showError((e as Error).message || 'Kunne ikke generere');
    } finally {
      setGenerating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Kun admin
        </CardContent></Card>
      </div>
    );
  }

  const validationWarnings = result?.validation?.warnings || [];
  const understaffed = result?.understaffed || [];

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-heading font-bold">Vaktplan Mini</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">
              Enkel generator for få ledere. Samme regler: 8t/dag, F-team ikke etter 21, 11t hvile.
            </p>
          </div>
        </div>
        <Link to="/admin/shifts">
          <Button variant="outline" size="sm">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Full planner</span>
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Parametere
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Periode</Label>
              <Input type="number" min={1} max={20} value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label>År</Label>
              <Input type="number" value={year}
                onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            </div>
            <div>
              <Label>Antall dager</Label>
              <Input type="number" min={1} max={14} value={periodLength}
                onChange={(e) => setPeriodLength(Number(e.target.value) || 7)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={includeArrival} onCheckedChange={setIncludeArrival} id="arr" />
              <Label htmlFor="arr" className="cursor-pointer">Ankomstdag (dag 0)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={includeDeparture} onCheckedChange={setIncludeDeparture} id="dep" />
              <Label htmlFor="dep" className="cursor-pointer">Avreisedag (siste dag)</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Ledere ({selected.size}/{leaders.length})
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAll}>Alle</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Ingen</Button>
            </div>
          </div>
          <CardDescription>Kun valgte ledere brukes i genereringen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Søk ledere..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filteredLeaders.map((l) => (
                <label key={l.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <span className="text-sm truncate">{l.name}</span>
                </label>
              ))}
              {filteredLeaders.length === 0 && (
                <div className="text-sm text-muted-foreground py-2">Ingen treff</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10">
        <Button
          onClick={generate}
          disabled={generating || selected.size === 0}
          className="w-full h-12 text-base gap-2"
          size="lg"
        >
          {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          Generer vaktplan
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resultat</CardTitle>
            <CardDescription>
              {result.assignments_count} tildelinger over {result.days} dager.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/shifts">
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-4 w-4 mr-1" /> Åpne i full planner (rediger/eksporter)
                </Button>
              </Link>
            </div>

            {understaffed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Underbemannet ({understaffed.length})</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {understaffed.map((w, i) => (
                    <li key={i} className="text-muted-foreground">
                      Dag {w.day_index}: {w.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validationWarnings.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Regelbrudd ({validationWarnings.length})</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {validationWarnings.map((w, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{w.leader_name}</span>
                      {' — '}
                      {w.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {understaffed.length === 0 && validationWarnings.length === 0 && (
              <p className="text-sm text-emerald-600">Ingen regelbrudd eller underbemanning ✓</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}