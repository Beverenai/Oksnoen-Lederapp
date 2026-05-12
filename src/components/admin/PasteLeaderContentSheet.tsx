import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ClipboardPaste, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { hapticSuccess } from '@/lib/capacitorHaptics';

interface Leader { id: string; name: string; phone?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaders: Leader[];
  onSaved: () => void;
}

type ContentKey =
  | 'current_activity'
  | 'extra_activity'
  | 'personal_notes'
  | 'personal_message'
  | 'obs_message'
  | 'extra_1' | 'extra_2' | 'extra_3' | 'extra_4' | 'extra_5';
type LeaderKey = 'phone' | 'cabin' | 'ministerpost' | 'team';
type SpecialKey = 'name';
type FieldKey = ContentKey | LeaderKey;
type AnyKey = FieldKey | SpecialKey;

const CONTENT_KEYS: ContentKey[] = [
  'current_activity', 'extra_activity', 'personal_notes', 'personal_message',
  'obs_message', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
];
const LEADER_KEYS: LeaderKey[] = ['phone', 'cabin', 'ministerpost', 'team'];

const FIELD_LABELS: Record<FieldKey, string> = {
  current_activity: 'Aktivitet',
  extra_activity: 'Ansvar',
  personal_notes: 'Notater',
  personal_message: 'Til deg',
  obs_message: 'OBS!',
  extra_1: 'Ekstra #1',
  extra_2: 'Ekstra #2',
  extra_3: 'Ekstra #3',
  extra_4: 'Ekstra #4',
  extra_5: 'Ekstra #5',
  phone: 'Tlf',
  cabin: 'Hytte',
  ministerpost: 'Ministerpost',
  team: 'Team',
};

// Header alias map (lowercased) → field key
const HEADER_ALIASES: Record<string, AnyKey> = {
  'navn': 'name', 'name': 'name',
  'tlf': 'phone', 'telefon': 'phone', 'phone': 'phone', 'mobil': 'phone',
  'aktivitet': 'current_activity', 'activity': 'current_activity',
  'ansvar': 'extra_activity',
  'notater': 'personal_notes', 'notes': 'personal_notes',
  'notater til deg': 'personal_notes', 'notater/til deg': 'personal_notes',
  'til deg': 'personal_message', 'til lederen': 'personal_message', 'personal_message': 'personal_message',
  'obs': 'obs_message', 'obs!': 'obs_message', 'viktig': 'obs_message',
  'ekstra #1': 'extra_1', 'ekstra 1': 'extra_1', 'ekstra1': 'extra_1',
  'ekstra #2': 'extra_2', 'ekstra 2': 'extra_2', 'ekstra2': 'extra_2',
  'ekstra #3': 'extra_3', 'ekstra 3': 'extra_3', 'ekstra3': 'extra_3',
  'ekstra #4': 'extra_4', 'ekstra 4': 'extra_4', 'ekstra4': 'extra_4',
  'ekstra #5': 'extra_5', 'ekstra 5': 'extra_5', 'ekstra5': 'extra_5',
  'hytte': 'cabin', 'cabin': 'cabin',
  'hytte ansvar': 'cabin', 'hytte/ansvar': 'cabin',
  'ministerpost': 'ministerpost',
  'team': 'team',
};

// Parse TSV (tab-separated, with quoted multi-line support like Excel/Sheets copy)
function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === '') { inQuotes = true; }
      else if (ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else { cell += ch; }
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  // Drop fully-empty trailing rows
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  return rows;
}

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const normPhone = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-8);

interface ParsedRow {
  rawName: string;
  rawPhone: string;
  matchedLeader?: Leader;
  values: Partial<Record<FieldKey, string>>;
}

interface Parsed {
  headerMap: Record<number, AnyKey>;
  nameCol: number;
  phoneCol: number;
  rows: ParsedRow[];
  unknownHeaders: string[];
  error?: string;
}

