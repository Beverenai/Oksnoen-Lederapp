import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';

interface Parsed {
  rawName: string;
  firstName: string;
  lastName: string;
  giftCard: string;
}

// Split "AdaAurmo" / "AnneMariaSchøyen" into first + last (last = last capitalized chunk)
function splitCamelName(blob: string): { firstName: string; lastName: string } {
  // Split on capital letters, keeping initials like "H." together and preserving spaces.
  const parts = blob.match(/[A-ZÆØÅ][a-zæøåA-ZÆØÅ.\-']*/g) || [];
  if (parts.length === 0) return { firstName: blob, lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ').replace(/\s+/g, ' ').trim();
  return { firstName, lastName };
}

function parseGiftCardBlob(text: string): Parsed[] {
  // Remove common headers
  let cleaned = text.replace(/Fornavn|Etternavn|Gavekort/gi, '');
  // Collapse repeated whitespace but keep single spaces so initials with periods survive
  cleaned = cleaned.replace(/\s+/g, ' ');
  const out: Parsed[] = [];
  // Allow periods, hyphens, apostrophes and spaces inside the name segment
  const regex = /([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå.\-'\s]*?)(\d{4,8})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(cleaned)) !== null) {
    const nameBlob = m[1].trim();
    const num = m[2];
    const { firstName, lastName } = splitCamelName(nameBlob);
    out.push({ rawName: nameBlob, firstName, lastName, giftCard: num });
  }
  return out;
}

function norm(s: string | null | undefined) {
  return (s || '').toLowerCase().replace(/[\s\-'.]/g, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

// Removes single-letter initials like "R." / "S.-L." from a name so
// "Charlotte R." matches "Charlotte"
function stripInitials(s: string) {
  return (s || '')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !/^[A-Za-zÆØÅæøå]\.?(-[A-Za-zÆØÅæøå]\.?)*$/.test(t))
    .join(' ');
}

// CSV files exported from Excel are often Windows-1252/Latin-1 encoded
async function readTextSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(buf);
  }
  return utf8;
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ''));
}

// Parses a CSV/TXT file with columns for name(s) and gift card number.
// Supports: "Fornavn;Etternavn;Gavekort", "Navn,Gavekort" — with or without header.
function parseGiftCardCsv(raw: string): Parsed[] {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = [';', ',', '\t'].sort(
    (a, b) => (lines[0].split(b).length - 1) - (lines[0].split(a).length - 1)
  )[0];

  const first = splitCsvLine(lines[0], delim).map((c) => c.toLowerCase());
  const hasHeader = first.some((c) => /fornavn|etternavn|navn|gavekort|kortnr|nummer/.test(c));

  let iFirst = 0, iLast = -1, iCard = 1, iName = -1;
  if (hasHeader) {
    iFirst = first.findIndex((c) => c.includes('fornavn'));
    iLast = first.findIndex((c) => c.includes('etternavn'));
    iName = first.findIndex((c) => c === 'navn' || c.includes('fullt navn') || c.includes('deltaker'));
    iCard = first.findIndex((c) => /gavekort|kortnr|kortnummer|nummer|number/.test(c));
    if (iCard === -1) iCard = first.length - 1;
    // When a separate surname column exists, the other name column holds the first name(s)
    if (iLast >= 0) {
      if (iFirst === -1) iFirst = iName >= 0 ? iName : 0;
      iName = -1;
    } else if (iFirst === -1) {
      iFirst = iName >= 0 ? iName : 0;
    }
  }

  const out: Parsed[] = [];
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cols = splitCsvLine(line, delim);
    const card = (cols[iCard] || '').replace(/\s/g, '');
    if (!/^\d{3,12}$/.test(card)) continue;

    let firstName = '';
    let lastName = '';
    if (iName >= 0 && cols[iName]) {
      const parts = cols[iName].trim().split(/\s+/);
      firstName = parts.slice(0, -1).join(' ') || parts[0];
      lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    } else if (iLast >= 0) {
      firstName = cols[iFirst] || '';
      lastName = cols[iLast] || '';
    } else {
      const blob = (cols[iFirst] || '').trim();
      if (/\s/.test(blob)) {
        const parts = blob.split(/\s+/);
        firstName = parts.slice(0, -1).join(' ');
        lastName = parts[parts.length - 1];
      } else {
        const s = splitCamelName(blob);
        firstName = s.firstName;
        lastName = s.lastName;
      }
    }
    if (!firstName && !lastName) continue;
    out.push({ rawName: `${firstName} ${lastName}`.trim(), firstName, lastName, giftCard: card });
  }
  return out;
}

export function GiftCardImportCard({ onImported }: { onImported?: () => void }) {
  const { showSuccess, showError } = useStatusPopup();
  const { data: activePeriodId } = useActivePeriodId();
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [csvRows, setCsvRows] = useState<Parsed[] | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pastedParsed = useMemo(() => parseGiftCardBlob(text), [text]);
  const parsed = csvRows ?? pastedParsed;

  const handleFile = async (file: File) => {
    setResult(null);
    try {
      const raw = await readTextSmart(file);
      const rows = parseGiftCardCsv(raw);
      if (rows.length === 0) {
        showError('Fant ingen gavekortnumre i filen');
        return;
      }
      setCsvRows(rows);
      setCsvName(file.name);
      showSuccess(`${rows.length} rader lest fra ${file.name}`);
    } catch (e: any) {
      showError(e.message || 'Kunne ikke lese filen');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearCsv = () => {
    setCsvRows(null);
    setCsvName(null);
    setResult(null);
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      let query = supabase.from('participants').select('id, first_name, last_name, name');
      if (activePeriodId) query = query.eq('period_id', activePeriodId);
      const { data: participants, error } = await query;
      if (error) throw error;

      const unmatched: string[] = [];
      let matched = 0;

      for (const p of parsed) {
        const fullNorm = norm(stripInitials(p.firstName) + p.lastName);
        const match = (participants || []).find((row) => {
          const a = norm(stripInitials(row.first_name || '') + (row.last_name || ''));
          const b = norm(stripInitials(row.name || ''));
          return a === fullNorm || b === fullNorm;
        });
        if (!match) {
          unmatched.push(`${p.firstName} ${p.lastName} (${p.giftCard})`);
          continue;
        }
        const { error: upErr } = await supabase
          .from('participants')
          .update({ gift_card_number: p.giftCard })
          .eq('id', match.id);
        if (upErr) {
          unmatched.push(`${p.firstName} ${p.lastName}: ${upErr.message}`);
        } else {
          matched++;
        }
      }

      setResult({ matched, unmatched });
      if (matched > 0) showSuccess(`${matched} gavekortnumre lagt inn`);
      if (unmatched.length > 0 && matched === 0) showError('Ingen treff funnet');
      onImported?.();
    } catch (e: any) {
      showError(e.message || 'Import feilet');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Importer gavekortnumre
        </CardTitle>
        <CardDescription>
          Last opp CSV-fil (Fornavn;Etternavn;Gavekort eller Navn,Gavekort) eller lim inn liste på formatet
          "FornavnEtternavnGavekort" – matches på navn mot eksisterende deltakere.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Last opp CSV
          </Button>
          {csvName && (
            <Badge variant="secondary" className="gap-1">
              {csvName}
              <button type="button" aria-label="Fjern fil" onClick={clearCsv} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (csvRows) clearCsv();
          }}
          placeholder="FornavnEtternavnGavekort&#10;AdaAurmo200000&#10;AdeleMellbye200001..."
          rows={6}
        />
        {parsed.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{parsed.length} oppføringer funnet</Badge>
          </div>
        )}
        <Button onClick={handleImport} disabled={parsed.length === 0 || isImporting}>
          {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
          Importer {parsed.length > 0 ? `(${parsed.length})` : ''}
        </Button>

        {result && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {result.matched} oppdatert
            </div>
            {result.unmatched.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  {result.unmatched.length} ikke matchet
                </div>
                <ul className="text-xs text-muted-foreground list-disc list-inside max-h-40 overflow-y-auto">
                  {result.unmatched.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}