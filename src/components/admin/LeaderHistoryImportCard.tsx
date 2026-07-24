import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, Trash2 } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface PeriodRow { id: string; name: string; }
interface LeaderRow { id: string; name: string; }

interface ImportSummary {
  inserted: number;
  duplicate: number;
  unknownLeaders: string[];
  unknownPeriods: string[];
  total: number;
}

const NAME_KEYS = ['name', 'navn', 'fullt navn', 'leder', 'ledernavn'];
const PERIOD_KEYS = ['period', 'periode', 'periode navn', 'period name'];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { cur.push(cell); cell = ''; }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows.filter(r => r.some(c => c.trim().length > 0));
}

function detectDelimiter(headerLine: string): void {
  // parseCsv already handles comma/semicolon/tab in one pass; kept as marker.
}

export function LeaderHistoryImportCard() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [targetPeriodId, setTargetPeriodId] = useState<string>('csv');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCounts = async () => {
    const { data: periodsData } = await supabase.from('periods').select('id,name').order('start_date');
    const { data: leadersData } = await supabase.from('leaders').select('id,name').order('name');
    const { data: hist } = await supabase.from('leader_period_history').select('period_id');
    const map: Record<string, number> = {};
    (hist || []).forEach((r: any) => { map[r.period_id] = (map[r.period_id] || 0) + 1; });
    setPeriods((periodsData || []) as PeriodRow[]);
    setLeaders((leadersData || []) as LeaderRow[]);
    setCounts(map);
  };

  useEffect(() => { loadCounts(); }, []);

  const leaderByName = useMemo(() => {
    const m = new Map<string, string>();
    leaders.forEach(l => m.set(normalize(l.name), l.id));
    return m;
  }, [leaders]);

  const periodByName = useMemo(() => {
    const m = new Map<string, string>();
    periods.forEach(p => {
      m.set(normalize(p.name), p.id);
      // Also allow "Periode 2" ↔ "2"
      const short = normalize(p.name.replace(/^periode\s*/i, ''));
      if (short) m.set(short, p.id);
    });
    return m;
  }, [periods]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setSummary(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error('Filen er tom.');

      // Detect header
      const header = rows[0].map(c => c.trim().toLowerCase());
      const nameIdx = header.findIndex(h => NAME_KEYS.includes(h));
      const periodIdx = header.findIndex(h => PERIOD_KEYS.includes(h));
      const hasHeader = nameIdx !== -1;
      const body = hasHeader ? rows.slice(1) : rows;
      const nCol = hasHeader ? nameIdx : 0;
      const pCol = hasHeader ? periodIdx : (rows[0].length > 1 ? 1 : -1);

      const forcedPeriodId = targetPeriodId !== 'csv' ? targetPeriodId : null;

      const toInsert: { leader_id: string; period_id: string }[] = [];
      const unknownLeaders = new Set<string>();
      const unknownPeriods = new Set<string>();

      for (const row of body) {
        const rawName = (row[nCol] || '').trim();
        if (!rawName) continue;
        const leaderId = leaderByName.get(normalize(rawName));
        if (!leaderId) { unknownLeaders.add(rawName); continue; }

        let periodId = forcedPeriodId;
        if (!periodId) {
          if (pCol < 0) { unknownPeriods.add('(mangler periode-kolonne)'); continue; }
          const rawPeriod = (row[pCol] || '').trim();
          if (!rawPeriod) { unknownPeriods.add('(tom)'); continue; }
          periodId = periodByName.get(normalize(rawPeriod))
            ?? periodByName.get(normalize(rawPeriod.replace(/^periode\s*/i, '')))
            ?? null;
          if (!periodId) { unknownPeriods.add(rawPeriod); continue; }
        }
        toInsert.push({ leader_id: leaderId, period_id: periodId });
      }

      if (toInsert.length === 0) {
        setSummary({
          inserted: 0, duplicate: 0,
          unknownLeaders: [...unknownLeaders], unknownPeriods: [...unknownPeriods],
          total: body.length,
        });
        showError('Ingen gyldige rader å importere.');
        return;
      }

      // Upsert with ignore duplicates so re-imports are safe.
      const { data, error } = await supabase
        .from('leader_period_history')
        .upsert(toInsert, { onConflict: 'leader_id,period_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;

      const inserted = data?.length ?? 0;
      const duplicate = toInsert.length - inserted;
      setSummary({
        inserted, duplicate,
        unknownLeaders: [...unknownLeaders], unknownPeriods: [...unknownPeriods],
        total: body.length,
      });
      showSuccess(`Importerte ${inserted} nye rader${duplicate ? ` (${duplicate} allerede registrert)` : ''}.`);
      await loadCounts();
    } catch (e) {
      console.error(e);
      showError(e instanceof Error ? e.message : 'Kunne ikke lese CSV');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearPeriod = async (period: PeriodRow) => {
    if (!confirm(`Slette all historikk for ${period.name}?`)) return;
    setClearingId(period.id);
    try {
      const { error } = await supabase
        .from('leader_period_history')
        .delete()
        .eq('period_id', period.id);
      if (error) throw error;
      showInfo(`Historikk for ${period.name} slettet.`);
      await loadCounts();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke slette');
    } finally {
      setClearingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4" /> Ledere per periode (historikk)
        </CardTitle>
        <CardDescription>
          Last opp CSV med hvem som har jobbet i hvilken periode. Vises i lederpasset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <span className="font-medium">CSV-format:</span> to kolonner{' '}
            <code className="px-1 py-0.5 rounded bg-muted">name,period</code>{' '}
            — f.eks. <code className="px-1 py-0.5 rounded bg-muted">Ola Nordmann,Periode 2</code>.
          </div>
          <div>
            Eller: velg <em>fast periode</em> nedenfor og last opp fil med bare navn (én per linje).
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium">Fast periode:</label>
          <select
            value={targetPeriodId}
            onChange={(e) => setTargetPeriodId(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            <option value="csv">Bruk periode-kolonne fra CSV</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Last opp CSV
          </Button>
        </div>

        {summary && (
          <div className="rounded-lg border p-3 text-xs space-y-2 bg-muted/40">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Rader: {summary.total}</Badge>
              <Badge className="bg-emerald-600 text-white">Ny: {summary.inserted}</Badge>
              {summary.duplicate > 0 && (
                <Badge variant="outline">Duplikat: {summary.duplicate}</Badge>
              )}
              {summary.unknownLeaders.length > 0 && (
                <Badge variant="destructive">Ukjente navn: {summary.unknownLeaders.length}</Badge>
              )}
              {summary.unknownPeriods.length > 0 && (
                <Badge variant="destructive">Ukjente perioder: {summary.unknownPeriods.length}</Badge>
              )}
            </div>
            {summary.unknownLeaders.length > 0 && (
              <div>
                <div className="font-medium text-foreground">Fant ikke disse navnene:</div>
                <div className="text-muted-foreground break-words">
                  {summary.unknownLeaders.slice(0, 20).join(', ')}
                  {summary.unknownLeaders.length > 20 && ` … +${summary.unknownLeaders.length - 20} til`}
                </div>
              </div>
            )}
            {summary.unknownPeriods.length > 0 && (
              <div>
                <div className="font-medium text-foreground">Fant ikke disse periodene:</div>
                <div className="text-muted-foreground break-words">
                  {summary.unknownPeriods.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-2">Registrert per periode:</div>
          <div className="space-y-1.5">
            {periods.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{p.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{counts[p.id] || 0} ledere</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearPeriod(p)}
                    disabled={clearingId === p.id || (counts[p.id] || 0) === 0}
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    aria-label={`Tøm historikk for ${p.name}`}
                  >
                    {clearingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}