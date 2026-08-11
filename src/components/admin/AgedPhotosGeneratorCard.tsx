import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const BATCH = 5;

type PeriodRow = { id: string; name: string; is_active: boolean | null };

export function AgedPhotosGeneratorCard() {
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [count, setCount] = useState<{ total: number; missing: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('periods')
        .select('id, name, is_active')
        .order('name', { ascending: true });
      const rows = (data || []) as PeriodRow[];
      setPeriods(rows);
      setPeriodId((prev) => prev || rows.find((p) => p.is_active)?.id || rows[0]?.id || '');
    })();
  }, []);

  useEffect(() => {
    if (!periodId) { setCount(null); return; }
    (async () => {
      const [totalRes, missingRes] = await Promise.all([
        supabase.from('participants').select('id', { count: 'exact', head: true })
          .eq('period_id', periodId).not('image_url', 'is', null),
        supabase.from('participants').select('id', { count: 'exact', head: true })
          .eq('period_id', periodId).not('image_url', 'is', null).is('image_aged_url', null),
      ]);
      setCount({ total: totalRes.count ?? 0, missing: missingRes.count ?? 0 });
    })();
  }, [periodId, done]);

  const run = async (force = false) => {
    if (!periodId) { toast.error('Velg en periode først'); return; }
    setRunning(true);
    setDone(false);
    setProcessed(0);
    setFailed(0);
    setRemaining(null);
    try {
      let totalProcessed = 0;
      let totalFailed = 0;
      let safety = 200;
      let offset = 0;
      while (safety-- > 0) {
        const { data, error } = await supabase.functions.invoke('generate-participant-aged', {
          body: { batch_size: BATCH, force, offset: force ? offset : 0, period_id: periodId },
        });
        if (error) throw error;
        if (data?.success === false) throw new Error(data?.error || 'Ukjent feil');
        const p = data?.processed || 0;
        const f = data?.failed || 0;
        totalProcessed += p;
        totalFailed += f;
        setProcessed(totalProcessed);
        setFailed(totalFailed);
        setRemaining(data?.remaining ?? 0);
        if (force) {
          offset += BATCH;
          if (p + f < BATCH) break;
        } else {
          if (p + f === 0) break;
          if (!data?.remaining || data.remaining === 0) break;
        }
      }
      setDone(true);
      toast.success(`Ferdig! Lagde ${totalProcessed} eldre-bilder`);
    } catch (e: any) {
      toast.error(`Feil: ${e?.message || 'Ukjent'}`);
    } finally {
      setRunning(false);
    }
  };

  const total = processed + (remaining ?? 0);
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> AI: Eldre versjon av deltakerbilder
        </CardTitle>
        <CardDescription>
          Lager en AI-generert «om 40 år»-utgave av hvert deltakerbilde. Trykk på bildet inne på en
          deltaker for å flippe mellom nå og eldre. Hvert bilde koster ett AI-kall, så bruk gjerne
          «Generer manglende».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {running && (
          <div className="space-y-2">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">
              {processed} laget{remaining !== null ? `, ${remaining} igjen` : ''}
              {failed > 0 ? ` (${failed} feilet)` : ''}
            </p>
          </div>
        )}
        {done && !running && (
          <p className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {processed} eldre-bilder laget
            {failed > 0 ? ` – ${failed} feilet` : ''}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => run(false)} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generer manglende
          </Button>
          <Button variant="outline" onClick={() => run(true)} disabled={running}>
            Regenerer alle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
