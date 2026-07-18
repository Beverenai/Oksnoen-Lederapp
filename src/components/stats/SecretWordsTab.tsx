import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shuffle, Download, Trash2, RefreshCw } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Pair { id: string; word_1: string; word_2: string }
interface Assignment { id: string; participant_id: string; word: string; pair_id: string; slot: number }
interface MatchRow { id: string; pair_id: string; participant_a_id: string; participant_b_id: string; matched_at: string }
interface P { id: string; name: string; cabin_id: string | null; team_id: string | null; cabins?: { name: string } | null }
interface Team { id: string; name: string; slot: number; color: string }

export function SecretWordsTab() {
  const qc = useQueryClient();
  const { showSuccess, showError } = useStatusPopup();
  const { data: periodId } = useActivePeriodId();
  const [working, setWorking] = useState(false);

  const { data: pairs } = useQuery({
    queryKey: ['secret-word-pairs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('secret_word_pairs').select('*').order('word_1');
      if (error) throw error;
      return (data || []) as Pair[];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['secret-word-assignments', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('secret_word_assignments').select('*').eq('period_id', periodId);
      if (error) throw error;
      return (data || []) as Assignment[];
    },
  });

  const { data: matches } = useQuery({
    queryKey: ['secret-word-matches', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('secret_word_matches').select('*').eq('period_id', periodId).order('matched_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MatchRow[];
    },
  });

  const { data: participants } = useQuery({
    queryKey: ['secret-word-participants', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, cabin_id, team_id, cabins:cabin_id(name)')
        .eq('period_id', periodId!)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as P[];
    },
  });

  const { data: teams } = useQuery({
    queryKey: ['secret-word-teams', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_teams')
        .select('id, name, slot, color')
        .eq('period_id', periodId!);
      if (error) throw error;
      return (data || []) as Team[];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, P>();
    (participants || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [participants]);

  const wordByPid = useMemo(() => {
    const m = new Map<string, string>();
    (assignments || []).forEach((a) => m.set(a.participant_id, a.word));
    return m;
  }, [assignments]);

  const assignAll = async () => {
    if (!periodId || !pairs || !participants) return;
    if (participants.length < 2) { showError('For få deltakere', 'Trenger minst 2 deltakere.'); return; }
    const maxPairs = Math.min(pairs.length, Math.floor(participants.length / 2));
    if (!confirm(`Dette gir ${maxPairs * 2} deltakere hvert sitt ord (${maxPairs} par). Eventuelle eksisterende tildelinger for perioden overskrives. Fortsett?`)) return;
    setWorking(true);
    try {
      // Wipe existing
      await (supabase as any).from('secret_word_matches').delete().eq('period_id', periodId);
      await (supabase as any).from('secret_word_assignments').delete().eq('period_id', periodId);

      const shuffledParts = [...participants].sort(() => Math.random() - 0.5);
      const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5).slice(0, maxPairs);

      const rows: any[] = [];
      shuffledPairs.forEach((pair, i) => {
        const a = shuffledParts[i * 2];
        const b = shuffledParts[i * 2 + 1];
        rows.push({ period_id: periodId, participant_id: a.id, pair_id: pair.id, word: pair.word_1, slot: 1 });
        rows.push({ period_id: periodId, participant_id: b.id, pair_id: pair.id, word: pair.word_2, slot: 2 });
      });

      // Insert in chunks
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await (supabase as any).from('secret_word_assignments').insert(chunk);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['secret-word-assignments'] });
      await qc.invalidateQueries({ queryKey: ['secret-word-matches'] });
      showSuccess('Ferdig', `${rows.length} deltakere har fått et ord.`);
    } catch (e: any) {
      showError('Feil', e.message);
    } finally {
      setWorking(false);
    }
  };

  const clearAll = async () => {
    if (!periodId) return;
    if (!confirm('Fjern alle ord-tildelinger OG matcher for aktiv periode?')) return;
    setWorking(true);
    try {
      await (supabase as any).from('secret_word_matches').delete().eq('period_id', periodId);
      await (supabase as any).from('secret_word_assignments').delete().eq('period_id', periodId);
      await qc.invalidateQueries({ queryKey: ['secret-word-assignments'] });
      await qc.invalidateQueries({ queryKey: ['secret-word-matches'] });
      showSuccess('Nullstilt', '');
    } finally { setWorking(false); }
  };

  const resetMatches = async () => {
    if (!periodId) return;
    if (!confirm('Nullstill alle matcher (ord-tildelinger beholdes)?')) return;
    await (supabase as any).from('secret_word_matches').delete().eq('period_id', periodId);
    await qc.invalidateQueries({ queryKey: ['secret-word-matches'] });
    showSuccess('Matcher nullstilt', '');
  };

  const exportCsv = () => {
    if (!assignments || !participants) return;
    const rows = assignments
      .map((a) => {
        const p = byId.get(a.participant_id);
        if (!p) return null;
        return { cabin: p.cabins?.name || 'Uten hytte', name: p.name, word: a.word };
      })
      .filter(Boolean) as { cabin: string; name: string; word: string }[];
    rows.sort((a, b) => a.cabin.localeCompare(b.cabin, 'nb') || a.name.localeCompare(b.name, 'nb'));
    const lines = ['Hytte,Navn,Ord'];
    rows.forEach((r) => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      lines.push(`${esc(r.cabin)},${esc(r.name)},${esc(r.word)}`);
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hemmelige-ord-per-hytte-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPerCabin = () => {
    if (!assignments || !participants) return;
    const teamById = new Map<string, Team>();
    (teams || []).forEach((t) => teamById.set(t.id, t));
    const grouped = new Map<string, { name: string; word: string; team: Team | null }[]>();
    assignments.forEach((a) => {
      const p = byId.get(a.participant_id);
      if (!p) return;
      const key = p.cabins?.name || 'Uten hytte';
      const list = grouped.get(key) || [];
      list.push({ name: p.name, word: a.word, team: p.team_id ? teamById.get(p.team_id) || null : null });
      grouped.set(key, list);
    });
    const sortedCabins = [...grouped.keys()].sort((a, b) => a.localeCompare(b, 'nb'));
    const PER_PAGE = 6; // 2 kolonner × 3 rader
    const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Hemmelige Ord</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #111; }
  .sheet { width: 190mm; height: 277mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 4mm; page-break-after: always; page-break-inside: avoid; }
  .sheet:last-child { page-break-after: auto; }
  .cell { border: 1px dashed #bbb; border-radius: 4mm; padding: 6mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: hidden; }
  .cell.empty { border-color: transparent; }
  .cabin-tag { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: #888; margin: 0 0 3mm; }
  .name { font-size: 22pt; font-weight: 800; margin: 0 0 2mm; line-height: 1.1; }
  .welcome { font-size: 11pt; color: #555; margin: 0 0 4mm; font-style: italic; }
  .team { display: inline-flex; align-items: center; gap: 2mm; font-size: 11pt; font-weight: 600; margin: 0 0 4mm; }
  .dot { width: 4mm; height: 4mm; border-radius: 50%; display: inline-block; }
  .flip { font-size: 9pt; color: #666; margin-top: auto; }
  .word-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 0 0 3mm; }
  .word { font-size: 40pt; font-weight: 800; font-family: 'SF Mono', Menlo, monospace; letter-spacing: 2px; margin: 0 0 4mm; line-height: 1; word-break: break-word; }
  .hint { font-size: 9pt; color: #555; margin: 0; max-width: 70mm; }
</style></head><body>`;
    sortedCabins.forEach((cabin) => {
      const rows = grouped.get(cabin)!.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
      const cabinEsc = escapeHtml(cabin);
      for (let start = 0; start < rows.length; start += PER_PAGE) {
        const chunk = rows.slice(start, start + PER_PAGE);
        // FRONT — normal order (top-left → bottom-right)
        html += `<div class="sheet">`;
        for (let i = 0; i < PER_PAGE; i++) {
          const r = chunk[i];
          if (!r) { html += `<div class="cell empty"></div>`; continue; }
          const teamLabel = r.team ? `Lag ${r.team.slot} – ${escapeHtml(r.team.name)}` : 'Uten lag';
          const teamColor = r.team?.color || '#999';
          html += `<div class="cell">
            <div class="cabin-tag">${cabinEsc}</div>
            <div class="name">${escapeHtml(r.name)}</div>
            <div class="welcome">Velkommen til De Ti Stammene</div>
            <div class="team"><span class="dot" style="background:${teamColor}"></span>${teamLabel}</div>
            <div class="flip">Snu lappen for å se ditt hemmelige ord →</div>
          </div>`;
        }
        html += `</div>`;
        // BACK — mirror columns per row so posisjonen matcher når arket snus langs langsiden (bok-vending)
        // Row i: front [0,1] → back [1,0], og så videre.
        html += `<div class="sheet">`;
        for (let row = 0; row < 3; row++) {
          for (let col = 1; col >= 0; col--) {
            const idx = row * 2 + col;
            const r = chunk[idx];
            if (!r) { html += `<div class="cell empty"></div>`; continue; }
            html += `<div class="cell">
              <div class="word-label">Ditt hemmelige ord</div>
              <div class="word">${escapeHtml(r.word)}</div>
              <div class="hint">Finn en annen deltaker med ordet som hører sammen med ditt. Når dere tror dere har funnet hverandre, gå til en leder som verifiserer paret i appen.</div>
            </div>`;
          }
        }
        html += `</div>`;
      }
    });
    html += `</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const foundCount = matches?.length ?? 0;
  const totalPairs = assignments ? assignments.length / 2 : 0;
  const assignedCount = assignments?.length ?? 0;

  if (!periodId) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Hemmelige Ord</CardTitle>
          <CardDescription>
            Hver deltaker får et hemmelig ord. To ord hører sammen — deltakerne skal finne makkerordet sitt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{assignedCount}</div>
              <div className="text-xs text-muted-foreground">Deltakere med ord</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{foundCount} / {totalPairs}</div>
              <div className="text-xs text-muted-foreground">Par funnet</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{pairs?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Ordpar totalt</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={assignAll} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shuffle className="w-4 h-4 mr-2" />}
              Fordel ord tilfeldig
            </Button>
            <Button variant="outline" onClick={printPerCabin} disabled={!assignedCount}>
              <Download className="w-4 h-4 mr-2" /> Skriv ut per hytte
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!assignedCount}>
              <Download className="w-4 h-4 mr-2" /> Eksporter CSV
            </Button>
            <Button variant="outline" onClick={resetMatches} disabled={!foundCount}>
              <RefreshCw className="w-4 h-4 mr-2" /> Nullstill matcher
            </Button>
            <Button variant="destructive" onClick={clearAll} disabled={working || !assignedCount}>
              <Trash2 className="w-4 h-4 mr-2" /> Fjern alt
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tips: Skriv ut dobbeltsidig og vend langs <strong>langsiden</strong> (bok-vending). Navnet står på forsiden og det hemmelige ordet på baksiden.
          </p>
        </CardContent>
      </Card>

      {matches && matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnet matcher</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {matches.map((m) => {
              const a = byId.get(m.participant_a_id);
              const b = byId.get(m.participant_b_id);
              const pair = pairs?.find((p) => p.id === m.pair_id);
              return (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b last:border-b-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a?.name ?? '?'} & {b?.name ?? '?'}</div>
                    <div className="text-xs text-muted-foreground">{pair ? `${pair.word_1} ↔ ${pair.word_2}` : ''}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {new Date(m.matched_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}