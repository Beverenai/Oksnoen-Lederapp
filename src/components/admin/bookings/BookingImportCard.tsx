import { useState } from 'react';
import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';

interface Props {
  periodId: string | null;
  onImported: () => void;
}

// Norwegian header -> DB column
const HEADER_MAP: Record<string, string> = {
  '#': 'reservation_code',
  'reservasjonsnummer': 'reservation_number',
  'status': 'status',
  'periode': 'period_label',
  'navn': 'first_name',
  'etternavn': 'last_name',
  'fødselsdato': 'birth_date',
  'kjønn': 'gender',
  'deltatt tidligere': 'times_attended',
  'genser': 'sweater_size',
  'kioskpenger': 'kiosk_money',
  'venner': 'friends',
  'opplysninger': 'notes_info',
  'foresatte navn': 'guardian_first_name',
  'foresatte etternavn': 'guardian_last_name',
  'epost': 'guardian_email',
  'telefon': 'guardian_phone',
  'adresse': 'address',
  'postnummer': 'postal_code',
  'poststed': 'postal_city',
  'pris': 'price',
  'rabatt': 'discount',
  'forhåndsbetaling': 'prepayment',
  'betalingsstatus': 'payment_status',
  'betalingsreferanse': 'payment_reference',
  'fakturert': 'invoiced_date',
  'betalt': 'paid_date',
  'kansellert': 'cancelled_date',
  'bookingstidspunkt': 'booking_time',
  'plass bekreftet': 'seat_confirmed',
};

const NUMERIC_FIELDS = new Set(['times_attended', 'kiosk_money', 'price', 'discount', 'prepayment']);
const DATE_FIELDS = new Set(['birth_date', 'invoiced_date', 'paid_date', 'cancelled_date', 'seat_confirmed']);
const TIMESTAMP_FIELDS = new Set(['booking_time']);

function toCol(value: unknown, field: string): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (DATE_FIELDS.has(field)) return value.toISOString().slice(0, 10);
    if (TIMESTAMP_FIELDS.has(field)) return value.toISOString();
    return value.toISOString();
  }
  const s = String(value).trim();
  if (!s) return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (DATE_FIELDS.has(field)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : s;
  }
  if (TIMESTAMP_FIELDS.has(field)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : s;
  }
  return s;
}

function mapRow(headers: string[], cells: unknown[], periodId: string | null) {
  const row: Record<string, unknown> = { period_id: periodId };
  for (let i = 0; i < headers.length; i++) {
    const key = HEADER_MAP[headers[i]?.toString().trim().toLowerCase() || ''];
    if (!key) continue;
    row[key] = toCol(cells[i], key);
  }
  return row;
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: unknown[][] }> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows: unknown[][] = [];
  let headers: string[] = [];
  ws.eachRow((row, rowNumber) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, cell => {
      let v: unknown = cell.value;
      if (v && typeof v === 'object' && 'text' in (v as object)) v = (v as { text: string }).text;
      if (v && typeof v === 'object' && 'result' in (v as object)) v = (v as { result: unknown }).result;
      cells.push(v ?? null);
    });
    if (rowNumber === 1) headers = cells.map(c => String(c ?? ''));
    else rows.push(cells);
  });
  return { headers, rows };
}

function parsePaste(text: string): { headers: string[]; rows: unknown[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).map(l => l.split('\t'));
  return { headers, rows };
}

export function BookingImportCard({ periodId, onImported }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const [pasteText, setPasteText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const upsert = async (mapped: Record<string, unknown>[]) => {
    if (!periodId) {
      showError('Ingen aktiv periode');
      return;
    }
    // Force the chosen period on every row
    const rows = mapped.map(r => ({ ...r, period_id: periodId }));

    if (replaceExisting) {
      const { error: delErr } = await supabase
        .from('participant_bookings')
        .delete()
        .eq('period_id', periodId);
      if (delErr) {
        console.error('Delete failed:', delErr);
        showError(`Kunne ikke slette eksisterende: ${delErr.message}`);
        return;
      }
    }

    // Insert in chunks for safety
    const CHUNK = 100;
    let saved = 0;
    let firstError: string | null = null;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from('participant_bookings')
        .insert(slice as never, { count: 'exact' });
      if (error) {
        console.error('Insert chunk failed:', error, slice[0]);
        if (!firstError) firstError = error.message;
      } else {
        saved += count ?? slice.length;
      }
    }
    if (firstError) showError(`${saved} lagret. Feil: ${firstError}`);
    else showSuccess(`${saved} rader importert`);
    onImported();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const { headers, rows } = await parseFile(file);
      const mapped = rows.map(r => mapRow(headers, r, periodId)).filter(r => r.first_name || r.last_name || r.reservation_code);
      if (!mapped.length) { showError('Fant ingen rader'); return; }
      await upsert(mapped);
    } catch (err) {
      console.error(err);
      showError('Klarte ikke lese filen');
    } finally { setIsImporting(false); }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setIsImporting(true);
    try {
      const { headers, rows } = parsePaste(pasteText);
      const mapped = rows.map(r => mapRow(headers, r, periodId)).filter(r => r.first_name || r.last_name || r.reservation_code);
      if (!mapped.length) { showError('Fant ingen rader'); return; }
      await upsert(mapped);
      setPasteText('');
    } catch (err) {
      console.error(err);
      showError('Klarte ikke parse teksten');
    } finally { setIsImporting(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Importer booking-info</CardTitle>
        <CardDescription>Last opp Excel eller lim inn rader. Lagres til aktiv periode.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Checkbox
            id="replace-existing"
            checked={replaceExisting}
            onCheckedChange={v => setReplaceExisting(v === true)}
          />
          <label htmlFor="replace-existing" className="cursor-pointer">
            Erstatt eksisterende rader i valgt periode
          </label>
        </div>
        <Tabs defaultValue="file">
          <TabsList>
            <TabsTrigger value="file">Last opp fil</TabsTrigger>
            <TabsTrigger value="paste">Lim inn</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="mt-4">
            <label className="inline-flex">
              <input type="file" accept=".xlsx,.xltx" onChange={handleFile} className="hidden" disabled={isImporting || !periodId} />
              <Button asChild disabled={isImporting || !periodId}>
                <span>{isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Velg .xlsx-fil</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-2">Forventer kolonneoverskrifter som i booking-eksport (Navn, Foresatte navn, Telefon osv.).</p>
          </TabsContent>
          <TabsContent value="paste" className="mt-4 space-y-3">
            <Textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Lim inn rader fra Excel her (inkluder header-raden)"
              rows={6}
            />
            <Button onClick={handlePaste} disabled={isImporting || !periodId || !pasteText.trim()}>
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Importer
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}