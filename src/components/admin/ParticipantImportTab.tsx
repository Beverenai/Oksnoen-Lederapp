import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Upload, 
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Users,
  ChevronDown,
  Search,
  Edit2,
  MapPin,
  ClipboardPaste
} from 'lucide-react';
import { ParticipantEditDialog } from './ParticipantEditDialog';
import { hapticSuccess, hapticWarning, hapticError } from '@/lib/capacitorHaptics';
import { GiftCardImportCard } from './GiftCardImportCard';
import { ThumbnailsGeneratorCard } from './ThumbnailsGeneratorCard';

interface ImportProgress {
  status: 'idle' | 'running' | 'done' | 'error';
  processed: number;
  total: number;
  created: number;
  updated: number;
  activitiesAdded: number;
  errors: string[];
}

interface Cabin {
  id: string;
  name: string;
}

interface ParsedParticipant {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  cabinName: string;
  room: string | null;
  timesAttended: number;
  info: string;
  imageUrl: string | null;
  hasArrived: boolean;
  activities: { activity: string; count: number }[];
  valid: boolean;
  error?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  activitiesAdded: number;
  errors: string[];
}

interface ParticipantWithCabin {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  birth_date: string | null;
  cabin_id: string | null;
  room: string | null;
  times_attended: number | null;
  notes: string | null;
  has_arrived: boolean | null;
  cabin: { id: string; name: string } | null;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Decode CSV bytes, trying UTF-8 (with and without BOM), then windows-1252.
// Also repairs common double-encoded mojibake like "Ã¸" -> "ø".
function decodeCsvBytes(bytes: Uint8Array): string {
  // Strip UTF-8 BOM
  let buf = bytes;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    buf = bytes.subarray(3);
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }

  // Repair double-encoded UTF-8 (e.g. "HÃ¸yre" -> "Høyre")
  if (/Ã[\u0080-\u00BF]/.test(text)) {
    try {
      const reencoded = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) reencoded[i] = text.charCodeAt(i) & 0xff;
      const fixed = new TextDecoder('utf-8', { fatal: true }).decode(reencoded);
      if (!fixed.includes('\uFFFD')) text = fixed;
    } catch {
      // keep original
    }
  }

  return text;
}

