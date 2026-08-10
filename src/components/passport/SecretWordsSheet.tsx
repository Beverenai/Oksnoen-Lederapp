import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Search, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

interface Props { open: boolean; onOpenChange: (v: boolean) => void }
interface Assignment { id: string; participant_id: string; word: string; pair_id: string; slot: number }
interface P { id: string; name: string; team_id: string | null }

export function SecretWordsSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const { data: periodId } = useActivePeriodId();
  const { showSuccess, showError } = useStatusPopup();

  const [qA, setQA] = useState('');
  const [qB, setQB] = useState('');
  const [selA, setSelA] = useState<P | null>(null);
  const [selB, setSelB] = useState<P | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; message: string; alreadyMatched?: boolean }>(null);

  const { data: participants } = useQuery({
    queryKey: ['secret-word-sheet-participants', periodId],
    enabled: open && !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, team_id')
        .eq('period_id', periodId!)
        .order('name');
      if (error) throw error;
      return (data || []) as P[];
    },
    staleTime: 60_000,
  });

  const reset = () => {
    setQA(''); setQB(''); setSelA(null); setSelB(null); setResult(null);
  };

  const results = (q: string, exclude?: string | null): P[] => {
    const s = q.trim().toLowerCase();
    if (!s || !participants) return [];
    return participants
      .filter((p) => p.id !== exclude && p.name.toLowerCase().includes(s))
      .slice(0, 6);
  };

  const check = async () => {
    if (!selA || !selB || !periodId) return;
    setChecking(true);
    setResult(null);
    try {
      const { data: rows, error } = await (supabase as any)
        .from('secret_word_assignments')
        .select('participant_id, pair_id, slot')
        .eq('period_id', periodId)
        .in('participant_id', [selA.id, selB.id]);
      if (error) throw error;
      const a = (rows || []).find((r: any) => r.participant_id === selA.id) as Assignment | undefined;
      const b = (rows || []).find((r: any) => r.participant_id === selB.id) as Assignment | undefined;
      if (!a || !b) {
        hapticError();
        setResult({ ok: false, message: 'En eller begge deltakere har ikke fått et ord.' });
        return;
      }
      if (a.pair_id !== b.pair_id) {
        hapticError();
        setResult({ ok: false, message: 'Ikke match — prøv igjen!' });
        return;
      }
      // Match! Check if already recorded
      const { data: existing } = await (supabase as any)
        .from('secret_word_matches')
        .select('id, matched_at')
        .eq('period_id', periodId)
        .eq('pair_id', a.pair_id)
        .maybeSingle();
      if (existing) {
        setResult({ ok: true, alreadyMatched: true, message: 'Dette paret er allerede funnet.' });
        return;
      }
      const { error: insErr } = await (supabase as any).from('secret_word_matches').insert({
        period_id: periodId,
        pair_id: a.pair_id,
        participant_a_id: selA.id,
        participant_b_id: selB.id,
        matched_by: leader?.id ?? null,
      });
      if (insErr) throw insErr;
      hapticSuccess();
      setResult({ ok: true, message: 'Match! Poeng registrert til laget.' });
      qc.invalidateQueries({ queryKey: ['secret-word-matches'] });
      qc.invalidateQueries({ queryKey: ['team-points'] });
    } catch (e: any) {
      showError('Feil', e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent side="bottom" className="max-h-[95dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> Hemmelige Ord</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Velg de to deltakerne som tror de har makkerord. Trykk "Sjekk match" for å bekrefte.
          </p>

          {/* Deltaker A */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deltaker 1</label>
            {selA ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                <span className="font-medium">{selA.name}</span>
                <Button size="sm" variant="ghost" onClick={() => { setSelA(null); setResult(null); }}>Endre</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Søk deltaker 1..." value={qA} onChange={(e) => setQA(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results(qA, selB?.id).map((p) => (
                    <button key={p.id} className="w-full text-left p-2 rounded-lg hover:bg-muted text-sm" onClick={() => { setSelA(p); setQA(''); setResult(null); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Deltaker B */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deltaker 2</label>
            {selB ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                <span className="font-medium">{selB.name}</span>
                <Button size="sm" variant="ghost" onClick={() => { setSelB(null); setResult(null); }}>Endre</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Søk deltaker 2..." value={qB} onChange={(e) => setQB(e.target.value)} />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results(qB, selA?.id).map((p) => (
                    <button key={p.id} className="w-full text-left p-2 rounded-lg hover:bg-muted text-sm" onClick={() => { setSelB(p); setQB(''); setResult(null); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Button className="w-full h-12 text-base" onClick={check} disabled={!selA || !selB || checking}>
            {checking ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
            Sjekk match
          </Button>

          {result && (
            <div className={`p-4 rounded-xl border-2 ${result.ok ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400' : 'bg-red-50 dark:bg-red-950/30 border-red-400'}`}>
              <div className="flex items-start gap-2">
                {result.ok ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
                <div className="flex-1">
                  <div className={`font-semibold ${result.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                    {result.ok ? (result.alreadyMatched ? 'Allerede funnet' : 'Riktig match!') : 'Feil match'}
                  </div>
                  <div className="text-sm mt-0.5 text-muted-foreground">{result.message}</div>
                  {result.ok && !result.alreadyMatched && (
                    <Badge variant="default" className="mt-2">+1 poeng til lagene</Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={reset}>Sjekk et nytt par</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}