import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Save, FileSpreadsheet, Check, AlertTriangle, Eye, ClipboardPaste, Eraser } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PasteLeaderContentSheet } from '@/components/admin/PasteLeaderContentSheet';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;

interface SyncResult {
  preview?: boolean;
  matchedCount: number;
  saved?: number;
  failed?: number;
  unmatched: string[];
  unknownHeaders: string[];
  range?: string;
  headers?: string[];
  sample?: { name: string; fields: Record<string, string> }[];
  lastSyncAt?: string;
}

export function GoogleSheetSyncTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [range, setRange] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [isPasteSheetOpen, setIsPasteSheetOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const loadLeaders = async () => {
    const { data } = await supabase.from('leaders').select('*').order('created_at');
    setLeaders(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'google_sheet_sync').maybeSingle();
      if (data?.value) {
        try {
          const cfg = JSON.parse(data.value);
          if (cfg.spreadsheetId) setSpreadsheetId(cfg.spreadsheetId);
          if (cfg.range) setRange(cfg.range);
          if (cfg.lastSyncAt) setLastSyncAt(cfg.lastSyncAt);
        } catch { /* ignore */ }
      }
      await loadLeaders();
      setIsLoading(false);
    })();
  }, []);

  const handleClearAllDailyFields = async () => {
    setIsClearingAll(true);
    try {
      const { error, count } = await supabase
        .from('leader_content')
        .update({
          current_activity: null,
          extra_activity: null,
          personal_notes: null,
          obs_message: null,
          extra_2: null,
          extra_3: null,
          extra_4: null,
          extra_5: null,
          updated_at: new Date().toISOString(),
        }, { count: 'exact' })
        .not('leader_id', 'is', null);
      if (error) throw error;
      hapticSuccess();
      showSuccess(`Tømte daglige felt for ${count ?? 'alle'} ledere`);
      setIsClearAllOpen(false);
    } catch (err) {
      console.error('Clear all error:', err);
      hapticError();
      showError('Kunne ikke tømme felt');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const value = JSON.stringify({ spreadsheetId: spreadsheetId.trim(), range: range.trim(), lastSyncAt });
      const { error } = await supabase.from('app_config').upsert(
        { key: 'google_sheet_sync', value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      showSuccess('Lagret');
    } catch (e: any) {
      showError(e?.message || 'Kunne ikke lagre');
    } finally {
      setIsSaving(false);
    }
  };

  const runSync = async (dryRun: boolean) => {
    if (!spreadsheetId.trim()) { showError('Lim inn Spreadsheet-URL eller ID først'); return; }
    if (dryRun) setIsPreviewing(true); else setIsSyncing(true);
    setResult(null);
    try {
      const legacyDefaultRange = /^'?Sheet1'?!A1:Z{1,2}1000$/i.test(range.trim());
      const { data, error } = await supabase.functions.invoke('sync-leaders-from-sheet', {
        body: { spreadsheetId: spreadsheetId.trim(), range: legacyDefaultRange ? '' : range.trim(), dryRun },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as SyncResult);
      if (!dryRun) {
        const r = data as SyncResult;
        if (r.lastSyncAt) setLastSyncAt(r.lastSyncAt);
        if (r.range) setRange(r.range);
        if ((r.failed || 0) > 0) showError(`Lagret ${r.saved} (${r.failed} feilet)`);
        else showSuccess(`Synket ${r.saved} ledere${r.range ? ` fra ${r.range.split('!')[0].replace(/^'|'$/g, '')}` : ''}`);
      }
    } catch (e: any) {
      showError(e?.message || 'Synk feilet');
    } finally {
      setIsPreviewing(false);
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Google Sheet sync
          </CardTitle>
          <CardDescription>
            Synkroniser ledere fra et Google Sheet. Første rad må ha headere som <strong>Tlf, Navn, Aktivitet, Notater, Til deg, OBS!, Ekstra #1–5, Hytte, Ansvar, Ministerpost, Team</strong>. Matching skjer på telefon, deretter navn. Tomme celler ignoreres.
            <br />
            <span className="text-xs">Husk å dele arket med Google-kontoen som er koblet til (Innstillinger → Connectors → Google Sheets).</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-url">Spreadsheet URL eller ID</Label>
            <Input
              id="sheet-url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sheet-range">Range</Label>
            <Input
              id="sheet-range"
              placeholder="(tom = første fane automatisk) eller f.eks. Ledere!A1:Z1000"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lagre kobling
            </Button>
            <Button variant="outline" onClick={() => runSync(true)} disabled={isPreviewing || isSyncing}>
              {isPreviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Forhåndsvis
            </Button>
            <Button onClick={() => runSync(false)} disabled={isPreviewing || isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Synk nå
            </Button>
            {lastSyncAt && (
              <span className="text-xs text-muted-foreground ml-auto">
                Sist synket: {new Date(lastSyncAt).toLocaleString('nb-NO')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{result.preview ? 'Forhåndsvisning' : 'Resultat'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-green-600">
                <Check className="w-3 h-3 mr-1" />
                {result.preview ? `${result.matchedCount} vil oppdateres` : `${result.saved ?? 0} oppdatert`}
              </Badge>
              {(result.failed || 0) > 0 && (
                <Badge variant="destructive">{result.failed} feilet</Badge>
              )}
              {result.unmatched.length > 0 && (
                <Badge variant="destructive">{result.unmatched.length} ikke matchet</Badge>
              )}
              {result.unknownHeaders.length > 0 && (
                <Badge variant="secondary">{result.unknownHeaders.length} ukjente kolonner</Badge>
              )}
            </div>

            {result.unknownHeaders.length > 0 && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 text-sm p-3">
                Ukjente kolonner ignoreres: {result.unknownHeaders.join(', ')}
              </div>
            )}

            {result.sample && result.sample.length > 0 && (
              <div className="rounded-md border">
                <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/40">
                  Eksempel ({result.sample.length} av {result.matchedCount})
                </div>
                <div className="divide-y max-h-[40vh] overflow-y-auto">
                  {result.sample.map((s, i) => (
                    <div key={i} className="px-3 py-2 text-sm">
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(s.fields).map(([k, v]) => (
                          <div key={k}><span className="font-medium text-foreground">{k}:</span> {v}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.unmatched.length > 0 && (
              <div className="rounded-md border border-destructive/40">
                <div className="px-3 py-2 text-xs font-semibold border-b bg-destructive/10 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Ikke matchet
                </div>
                <ul className="px-3 py-2 text-sm divide-y max-h-[30vh] overflow-y-auto">
                  {result.unmatched.map((n, i) => <li key={i} className="py-1">{n}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Manuelle verktøy
          </CardTitle>
          <CardDescription>
            Alternative måter å oppdatere lederdata på.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsPasteSheetOpen(true)}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Lim inn rader
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsClearAllOpen(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <Eraser className="w-4 h-4 mr-2" />
            Tøm daglige felt for alle ledere
          </Button>
        </CardContent>
      </Card>

      <PasteLeaderContentSheet
        open={isPasteSheetOpen}
        onOpenChange={setIsPasteSheetOpen}
        leaders={leaders}
        onSaved={loadLeaders}
      />

      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tøm daglige felt for ALLE ledere?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette tømmer nåværende aktivitet, ekstra aktivitet, notat til lederen, OBS-melding og ekstra info 2–5 for samtlige ledere. Team, hytte, ministerpost og overnatting (ekstra 1) beholdes. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingAll}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClearAllDailyFields(); }}
              disabled={isClearingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser className="w-4 h-4 mr-2" />}
              Ja, tøm alle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}