export function ParticipantImportTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');

  // Participant list state
  const [allParticipants, setAllParticipants] = useState<ParticipantWithCabin[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithCabin | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Poll import progress
  const pollProgress = useCallback(async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'participant_import_progress')
      .maybeSingle();

    if (data?.value) {
      try {
        const progress = JSON.parse(data.value) as ImportProgress;
        setImportProgress(progress);

        if (progress.status === 'running') {
          setIsImporting(true);
        } else if (progress.status === 'done' || progress.status === 'error') {
          setIsImporting(false);
          // Convert to ImportResult for display
          setImportResult({
            created: progress.created,
            updated: progress.updated,
            activitiesAdded: progress.activitiesAdded,
            errors: progress.errors
          });
          // Clear parsed data on success
          if (progress.status === 'done' && progress.errors.length === 0) {
            setParsedData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            showSuccess(`Import fullført! ${progress.created} nye, ${progress.updated} oppdatert, ${progress.activitiesAdded} aktiviteter`);
          } else if (progress.status === 'error') {
            showError('Import feilet');
          } else {
            hapticWarning();
            showInfo(`Import delvis fullført med ${progress.errors.length} feil`);
          }
          loadData();
        }
        return progress.status;
      } catch (e) {
        console.error('Failed to parse progress:', e);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    loadData();
    // Check if there's an ongoing import
    pollProgress();
  }, [pollProgress]);

  // Polling interval when import is running
  useEffect(() => {
    if (!isImporting) return;

    const interval = setInterval(() => {
      pollProgress();
    }, 2000);

    return () => clearInterval(interval);
  }, [isImporting, pollProgress]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cabinsRes, participantsRes] = await Promise.all([
        supabase.from('cabins').select('id, name').order('sort_order'),
        supabase.from('participants').select('*', { count: 'exact', head: true })
      ]);

      setCabins(cabinsRes.data || []);
      setParticipantCount(participantsRes.count || 0);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllParticipants = async () => {
    setIsLoadingParticipants(true);
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('id, first_name, last_name, name, birth_date, cabin_id, room, times_attended, notes, has_arrived, cabin:cabins(id, name)')
        .order('name');

      if (error) throw error;
      setAllParticipants(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
      showError('Kunne ikke laste deltakere');
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  useEffect(() => {
    if (isParticipantsOpen && allParticipants.length === 0) {
      loadAllParticipants();
    }
  }, [isParticipantsOpen]);

  const filteredParticipants = allParticipants.filter((p) => {
    const searchLower = participantSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.cabin?.name?.toLowerCase().includes(searchLower) ||
      p.room?.toLowerCase().includes(searchLower)
    );
  });

  const handleParticipantSaved = () => {
    loadAllParticipants();
    loadData();
  };

  const parseCabinField = (cabinField: string): { cabinName: string; room: string | null } => {
    // Collapse internal whitespace and trim
    const cleaned = cabinField.replace(/\s+/g, ' ').trim();
    const lowered = cleaned.toLowerCase();

    let cabinName = cleaned;
    let room: string | null = null;

    // Check for room suffix (venstre / høyre)
    if (lowered.endsWith(' venstre')) {
      cabinName = cleaned.slice(0, -8).trim();
      room = 'venstre';
    } else if (lowered.endsWith(' høyre')) {
      cabinName = cleaned.slice(0, -6).trim();
      room = 'høyre';
    }

    // Normalize Seilern variants: "Seileren X" / "seilern x" → "Seilern <Sub>"
    const seilernSubs = ['haui', 'halua', 'maui', 'tipi', 'oahu', 'honolulu', 'hawaii', 'waikikii'];
    const cabinLower = cabinName.toLowerCase();
    const seilernMatch = cabinLower.match(/^seiler(?:e)?n\s+(.+)$/);
    if (seilernMatch) {
      const subRaw = seilernMatch[1].trim().toLowerCase();
      const canonicalSub = seilernSubs.find(s => s === subRaw);
      if (canonicalSub) {
        cabinName = 'Seilern ' + canonicalSub.charAt(0).toUpperCase() + canonicalSub.slice(1);
      }
    } else if (cabinLower === 'seilern' || cabinLower === 'seileren') {
      cabinName = 'Seileren';
    }

    return { cabinName, room };
  };

  // Helper to parse activity value (handles "Ja", "1", "2", "1 plass!", etc.)
  const parseActivityValue = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    const v = value.trim().toLowerCase();
    if (v === 'ja' || v === 'ja!' || v === '1 plass!' || v === '1. plass' || v === '2 plass!' || v === '2. plass' || v === '3 plass!' || v === '3. plass') return 1;
    const num = parseInt(v);
    return isNaN(num) ? (v.length > 0 ? 1 : 0) : num;
  };

  const parseCSV = (text: string): ParsedParticipant[] => {
    // Detect separator from the first non-empty line (without breaking quoted newlines)
    const firstLineEnd = text.search(/\r?\n/);
    const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
    const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    // Proper CSV tokenizer that respects double-quoted fields with embedded newlines and "" escapes
    const records: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === separator) {
          row.push(field); field = '';
        } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++;
          row.push(field); field = '';
          if (row.some(c => c.trim().length > 0)) records.push(row);
          row = [];
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      if (row.some(c => c.trim().length > 0)) records.push(row);
    }
    if (records.length < 2) return [];

    const headers = records[0].map(h => h.trim().toLowerCase());
    
    // Find column indices for basic fields
    const firstNameIdx = headers.findIndex(h => h.includes('fornavn'));
    const lastNameIdx = headers.findIndex(h => h.includes('etternavn'));
    const birthDateIdx = headers.findIndex(h => h.includes('født') || h.includes('fodt') || h === 'dato');
    const cabinIdx = headers.findIndex(h => h.includes('hytte'));
    const timesIdx = headers.findIndex(h => 
      h.includes('deltatt') || 
      h.includes('tidligere') || 
      h.includes('ganger') ||
      h.includes('antall') ||
      h.includes('år på') ||
      h === 'x' ||
      h === 'gang'
    );
    
    // Debug logging for column detection
    console.log('CSV Headers found:', headers);
    console.log('Times column index:', timesIdx, timesIdx >= 0 ? `(found: "${headers[timesIdx]}")` : '(not found)');
    const infoIdx = headers.findIndex(h => h === 'info' || h === 'kommentar' || h === 'kommentarer' || h === 'notater' || h === 'notat');
    const imageIdx = headers.findIndex(h => h === 'bilde' || h === 'image' || h === 'image_url');
    const arrivedIdx = headers.findIndex(h => h.includes('ankommet') || h.includes('arrived'));

    // Find activity column indices
    const activityColumns: { name: string; idx: number }[] = [];
    const activityNames = ['tube', 'tretten', 'taubane', 'vannski', 'triatlon', 'klatring', 'skrikern', 'åtte', 'ti', 'bruskasse', 'rappis', 'outboard', 'pil & bue', 'styrkeprøven'];
    headers.forEach((h, idx) => {
      const match = activityNames.find(a => h === a || h.includes(a));
      if (match) {
        activityColumns.push({ name: match, idx });
      }
    });

    return records.slice(1).map((values) => {
      values = values.map(v => v.trim());
      
      const firstName = firstNameIdx >= 0 ? values[firstNameIdx] || '' : '';
      const lastName = lastNameIdx >= 0 ? values[lastNameIdx] || '' : '';
      const birthDateRaw = birthDateIdx >= 0 ? values[birthDateIdx] || '' : '';
      const cabinRaw = cabinIdx >= 0 ? values[cabinIdx] || '' : '';
      const timesRaw = timesIdx >= 0 ? values[timesIdx] || '0' : '0';
      const info = infoIdx >= 0 ? values[infoIdx] || '' : '';
      const imageUrl = imageIdx >= 0 ? values[imageIdx] || null : null;
      const arrivedRaw = arrivedIdx >= 0 ? values[arrivedIdx] || '' : '';

      const { cabinName, room } = parseCabinField(cabinRaw);
      
      // Parse birth date
      let birthDate: string | null = null;
      if (birthDateRaw) {
        // Try different formats
        const dateMatch = birthDateRaw.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          birthDate = birthDateRaw;
        } else {
          // Try DD.MM.YYYY or DD/MM/YYYY
          const altMatch = birthDateRaw.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
          if (altMatch) {
            birthDate = `${altMatch[3]}-${altMatch[2].padStart(2, '0')}-${altMatch[1].padStart(2, '0')}`;
          }
        }
      }

      // Parse times attended
      const timesAttended = parseInt(timesRaw) || 0;

      // Parse has arrived
      const hasArrived = arrivedRaw.toLowerCase() === 'true' || arrivedRaw === '1' || arrivedRaw.toLowerCase() === 'ja';

      // Parse activities
      const activities: { activity: string; count: number }[] = [];
      activityColumns.forEach(({ name, idx }) => {
        const rawValue = values[idx] || '';
        
        // Special handling for Skrikern
        if (name === 'skrikern') {
          const v = rawValue.toLowerCase().trim();
          if (v === 'store' || v === 'begge') {
            activities.push({ activity: 'Skrikern', count: 2 }); // Both ways
          } else if (v === 'lille' || v === '1' || v === 'ja') {
            activities.push({ activity: 'Skrikern', count: 1 }); // One way
          }
        } 
        // Special handling for Styrkeprøven
        else if (name === 'styrkeprøven') {
          const v = rawValue.toLowerCase().trim();
          if (v === 'store') {
            activities.push({ activity: 'Store Styrkeprøven', count: 1 });
          } else if (v === 'lille') {
            activities.push({ activity: 'Lille Styrkeprøven', count: 1 });
          } else if (v && !v.startsWith('http')) {
            // If it has a value that's not a URL, try to parse it
            const count = parseActivityValue(v);
            if (count > 0) activities.push({ activity: 'Styrkeprøven', count });
          }
        }
        else {
          const count = parseActivityValue(rawValue);
          if (count > 0) {
            // Map activity names to proper display names
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            activities.push({ activity: displayName, count });
          }
        }
      });

      // Validation
      const valid = firstName.length > 0 && cabinName.length > 0;
      const error = !valid 
        ? (firstName.length === 0 ? 'Mangler fornavn' : 'Mangler hytte')
        : undefined;

      return {
        firstName,
        lastName,
        birthDate,
        cabinName,
        room,
        timesAttended,
        info,
        imageUrl,
        hasArrived,
        activities,
        valid,
        error
      };
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const text = decodeCsvBytes(bytes);
      if (text.includes('\uFFFD')) {
        showError('Filen inneholder ugjenkjennelige tegn (�). Eksporter CSV-en på nytt som UTF-8 og prøv igjen.');
        return;
      }
      const parsed = parseCSV(text);
      setParsedData(parsed);
      setImportResult(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // Convert pasted text (TSV from spreadsheet OR newline-per-field from PDF copy)
  // into a tab-separated string the CSV parser understands.
  const normalizePastedText = (raw: string): string => {
    const text = raw.replace(/\r\n?/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';

    // If any line already has tabs (or commas/semicolons), assume it's table-shaped already.
    if (lines.some(l => l.includes('\t'))) return lines.join('\n');
    if (lines[0].includes(';') || lines[0].includes(',')) return lines.join('\n');

    // Newline-per-field format: detect consecutive header lines at the top.
    const headerNames = [
      'fornavn', 'etternavn', 'født', 'fodt', 'hytte',
      'deltatt tidligere', 'tidligere', 'notater', 'notat',
      'info', 'kommentar', 'bilde', 'har ankommet', 'ankommet'
    ];
    let headerEnd = 0;
    while (headerEnd < lines.length && headerNames.includes(lines[headerEnd].toLowerCase())) {
      headerEnd++;
    }
    if (headerEnd < 2) return lines.join('\n');

    const headers = lines.slice(0, headerEnd);
    const data = lines.slice(headerEnd);
    const rows: string[] = [headers.join('\t')];
    for (let i = 0; i < data.length; i += headers.length) {
      const chunk = data.slice(i, i + headers.length);
      while (chunk.length < headers.length) chunk.push('');
      rows.push(chunk.join('\t'));
    }
    return rows.join('\n');
  };

  const handlePasteImport = () => {
    if (!pastedText.trim()) {
      showError('Lim inn data først');
      return;
    }
    // First try blob parser (handles text copied from rendered tables / PDFs
    // where all newlines/tabs are lost and rows are concatenated).
    const blobRows = parseConcatenatedBlob(pastedText);
    if (blobRows.length >= 3) {
      setParsedData(blobRows);
      setImportResult(null);
      showInfo(`Tolket ${blobRows.length} rader fra sammensmeltet tekst`);
      return;
    }
    const normalized = normalizePastedText(pastedText);
    const parsed = parseCSV(normalized);
    if (parsed.length === 0) {
      // Fall back to blob even if it gave <3 rows
      if (blobRows.length > 0) {
        setParsedData(blobRows);
        setImportResult(null);
        return;
      }
      showError('Kunne ikke tolke innholdet. Sjekk at det er overskrifter og data.');
      return;
    }
    setParsedData(parsed);
    setImportResult(null);
  };

  // Parse a single concatenated blob (no tabs / newlines between cells) where each
  // row is shaped: <Name><YYYY-MM-DD><digit(timesAttended)><CabinName><optional notes>
  // Uses the cabin list from the DB to anchor row boundaries.
  const parseConcatenatedBlob = (raw: string): ParsedParticipant[] => {
    if (!raw) return [];
    // Strip leading header tokens like "FornavnEtternavnFødtDeltatt tidligereHytteNotater"
    let text = raw.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    text = text.replace(
      /^\s*(?:Fornavn|Etternavn|F(?:ø|o)dt|Deltatt\s+tidligere|Tidligere|Deltatt|Hytte|Notater|Notat|Kommentar(?:er)?|Info|Bilde|Har\s+ankommet|Ankommet|\s)+/i,
      ''
    );

    if (cabins.length === 0) return [];
    const cabinPatterns = cabins
      .map(c => c.name)
      .flatMap(n => {
        const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return [`${esc}\\s+venstre`, `${esc}\\s+h(?:ø|o)yre`, esc];
      })
      .sort((a, b) => b.length - a.length);
    if (cabinPatterns.length === 0) return [];

    const cabinAlt = cabinPatterns.join('|');
    const re = new RegExp(
      `([\\p{Lu}][\\p{L} .'\\-]*?)(\\d{4}-\\d{2}-\\d{2})\\s*(\\d+)\\s*(${cabinAlt})`,
      'gu'
    );

    type Hit = { idx: number; end: number; name: string; date: string; times: string; cabin: string };
    const hits: Hit[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({
        idx: m.index,
        end: m.index + m[0].length,
        name: m[1].trim(),
        date: m[2],
        times: m[3],
        cabin: m[4].replace(/\s+/g, ' '),
      });
    }
    if (hits.length === 0) return [];

    return hits.map((h, i) => {
      const nextIdx = i + 1 < hits.length ? hits[i + 1].idx : text.length;
      const notes = text.slice(h.end, nextIdx).trim();

      // Split full name into first / last. Prefer existing space; else camel-case split.
      const fullName = h.name.replace(/\s+/g, ' ').trim();
      let firstName = fullName;
      let lastName = '';
      if (fullName.includes(' ')) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      } else {
        const camel = fullName.match(/^(.*[\p{Ll}])([\p{Lu}].*)$/u);
        if (camel) {
          firstName = camel[1];
          lastName = camel[2];
        }
      }

      const { cabinName, room } = parseCabinField(h.cabin);
      const timesAttended = parseInt(h.times, 10) || 0;
      const valid = firstName.length > 0 && cabinName.length > 0;
      return {
        firstName,
        lastName,
        birthDate: h.date,
        cabinName,
        room,
        timesAttended,
        info: notes,
        imageUrl: null,
        hasArrived: false,
        activities: [],
        valid,
        error: valid ? undefined : 'Mangler navn eller hytte',
      };
    });
  };

  const importParticipants = async () => {
    const validParticipants = parsedData.filter(p => p.valid);
    if (validParticipants.length === 0) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress(null);

    try {
      // Reset progress in app_config
      await supabase
        .from('app_config')
        .upsert({
          key: 'participant_import_progress',
          value: JSON.stringify({ 
            status: 'idle', 
            processed: 0, 
            total: validParticipants.length,
            created: 0,
            updated: 0,
            activitiesAdded: 0,
            errors: []
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      // Prepare data for edge function (only valid participants, without valid/error fields)
      const participantsToImport = validParticipants.map(p => ({
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        cabinName: p.cabinName,
        room: p.room,
        timesAttended: p.timesAttended,
        info: p.info,
        imageUrl: p.imageUrl,
        hasArrived: p.hasArrived,
        activities: p.activities
      }));

      // Call edge function to start background import
      const { data, error } = await supabase.functions.invoke('import-participants-background', {
        body: { participants: participantsToImport }
      });

      if (error) {
        console.error('Error calling import function:', error);
        showError('Kunne ikke starte import');
        setIsImporting(false);
        return;
      }

      showInfo(`Import startet for ${validParticipants.length} deltakere. Du kan navigere bort - importen fortsetter i bakgrunnen.`);
      
      // Start polling for progress
      pollProgress();
    } catch (error) {
      console.error('Import error:', error);
      showError('Kunne ikke starte import');
      setIsImporting(false);
    }
  };

  const deleteAllParticipants = async () => {
    hapticWarning();
    if (!confirm('⚠️ ADVARSEL: Dette vil slette ALLE deltakere og tilhørende data (aktiviteter, helsenotater, etc.).\n\nDette kan ikke angres. Er du sikker?')) return;
    if (!confirm('Siste sjanse: Er du HELT sikker på at du vil slette alle deltakere?')) return;

    setIsDeleting(true);
    try {
      // Delete related data first (activities, health info/notes/events) so a new period starts clean
      await supabase.from('participant_activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('participant_health_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('participant_health_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('participant_health_info').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const { error } = await supabase
        .from('participants')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      loadData();
      showSuccess('Alle deltakere er slettet');
    } catch (error) {
      console.error('Error deleting participants:', error);
      showError('Kunne ikke slette deltakere');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const validCount = parsedData.filter(p => p.valid).length;
  const invalidCount = parsedData.filter(p => !p.valid).length;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Deltakere ({participantCount})
          </CardTitle>
          <CardDescription>
            Importer deltakere fra CSV-fil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="destructive" 
              onClick={deleteAllParticipants}
              disabled={isDeleting || participantCount === 0}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Slett alle deltakere
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Bruk denne knappen for å starte en ny periode. Alle eksisterende deltakere vil bli slettet.
          </p>
        </CardContent>
      </Card>

      <GiftCardImportCard onImported={loadData} />
      <ThumbnailsGeneratorCard />

      {/* CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importer fra CSV
          </CardTitle>
          <CardDescription>
            Last opp en CSV-fil med deltakere
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium mb-2">Støttede kolonner:</p>
              <p className="text-xs text-muted-foreground mb-1">Fornavn, Etternavn, Dato/Født, Hytte, Bilde, Har ankommet, Kommentar</p>
              <p className="text-xs text-muted-foreground">Aktiviteter: Tube, Tretten, Taubane, Vannski, Triatlon, Klatring, Skrikern, Åtte, Ti, Bruskasse, Rappis, Outboard, Pil & Bue, Styrkeprøven</p>
              <p className="text-muted-foreground mt-2 text-xs">
                Eksporter fra Numbers som CSV og last opp her. Aktiviteter støtter "Ja", tall (1,2,3), og spesialverdier som "Store"/"Lille" for Skrikern/Styrkeprøven.
              </p>
            </div>
          </div>

          {/* Paste import */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium text-sm">Eller lim inn data</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Lim inn fra Numbers/Excel (tab-separert) eller fra PDF (én verdi per linje). Første rader må være kolonneoverskrifter, f.eks. Fornavn, Etternavn, Født, Hytte, Deltatt tidligere, Notater.
            </p>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={'Fornavn\nEtternavn\nFødt\nHytte\nDeltatt tidligere\nNotater\nCornelius\nNix\n2011-01-01\nKnoll venstre\n2\n'}
              rows={6}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handlePasteImport}
                disabled={isImporting || !pastedText.trim()}
              >
                <ClipboardPaste className="w-4 h-4 mr-2" />
                Tolk innlimt data
              </Button>
              {pastedText && (
                <Button variant="ghost" onClick={() => setPastedText('')} disabled={isImporting}>
                  Tøm
                </Button>
              )}
            </div>
          </div>

          {/* Progress indicator when importing */}
          {isImporting && importProgress && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  Importerer deltakere i bakgrunnen...
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Du kan navigere bort fra denne siden - importen fortsetter i bakgrunnen.
              </p>
              <Progress 
                value={(importProgress.processed / importProgress.total) * 100} 
                className="h-2"
              />
              <p className="text-sm text-muted-foreground">
                {importProgress.processed} av {importProgress.total} deltakere prosessert
                {importProgress.created > 0 && ` • ${importProgress.created} opprettet`}
                {importProgress.updated > 0 && ` • ${importProgress.updated} oppdatert`}
              </p>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && !isImporting && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    {validCount} gyldige
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      {invalidCount} ugyldige
                    </Badge>
                  )}
                </div>
                <Button 
                  onClick={importParticipants} 
                  disabled={isImporting || validCount === 0}
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importer {validCount} deltakere
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Navn</th>
                      <th className="text-left py-2 px-3">Hytte</th>
                      <th className="text-left py-2 px-3">Bilde</th>
                      <th className="text-left py-2 px-3">Aktiviteter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedData.slice(0, 50).map((p, idx) => (
                      <tr key={idx} className={!p.valid ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <td className="py-2 px-3">
                          {p.valid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <span title={p.error}>
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">{p.firstName} {p.lastName}</td>
                        <td className="py-2 px-3">{p.cabinName} {p.room && <Badge variant="outline" className="ml-1">{p.room}</Badge>}</td>
                        <td className="py-2 px-3">
                          {p.imageUrl ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2 px-3">{p.activities.reduce((sum, a) => sum + a.count, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 50 && (
                  <p className="text-center text-muted-foreground py-2 bg-muted">
                    ...og {parsedData.length - 50} flere
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`p-4 rounded-lg ${importResult.errors.length > 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
              <p className="font-medium mb-2">
                Import resultat: {importResult.created} opprettet, {importResult.updated} oppdatert, {importResult.activitiesAdded} aktiviteter lagt til
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Feil ({importResult.errors.length}):</p>
                  <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Mapping Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            CSV Felt-mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">CSV-kolonne</th>
                  <th className="text-left py-2 px-3 font-medium">Beskrivelse</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Fornavn</code></td>
                  <td className="py-2 px-3 text-muted-foreground">Deltakerens fornavn <Badge variant="destructive" className="ml-1 text-[10px]">Påkrevd</Badge></td>
                </tr>
                <tr>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Etternavn</code></td>
                  <td className="py-2 px-3 text-muted-foreground">Deltakerens etternavn</td>
                </tr>
                <tr>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Født</code></td>
                  <td className="py-2 px-3 text-muted-foreground">Fødselsdato (YYYY-MM-DD eller DD.MM.YYYY)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Hytte</code></td>
                  <td className="py-2 px-3 text-muted-foreground">Hyttenavn (inkl. rom: "Marcusbu bak venstre"). Seilern-hyttene godtas som "Seilern Haui"/"Seileren Maui" osv. <Badge variant="destructive" className="ml-1 text-[10px]">Påkrevd</Badge></td>
                </tr>
                <tr>
                  <td className="py-2 px-3">
                    <code className="text-xs bg-muted px-1 rounded">Deltatt tidligere</code>
                    <span className="text-muted-foreground text-xs ml-1">(eller "ganger", "antall", "år på", "x", "gang")</span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">Antall år deltakeren har vært på Oksnøen</td>
                </tr>
                <tr>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Info</code></td>
                  <td className="py-2 px-3 text-muted-foreground">Helseinformasjon (kun synlig for sykepleier/admin)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* All Participants - Collapsible */}
      <Collapsible open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Alle deltakere ({participantCount})
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${isParticipantsOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <CardDescription>
                Klikk for å se og redigere alle deltakere
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Search + Add */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Søk etter navn eller hytte..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={() => {
                    setSelectedParticipant(null);
                    setIsEditDialogOpen(true);
                  }}
                  className="shrink-0"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Ny deltaker
                </Button>
              </div>

              {isLoadingParticipants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
                  {filteredParticipants.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {participantSearch ? 'Ingen treff på søket' : 'Ingen deltakere registrert'}
                    </div>
                  ) : (
                    filteredParticipants.map((p) => {
                      const age = calculateAge(p.birth_date);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedParticipant(p);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{p.name}</span>
                              {age !== null && (
                                <span className="text-sm text-muted-foreground">({age} år)</span>
                              )}
                              {p.has_arrived && (
                                <Badge variant="default" className="bg-green-500 text-[10px]">Ankommet</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {p.cabin && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {p.cabin.name}
                                  {p.room && ` (${p.room})`}
                                </span>
                              )}
                              {(p.times_attended ?? 0) > 0 && (
                                <span>• {p.times_attended}x deltatt</span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {filteredParticipants.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Viser {filteredParticipants.length} av {allParticipants.length} deltakere
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Dialog */}
      <ParticipantEditDialog
        participant={selectedParticipant}
        cabins={cabins}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSaved={handleParticipantSaved}
      />
    </div>
  );
}
