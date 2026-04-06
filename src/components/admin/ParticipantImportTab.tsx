import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
  MapPin
} from 'lucide-react';
import { ParticipantEditDialog } from './ParticipantEditDialog';
import { hapticSuccess, hapticWarning, hapticError } from '@/lib/capacitorHaptics';

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
    const lowered = cabinField.toLowerCase().trim();
    
    // Check for room suffix
    if (lowered.endsWith(' venstre')) {
      return {
        cabinName: cabinField.slice(0, -8).trim(),
        room: 'venstre'
      };
    }
    if (lowered.endsWith(' høyre')) {
      return {
        cabinName: cabinField.slice(0, -6).trim(),
        room: 'høyre'
      };
    }
    
    return { cabinName: cabinField.trim(), room: null };
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
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header - handle both comma and semicolon as separators
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    
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
    const infoIdx = headers.findIndex(h => h === 'info' || h === 'kommentar' || h === 'kommentarer');
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

    return lines.slice(1).map((line, idx) => {
      const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      
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
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setParsedData(parsed);
      setImportResult(null);
    };
    reader.readAsText(file);
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
                  <td className="py-2 px-3 text-muted-foreground">Hyttenavn (inkl. rom: "Marcusbu bak venstre") <Badge variant="destructive" className="ml-1 text-[10px]">Påkrevd</Badge></td>
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
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter navn eller hytte..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  className="pl-10"
                />
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
