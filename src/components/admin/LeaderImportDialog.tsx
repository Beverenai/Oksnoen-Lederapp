import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface LeaderImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPhones: string[];
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  phone: string;
}

const HEADER_HINT = /(navn|name|telefon|phone|mobil)/i;

// Always returns 8 digits (Norwegian local format) — strips +47/0047/47 prefix
// and all spaces/dashes/parentheses. Returns '' if not a valid 8-digit number.
function normalizePhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('0047')) digits = digits.slice(4);
  else if (digits.length === 10 && digits.startsWith('47')) digits = digits.slice(2);
  else if (digits.length > 8 && digits.startsWith('47')) digits = digits.slice(2);
  return digits.length === 8 ? digits : '';
}

// Pulls a Norwegian phone number out of a line of free text.
// Matches +47 / 0047 / 47 prefixes plus 8 digits (with optional spaces/dashes).
function extractPhone(line: string): { phone: string; rest: string } | null {
  const re = /(?:\+?\s*47[\s-]?|0047[\s-]?)?(?:\d[\s-]?){8,}/g;
  let match: RegExpExecArray | null;
  let best: { match: string; index: number; phone: string } | null = null;
  while ((match = re.exec(line)) !== null) {
    const phone = normalizePhone(match[0]);
    if (phone) {
      // Prefer the LAST valid phone (name usually comes first).
      best = { match: match[0], index: match.index, phone };
    }
  }
  if (!best) return null;
  const rest = (line.slice(0, best.index) + line.slice(best.index + best.match.length))
    .replace(/[,;\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { phone: best.phone, rest };
}

function parseInput(text: string): { valid: ParsedRow[]; invalid: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const valid: ParsedRow[] = [];
  const invalid: string[] = [];

  lines.forEach((line, idx) => {
    // Skip header row
    if (idx === 0 && HEADER_HINT.test(line) && !/\d{6,}/.test(line)) return;

    const extracted = extractPhone(line);
    if (!extracted) {
      invalid.push(line);
      return;
    }
    const name = extracted.rest;
    if (name.length < 2) {
      invalid.push(line);
      return;
    }
    valid.push({ name, phone: extracted.phone });
  });

  return { valid, invalid };
}

// Dedupe key — last 8 digits, so +47 / 0047 / bare 8 all match.
function phoneKey(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-8);
}

export function LeaderImportDialog({ open, onOpenChange, existingPhones, onImported }: LeaderImportDialogProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(prev => (prev ? prev + '\n' + content : content));
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!text.trim()) {
      showError('Lim inn eller velg en fil først');
      return;
    }
    setIsImporting(true);
    try {
      const { valid, invalid } = parseInput(text);
      if (valid.length === 0) {
        showError('Fant ingen gyldige rader');
        return;
      }

      const existing = new Set(existingPhones.map(phoneKey));
      const toInsert: ParsedRow[] = [];
      const seen = new Set<string>();
      let duplicates = 0;
      valid.forEach(row => {
        const key = phoneKey(row.phone);
        if (existing.has(key) || seen.has(key)) {
          duplicates++;
          return;
        }
        seen.add(key);
        toInsert.push(row);
      });

      let inserted = 0;
      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('leaders')
          .insert(toInsert)
          .select('id');
        if (error) {
          // Could be a partial duplicate-conflict. Fall back to one-by-one.
          if (error.code === '23505') {
            for (const row of toInsert) {
              const { error: rowErr } = await supabase.from('leaders').insert(row);
              if (!rowErr) inserted++;
              else if (rowErr.code === '23505') duplicates++;
            }
          } else {
            throw error;
          }
        } else {
          inserted = data?.length ?? toInsert.length;
        }
      }

      const parts = [`${inserted} lagt til`];
      if (duplicates > 0) parts.push(`${duplicates} duplikater`);
      if (invalid.length > 0) parts.push(`${invalid.length} ugyldige`);
      if (inserted > 0) showSuccess(parts.join(', '));
      else showInfo(parts.join(', '));

      onImported();
      setText('');
      onOpenChange(false);
    } catch (err) {
      console.error('Import error:', err);
      showError('Kunne ikke importere ledere');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer ledere</DialogTitle>
          <DialogDescription>
            Lim inn én leder per linje — f.eks. <strong>Ola Nordmann, +47 412 34 567</strong>.
            +47 / 0047 fjernes automatisk og lagres som 8 sifre. Komma, semikolon, tab eller
            mellomrom fungerer. Duplikater (samme telefonnummer) hoppes over.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder={"Ola Nordmann, 41234567\nKari Hansen; 99887766"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="w-4 h-4 mr-2" />
              Velg CSV-fil
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Avbryt
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !text.trim()}>
            {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
