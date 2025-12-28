import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

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

export function ParticipantImportTab() {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cabinsRes, participantsRes] = await Promise.all([
        supabase.from('cabins').select('id, name'),
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
    const timesIdx = headers.findIndex(h => h.includes('deltatt') || h.includes('tidligere'));
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
    if (parsedData.length === 0) return;

    setIsImporting(true);
    setImportResult(null);
    const result: ImportResult = { created: 0, updated: 0, activitiesAdded: 0, errors: [] };

    try {
      // Create a map of cabin names to IDs
      const cabinMap = new Map(cabins.map(c => [c.name.toLowerCase(), c.id]));
      
      // Track cabins that need to be created
      const missingCabins = new Set<string>();
      parsedData.forEach(p => {
        if (p.valid && !cabinMap.has(p.cabinName.toLowerCase())) {
          missingCabins.add(p.cabinName);
        }
      });

      // Create missing cabins
      if (missingCabins.size > 0) {
        const maxSortOrder = cabins.length > 0 
          ? Math.max(...cabins.map(c => cabins.indexOf(c))) 
          : 0;
        
        const cabinsToCreate = Array.from(missingCabins).map((name, idx) => ({
          name,
          sort_order: maxSortOrder + idx + 1
        }));

        const { data: newCabins, error } = await supabase
          .from('cabins')
          .insert(cabinsToCreate)
          .select();

        if (error) {
          result.errors.push(`Kunne ikke opprette hytter: ${error.message}`);
        } else if (newCabins) {
          newCabins.forEach(c => cabinMap.set(c.name.toLowerCase(), c.id));
        }
      }

      // Import participants
      for (const participant of parsedData.filter(p => p.valid)) {
        const cabinId = cabinMap.get(participant.cabinName.toLowerCase());
        if (!cabinId) {
          result.errors.push(`${participant.firstName} ${participant.lastName}: Fant ikke hytte "${participant.cabinName}"`);
          continue;
        }

        const fullName = `${participant.firstName} ${participant.lastName}`.trim();
        
        // Check if participant exists (by name + birth date)
        let existingParticipant = null;
        if (participant.birthDate) {
          const { data } = await supabase
            .from('participants')
            .select('id')
            .eq('birth_date', participant.birthDate)
            .ilike('name', `%${participant.firstName}%`)
            .maybeSingle();
          existingParticipant = data;
        }

        if (existingParticipant) {
          // Update existing
          const updateData = {
            name: fullName,
            first_name: participant.firstName,
            last_name: participant.lastName,
            cabin_id: cabinId,
            room: participant.room,
            times_attended: participant.timesAttended,
            has_arrived: participant.hasArrived,
            image_url: participant.imageUrl || undefined,
            notes: participant.info || undefined
          };

          const { error } = await supabase
            .from('participants')
            .update(updateData)
            .eq('id', existingParticipant.id);

          if (error) {
            result.errors.push(`${fullName}: ${error.message}`);
          } else {
            result.updated++;
            
            // Update or create health info
            if (participant.info) {
              await supabase
                .from('participant_health_info')
                .upsert({
                  participant_id: existingParticipant.id,
                  info: participant.info
                }, { onConflict: 'participant_id' });
            }

            // Add activities
            if (participant.activities.length > 0) {
              // First delete existing activities
              await supabase
                .from('participant_activities')
                .delete()
                .eq('participant_id', existingParticipant.id);

              // Insert new activities
              const activitiesToInsert: { participant_id: string; activity: string }[] = [];
              for (const act of participant.activities) {
                for (let i = 0; i < act.count; i++) {
                  activitiesToInsert.push({
                    participant_id: existingParticipant.id,
                    activity: act.activity
                  });
                }
              }
              if (activitiesToInsert.length > 0) {
                await supabase.from('participant_activities').insert(activitiesToInsert);
                result.activitiesAdded += activitiesToInsert.length;
              }
            }
          }
        } else {
          // Create new
          const insertData = {
            name: fullName,
            first_name: participant.firstName,
            last_name: participant.lastName,
            birth_date: participant.birthDate,
            cabin_id: cabinId,
            room: participant.room,
            times_attended: participant.timesAttended,
            has_arrived: participant.hasArrived,
            image_url: participant.imageUrl || null,
            notes: participant.info || null
          };

          const { data: newParticipant, error } = await supabase
            .from('participants')
            .insert(insertData)
            .select('id')
            .single();

          if (error) {
            result.errors.push(`${fullName}: ${error.message}`);
          } else {
            result.created++;
            
            // Create health info if provided
            if (participant.info && newParticipant) {
              await supabase
                .from('participant_health_info')
                .insert({
                  participant_id: newParticipant.id,
                  info: participant.info
                });
            }

            // Add activities
            if (participant.activities.length > 0 && newParticipant) {
              const activitiesToInsert: { participant_id: string; activity: string }[] = [];
              for (const act of participant.activities) {
                for (let i = 0; i < act.count; i++) {
                  activitiesToInsert.push({
                    participant_id: newParticipant.id,
                    activity: act.activity
                  });
                }
              }
              if (activitiesToInsert.length > 0) {
                await supabase.from('participant_activities').insert(activitiesToInsert);
                result.activitiesAdded += activitiesToInsert.length;
              }
            }
          }
        }
      }

      setImportResult(result);
      loadData();
      
      if (result.errors.length === 0) {
        toast.success(`Import fullført! ${result.created} nye, ${result.updated} oppdatert, ${result.activitiesAdded} aktiviteter`);
        setParsedData([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.warning(`Import delvis fullført med ${result.errors.length} feil`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Kunne ikke importere deltakere');
    } finally {
      setIsImporting(false);
    }
  };

  const deleteAllParticipants = async () => {
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
      toast.success('Alle deltakere er slettet');
    } catch (error) {
      console.error('Error deleting participants:', error);
      toast.error('Kunne ikke slette deltakere');
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

          {/* Preview */}
          {parsedData.length > 0 && (
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
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Deltatt tidligere</code></td>
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
    </div>
  );
}
