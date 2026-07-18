import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function ThumbnailsGeneratorCard() {
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);

  const run = async (force = false) => {
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
        const { data, error } = await supabase.functions.invoke('generate-participant-thumbs', {
          body: { batch_size: 25, force, offset: force ? offset : 0 },
        });
        if (error) throw error;
        const p = data?.processed || 0;
        const f = data?.failed || 0;
        totalProcessed += p;
        totalFailed += f;
        setProcessed(totalProcessed);
        setFailed(totalFailed);
        setRemaining(data?.remaining ?? 0);
        if (!force && (!data?.remaining || data.remaining === 0)) break;
        if (force) {
          offset += 25;
          if (p + f < 25) break; // last page
        }
      }
      setDone(true);
      toast.success(`Ferdig! Genererte ${totalProcessed} thumbnails`);
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
          <ImageIcon className="w-5 h-5" /> Deltakerbilder – thumbnails
        </CardTitle>
        <CardDescription>
          Genererer små versjoner (160px) av deltakerbildene, slik at lister på mobil laster raskt.
          Fullt bilde vises fortsatt når man trykker inn på en deltaker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {running && (
          <div className="space-y-2">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">
              {processed} generert{remaining !== null ? `, ${remaining} igjen` : ''}
              {failed > 0 ? ` (${failed} feilet)` : ''}
            </p>
          </div>
        )}
        {done && !running && (
          <p className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {processed} thumbnails generert
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => run(false)} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
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