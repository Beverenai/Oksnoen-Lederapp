import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useSweatersEnabled } from '@/hooks/useSweatersEnabled';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Shirt, Loader2, Upload, Copy, Search, CheckCircle2, ShoppingBag, Download } from 'lucide-react';
import ExcelJS from 'exceljs';

interface ParticipantRow {
  id: string;
  name: string;
  cabin_id: string | null;
  cabins?: { name: string } | null;
}
interface SweaterRow {
  participant_id: string;
  preordered_size: string | null;
  picked_up: boolean;
  picked_up_size: string | null;
  bought_on_camp: boolean;
  bought_size: string | null;
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseSize(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  if (!s) return null;
  if (['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].includes(s)) return s;
  return s.slice(0, 5);
}

export function SweatersTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const enabled = useSweatersEnabled();
  const { data: periodId } = useActivePeriodId();
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [sweaters, setSweaters] = useState<Map<string, SweaterRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [togglingFlag, setTogglingFlag] = useState(false);
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        supabase.from('participants').select('id, name, cabin_id, cabins(name)').order('name'),
        supabase.from('participant_sweaters').select('participant_id, preordered_size, picked_up, picked_up_size, bought_on_camp, bought_size').eq('period_id', periodId),
      ]);
      setParticipants((pRes.data || []) as any);
      const map = new Map<string, SweaterRow>();
      (sRes.data || []).forEach((r: any) => map.set(r.participant_id, r));
      setSweaters(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const toggleEnabled = async (val: boolean) => {
    setTogglingFlag(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'sweaters_enabled', value: val ? 'true' : 'false' }, { onConflict: 'key' });
      if (error) throw error;
      showSuccess(val ? 'Gensere aktivert' : 'Gensere deaktivert');
    } catch (e: any) {
      showError('Kunne ikke oppdatere', e?.message);
    } finally {
      setTogglingFlag(false);
    }
  };

  const applyRows = async (rows: { fullName: string; size: string | null }[]) => {
    if (!periodId) { showError('Ingen aktiv periode'); return; }
    // Build name -> participant id map
    const nameMap = new Map<string, string>();
    participants.forEach((p) => nameMap.set(normName(p.name), p.id));

    const matches: { participant_id: string; period_id: string; preordered_size: string | null }[] = [];
    const unmatched: string[] = [];
    for (const r of rows) {
      const id = nameMap.get(normName(r.fullName));
      if (id) matches.push({ participant_id: id, period_id: periodId, preordered_size: r.size });
      else if (r.fullName) unmatched.push(r.fullName);
    }

    if (matches.length === 0) {
      showError('Ingen deltakere funnet', `Sjekk at navnene matcher. ${unmatched.length} ikke funnet.`);
      return;
    }

    const { error } = await supabase
      .from('participant_sweaters')
      .upsert(matches, { onConflict: 'participant_id,period_id' });
    if (error) { showError('Import feilet', error.message); return; }

    await load();
    showSuccess(`${matches.length} genser-bestillinger importert`, unmatched.length ? `${unmatched.length} ikke funnet` : undefined);
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type.includes('csv') || file.type === 'text/plain';
      if (isCsv) {
        // Try UTF-8 first; if it contains replacement chars, fall back to Latin-1 (common for Norwegian CSVs from Excel).
        const buf = await file.arrayBuffer();
        let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        if (text.includes('\uFFFD')) {
          text = new TextDecoder('iso-8859-1').decode(buf);
        }
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const first = lines[0] || '';
        const delim = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
        const splitLine = (l: string) => l.split(delim).map((c) => c.replace(/^"|"$/g, '').trim());
        const header = splitLine(first).map((h) => h.toLowerCase());
        let startIdx = 0;
        let iFirst = 0, iLast = 1, iSize = 2, iFull = -1;
        const hasHeader = header.some((h) => /navn|name|størrelse|storrelse|size|forhånd|forhand/.test(h));
        if (hasHeader) {
          startIdx = 1;
          const findIdx = (preds: RegExp[]) => header.findIndex((h) => preds.some((r) => r.test(h)));
          const fullIdx = findIdx([/^fullt\s*navn$/, /^full\s*name$/]);
          const firstIdx = findIdx([/^fornavn$/, /^first/, /^navn$/, /^name$/]);
          const lastIdx = findIdx([/^etternavn$/, /^last/]);
          const sizeIdx = findIdx([/størrelse|storrelse|size|forhånd|forhand|pre/]);
          if (firstIdx >= 0 && lastIdx >= 0) { iFirst = firstIdx; iLast = lastIdx; }
          else if (fullIdx >= 0) { iFull = fullIdx; }
          else if (firstIdx >= 0) { iFull = firstIdx; }
          if (sizeIdx >= 0) iSize = sizeIdx;
        }
        const rows: { fullName: string; size: string | null }[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const parts = splitLine(lines[i]);
          const fullName = iFull >= 0 ? (parts[iFull] || '') : `${parts[iFirst] || ''} ${parts[iLast] || ''}`.trim();
          const size = parseSize(parts[iSize]);
          if (fullName) rows.push({ fullName, size });
        }
        await applyRows(rows);
        return;
      }
      const xbuf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(xbuf);
      const ws = wb.worksheets[0];
      const headerRow = ws.getRow(1);
      const cols: Record<string, number> = {};
      headerRow.eachCell((cell, col) => {
        const key = String(cell.value || '').trim().toLowerCase();
        cols[key] = col;
      });

      const cFirst = cols['navn'] ?? cols['fornavn'] ?? 1;
      const cLast = cols['etternavn'] ?? 2;
      const cPre = cols['forhåndsbest'] ?? cols['forhåndsbestilt'] ?? cols['forhandsbest'] ?? cols['pre'] ?? 3;

      const rows: { fullName: string; size: string | null }[] = [];
      ws.eachRow((row, idx) => {
        if (idx === 1) return;
        const first = String(row.getCell(cFirst).value || '').trim();
        const last = String(row.getCell(cLast).value || '').trim();
        const size = parseSize(row.getCell(cPre).value);
        const fullName = `${first} ${last}`.trim();
        if (fullName) rows.push({ fullName, size });
      });
      await applyRows(rows);
    } catch (e: any) {
      showError('Kunne ikke lese fil', e?.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setImporting(true);
    try {
      const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows: { fullName: string; size: string | null }[] = [];
      for (const line of lines) {
        const parts = line.split(/\t|;|,\s+/);
        if (parts.length < 2) continue;
        // Skip header row
        if (/^navn$/i.test(parts[0])) continue;
        const first = parts[0]?.trim() || '';
        const last = parts[1]?.trim() || '';
        const size = parseSize(parts[2]);
        const fullName = `${first} ${last}`.trim();
        if (fullName) rows.push({ fullName, size });
      }
      await applyRows(rows);
      setPasteText('');
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => p.name.toLowerCase().includes(q));
  }, [participants, search]);

  const stats = useMemo(() => {
    let pre = 0, picked = 0, bought = 0;
    sweaters.forEach((s) => {
      if (s.preordered_size) pre++;
      if (s.picked_up) picked++;
      if (s.bought_on_camp) bought++;
    });
    return { pre, picked, bought };
  }, [sweaters]);

  const sizeBreakdown = useMemo(() => {
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const counts: Record<string, number> = {};
    const other: Record<string, number> = {};
    sweaters.forEach((s) => {
      const raw = (s.preordered_size || '').trim().toUpperCase();
      if (!raw) return;
      if (order.includes(raw)) counts[raw] = (counts[raw] || 0) + 1;
      else other[raw] = (other[raw] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + Object.values(other).reduce((a, b) => a + b, 0);
    const rows = order
      .filter((k) => counts[k])
      .map((k) => ({ size: k, count: counts[k] }));
    Object.entries(other).forEach(([k, v]) => rows.push({ size: k, count: v }));
    return { rows, total };
  }, [sweaters]);

  const copySheet = async () => {
    const header = 'Navn\tEtternavn\tForhåndsbest\tHentet\tKjøpt på leir';
    const lines = participants.map((p) => {
      const s = sweaters.get(p.id);
      const [first, ...rest] = p.name.split(' ');
      const last = rest.join(' ');
      const pre = s?.preordered_size || '';
      const hentet = s?.picked_up ? (s.picked_up_size || 'x') : '';
      const kjopt = s?.bought_on_camp ? (s.bought_size || 'x') : '';
      return `${first || ''}\t${last}\t${pre}\t${hentet}\t${kjopt}`;
    });
    const text = [header, ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('Kopiert til utklippstavle');
    } catch {
      showError('Kunne ikke kopiere');
    }
  };

  const buildRows = () =>
    participants.map((p) => {
      const s = sweaters.get(p.id);
      const [first, ...rest] = p.name.split(' ');
      const last = rest.join(' ');
      return {
        first: first || '',
        last,
        pre: s?.preordered_size || '',
        hentet: s?.picked_up ? (s.picked_up_size || 'x') : '',
        kjopt: s?.bought_on_camp ? (s.bought_size || 'x') : '',
      };
    });

  const downloadCsv = () => {
    const header = ['Navn', 'Etternavn', 'Forhåndsbestilt', 'Hentet', 'Kjøpt på leir'];
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [header.join(';'), ...buildRows().map((r) => [r.first, r.last, r.pre, r.hentet, r.kjopt].map(esc).join(';'))];
    // Prepend BOM so Excel opens UTF-8 correctly
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Genserliste_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('CSV lastet ned');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shirt className="w-5 h-5" /> Gensere
          </CardTitle>
          <CardDescription>
            Skru på og av for dag 1. Ledere ser en knapp på hjemskjermen når det er aktivt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Vis Gensere i appen</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? 'Aktiv – ledere kan registrere' : 'Skjult'}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={togglingFlag} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{stats.pre}</p>
              <p className="text-xs text-muted-foreground">Forhåndsbest.</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-success">{stats.picked}</p>
              <p className="text-xs text-muted-foreground">Hentet</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-primary">{stats.bought}</p>
              <p className="text-xs text-muted-foreground">Kjøpt på leir</p>
            </div>
          </div>

          {sizeBreakdown.rows.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Forhåndsbestilte størrelser</p>
                <p className="text-xs text-muted-foreground">{sizeBreakdown.total} totalt</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sizeBreakdown.rows.map((r) => (
                  <Badge key={r.size} variant="outline" className="text-xs">
                    <span className="font-semibold uppercase mr-1">{r.size}</span>
                    <span className="text-muted-foreground">×{r.count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importer XLSX / CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="outline" onClick={copySheet}>
              <Copy className="w-4 h-4 mr-2" /> Kopier ark
            </Button>
            <Button variant="outline" onClick={downloadCsv}>
              <Download className="w-4 h-4 mr-2" /> Last ned CSV
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Eller lim inn fra Sheets</p>
            <Textarea
              rows={4}
              placeholder={'Navn\tEtternavn\tForhåndsbest\nOla\tNordmann\tM'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button size="sm" onClick={handlePasteImport} disabled={importing || !pasteText.trim()}>
              Importer innlimte
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oversikt ({participants.length})</CardTitle>
          <CardDescription>Status per deltager i aktiv periode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Søk deltaker..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="divide-y max-h-[520px] overflow-auto rounded-md border">
              {filtered.map((p) => {
                const s = sweaters.get(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.cabins?.name && <p className="text-xs text-muted-foreground truncate">{p.cabins.name}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {s?.preordered_size && <Badge variant="outline" className="uppercase text-[10px]">Best. {s.preordered_size}</Badge>}
                      {s?.picked_up && (
                        <Badge className="text-[10px] bg-success/15 text-success border-success/30">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" />
                          {s.picked_up_size || 'Hentet'}
                        </Badge>
                      )}
                      {s?.bought_on_camp && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                          <ShoppingBag className="w-3 h-3 mr-0.5" />
                          {s.bought_size || 'Kjøpt'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Ingen treff</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SweatersTab;