function parseInput(text: string, leaders: Leader[]): Parsed {
  const grid = parseTsv(text);
  if (grid.length < 2) {
    return { headerMap: {}, nameCol: -1, phoneCol: -1, rows: [], unknownHeaders: [], error: 'Trenger en headerrad og minst én datarad.' };
  }
  const header = grid[0];
  const headerMap: Record<number, AnyKey> = {};
  const unknownHeaders: string[] = [];
  let nameCol = -1;
  let phoneCol = -1;
  header.forEach((h, idx) => {
    const key = HEADER_ALIASES[norm(h)];
    if (key) {
      headerMap[idx] = key;
      if (key === 'name') nameCol = idx;
      if (key === 'phone') phoneCol = idx;
    } else if (h.trim()) {
      unknownHeaders.push(h);
    }
  });
  if (nameCol === -1) {
    return { headerMap, nameCol, phoneCol, rows: [], unknownHeaders, error: 'Fant ingen "Navn"-kolonne.' };
  }

  // Build leader indices by normalized name and phone
  const byName = new Map<string, Leader>();
  const byPhone = new Map<string, Leader>();
  for (const l of leaders) byName.set(norm(l.name), l);
  for (const l of leaders) {
    const p = normPhone(l.phone);
    if (p) byPhone.set(p, l);
  }

  const rows: ParsedRow[] = grid.slice(1).map(r => {
    const rawName = (r[nameCol] || '').trim();
    const rawPhone = phoneCol >= 0 ? (r[phoneCol] || '').trim() : '';
    const values: Partial<Record<FieldKey, string>> = {};
    for (const [idxStr, key] of Object.entries(headerMap)) {
      if (key === 'name') continue;
      const v = (r[Number(idxStr)] || '').trim();
      if (v) values[key as FieldKey] = v;
    }
    // Prefer phone match
    let matchedLeader: Leader | undefined;
    const phoneKey = normPhone(rawPhone);
    if (phoneKey) matchedLeader = byPhone.get(phoneKey);
    if (!matchedLeader) matchedLeader = byName.get(norm(rawName));
    if (!matchedLeader && rawName) {
      const target = norm(rawName);
      for (const l of leaders) {
        const ln = norm(l.name);
        if (ln === target) { matchedLeader = l; break; }
        if (ln.startsWith(target) || target.startsWith(ln)) { matchedLeader = l; break; }
      }
    }
    return { rawName, rawPhone, matchedLeader, values };
  }).filter(r => r.rawName || r.rawPhone);

  return { headerMap, nameCol, phoneCol, rows, unknownHeaders };
}

