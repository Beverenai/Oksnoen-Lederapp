import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Parsed {
  rawName: string;
  firstName: string;
  lastName: string;
  giftCard: string;
}

// Split "AdaAurmo" / "AnneMariaSchøyen" into first + last (last = last capitalized chunk)
function splitCamelName(blob: string): { firstName: string; lastName: string } {
  const parts = blob.match(/[A-ZÆØÅ][^A-ZÆØÅ]*/g) || [];
  if (parts.length === 0) return { firstName: blob, lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ').replace(/\s+/g, ' ').trim();
  return { firstName, lastName };
}

function parseGiftCardBlob(text: string): Parsed[] {
  // Remove common headers
  let cleaned = text.replace(/Fornavn|Etternavn|Gavekort/gi, '');
  // Split on whitespace/newlines first, then process each chunk
  cleaned = cleaned.replace(/\s+/g, '');
  const out: Parsed[] = [];
  const regex = /([A-Za-zÆØÅæøå\-']+?)(\d{4,8})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(cleaned)) !== null) {
    const nameBlob = m[1];
    const num = m[2];
    const { firstName, lastName } = splitCamelName(nameBlob);
    out.push({ rawName: nameBlob, firstName, lastName, giftCard: num });
  }
  return out;
}

function norm(s: string | null | undefined) {
  return (s || '').toLowerCase().replace(/[\s\-']/g, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function GiftCardImportCard({ onImported }: { onImported?: () => void }) {
  const { showSuccess, showError } = useStatusPopup();
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: string[] } | null>(null);

  const parsed = useMemo(() => parseGiftCardBlob(text), [text]);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      const { data: participants, error } = await supabase
        .from('participants')
        .select('id, first_name, last_name, name');
      if (error) throw error;

      const unmatched: string[] = [];
      let matched = 0;

      for (const p of parsed) {
        const fullNorm = norm(p.firstName + p.lastName);
        const match = (participants || []).find((row) => {
          const a = norm((row.first_name || '') + (row.last_name || ''));
          const b = norm(row.name || '');
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
          Lim inn liste på formatet "FornavnEtternavnGavekort" – matches på navn mot eksisterende deltakere.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
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