export function PasteLeaderContentSheet({ open, onOpenChange, leaders, onSaved }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const parsed = useMemo(() => (text ? parseInput(text, leaders) : null), [text, leaders]);

  const matched = parsed?.rows.filter(r => r.matchedLeader && Object.keys(r.values).length > 0) ?? [];
  const unmatched = parsed?.rows.filter(r => !r.matchedLeader) ?? [];
  const noChanges = parsed?.rows.filter(r => r.matchedLeader && Object.keys(r.values).length === 0) ?? [];

  const handleClose = () => {
    onOpenChange(false);
    setShowPreview(false);
  };

  const handleSave = async () => {
    if (!matched.length) return;
    setIsSaving(true);
    try {
      const ids = matched.map(r => r.matchedLeader!.id);
      const { data: existing } = await supabase
        .from('leader_content')
        .select('id, leader_id')
        .in('leader_id', ids);
      const existingByLeader = new Map((existing || []).map(e => [e.leader_id, e.id]));

      const nowIso = new Date().toISOString();
      let saved = 0, failed = 0;
      for (const row of matched) {
        const leaderId = row.matchedLeader!.id;

        // Split into content vs leader-table fields
        const contentPayload: Record<string, string> = {};
        const leaderPayload: Record<string, string> = {};
        for (const k of CONTENT_KEYS) {
          const v = row.values[k];
          if (v !== undefined) contentPayload[k] = v;
        }
        for (const k of LEADER_KEYS) {
          const v = row.values[k];
          if (v !== undefined) leaderPayload[k] = v;
        }

        let rowFailed = false;

        if (Object.keys(contentPayload).length > 0) {
          const payload = { ...contentPayload, last_synced_at: nowIso };
          if (existingByLeader.has(leaderId)) {
            const { error } = await supabase.from('leader_content').update(payload).eq('leader_id', leaderId);
            if (error) { rowFailed = true; console.error('Content update failed', leaderId, error); }
          } else {
            const { error } = await supabase.from('leader_content').insert({ leader_id: leaderId, ...payload });
            if (error) { rowFailed = true; console.error('Content insert failed', leaderId, error); }
          }
        }

        if (Object.keys(leaderPayload).length > 0) {
          const { error } = await supabase.from('leaders').update(leaderPayload).eq('id', leaderId);
          if (error) { rowFailed = true; console.error('Leader update failed', leaderId, error); }
        }

        if (rowFailed) failed++; else saved++;
      }
      hapticSuccess();
      if (failed > 0) showError(`Lagret ${saved} av ${matched.length} (${failed} feilet)`);
      else showSuccess(`Lagret ${saved} ledere`);
      onSaved();
      setText('');
      setShowPreview(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lagre');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" /> Lim inn fra Sheet
          </SheetTitle>
          <SheetDescription>
            Kopier rader fra Google Sheets/Excel inkl. headerrad. Gjenkjente kolonner: <strong>Tlf, Navn, Aktivitet, Notater, Til deg, OBS!, Ekstra #1–5, Hytte, Ansvar, Ministerpost, Team</strong>. Matching skjer primært på telefon, deretter navn. Tomme celler ignoreres.
          </SheetDescription>
        </SheetHeader>

        {!showPreview ? (
          <div className="mt-4 space-y-3">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Tlf\tNavn\tAktivitet\tNotater\tTil deg\tOBS!\tEkstra #1\tHytte\tMinisterpost\tTeam\n90012345\tOla Nordmann\tTriatlon\tHusk badetøy\t...\t...\t...\tBalder\tStatsminister\tSjef'}
              className="min-h-[300px] font-mono text-xs"
            />
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {parsed?.rows.length ? `${parsed.rows.length} datarader oppdaget` : ' '}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Avbryt</Button>
                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={!parsed || !!parsed.error || !parsed.rows.length}
                >
                  Forhåndsvis
                </Button>
              </div>
            </div>
            {parsed?.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
                {parsed.error}
              </div>
            )}
            {parsed && parsed.unknownHeaders.length > 0 && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 text-sm p-3">
                Ukjente kolonner ignoreres: {parsed.unknownHeaders.join(', ')}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-green-600">{matched.length} oppdateres</Badge>
              {noChanges.length > 0 && <Badge variant="secondary">{noChanges.length} uten endring</Badge>}
              {unmatched.length > 0 && <Badge variant="destructive">{unmatched.length} ikke matchet</Badge>}
            </div>

            {matched.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="px-3 py-2 text-xs font-semibold border-b bg-muted/40 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600" /> Vil bli oppdatert
                </div>
                <div className="divide-y max-h-[40vh] overflow-y-auto">
                  {matched.map((r, i) => {
                    const leaderFields = LEADER_KEYS.filter(k => r.values[k] !== undefined);
                    const contentFields = CONTENT_KEYS.filter(k => r.values[k] !== undefined);
                    return (
                      <div key={i} className="px-3 py-2 text-sm">
                        <div className="font-medium">{r.matchedLeader!.name}</div>
                        {leaderFields.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground/80">📇 Leder-info</div>
                            {leaderFields.map(k => (
                              <div key={k}><span className="font-medium text-foreground">{FIELD_LABELS[k]}:</span> {r.values[k]}</div>
                            ))}
                          </div>
                        )}
                        {contentFields.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground/80">📋 Innhold</div>
                            {contentFields.map(k => (
                              <div key={k}><span className="font-medium text-foreground">{FIELD_LABELS[k]}:</span> {r.values[k]}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="rounded-md border border-destructive/40">
                <div className="px-3 py-2 text-xs font-semibold border-b bg-destructive/10 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Ikke matchet (hoppes over)
                </div>
                <ul className="px-3 py-2 text-sm divide-y">
                  {unmatched.map((r, i) => (
                    <li key={i} className="py-1">{r.rawName}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isSaving}>Tilbake</Button>
              <Button onClick={handleSave} disabled={isSaving || matched.length === 0}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Bekreft og lagre ({matched.length})
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}