import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Save, Loader2, Download, Plus, Trash2, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { nb } from 'date-fns/locale';
import { hapticSuccess } from '@/lib/capacitorHaptics';

interface Participant {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  cabin?: { name: string } | null;
  birth_date?: string | null;
  image_url?: string | null;
}

interface NoteEntry {
  text: string;
  timestamp: string;
}

interface ReportSection {
  participantId: string;
  notes: NoteEntry[];
}

interface NurseReportEditorProps {
  participants: Participant[];
}

export function NurseReportEditor({ participants }: NurseReportEditorProps) {
  const { leader } = useAuth();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // @-mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionInputRef = useRef<HTMLInputElement>(null);

  // Per-section new note inputs
  const [newNoteTexts, setNewNoteTexts] = useState<Record<string, string>>({});

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load or create report on mount
  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const { data: reports, error } = await supabase
        .from('nurse_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (reports && reports.length > 0) {
        const report = reports[0];
        setReportId(report.id);
        try {
          const parsed = JSON.parse(report.content || '[]');
          setSections(Array.isArray(parsed) ? parsed : []);
        } catch {
          setSections([]);
        }
      } else {
        // Create a new report
        const { data, error: createErr } = await supabase
          .from('nurse_reports')
          .insert({ content: '[]', created_by: leader?.id })
          .select()
          .single();
        if (createErr) throw createErr;
        setReportId(data.id);
        setSections([]);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Kunne ikke laste rapport');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReport = useCallback(async (sectionsToSave: ReportSection[]) => {
    if (!reportId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .update({
          content: JSON.stringify(sectionsToSave),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  const debouncedSave = useCallback((sectionsToSave: ReportSection[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveReport(sectionsToSave), 2000);
  }, [saveReport]);

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveReport(sections);
    await syncMentionData(sections);
    hapticSuccess();
    toast.success('Rapport lagret');
  };

  const syncMentionData = async (sectionsToSync: ReportSection[]) => {
    if (!reportId) return;
    try {
      // Delete existing mentions
      await supabase.from('nurse_report_mentions').delete().eq('report_id', reportId);

      // Insert new mentions
      const mentionEntries = sectionsToSync
        .filter(s => s.notes.length > 0)
        .map(s => ({
          report_id: reportId,
          participant_id: s.participantId,
          mention_text: s.notes.map(n => `[${n.timestamp}] ${n.text}`).join('\n'),
        }));

      if (mentionEntries.length > 0) {
        await supabase.from('nurse_report_mentions').insert(mentionEntries);
      }

      // Sync to participant_health_notes
      for (const section of sectionsToSync) {
        if (section.notes.length === 0) continue;
        const noteContent = section.notes
          .map(n => `[Nurse ${n.timestamp}] ${n.text}`)
          .join('\n');

        await supabase.from('participant_health_notes').insert({
          participant_id: section.participantId,
          content: noteContent,
          created_by: leader?.id,
        });
      }
    } catch (error) {
      console.error('Error syncing mention data:', error);
    }
  };

  // Filtered participants for @-mention (exclude already added)
  const addedIds = new Set(sections.map(s => s.participantId));
  const filteredMentionParticipants = participants
    .filter(p =>
      !addedIds.has(p.id) &&
      p.name.toLowerCase().includes(mentionQuery.toLowerCase())
    )
    .slice(0, 8);

  const addParticipantSection = (participant: Participant) => {
    const newSections = [...sections, { participantId: participant.id, notes: [] }];
    setSections(newSections);
    debouncedSave(newSections);
    setShowMentionPopup(false);
    setMentionQuery('');
    if (mentionInputRef.current) mentionInputRef.current.value = '';
  };

  const removeSection = (participantId: string) => {
    const newSections = sections.filter(s => s.participantId !== participantId);
    setSections(newSections);
    debouncedSave(newSections);
  };

  const addNoteToSection = (participantId: string) => {
    const text = newNoteTexts[participantId]?.trim();
    if (!text) return;

    const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
    const newSections = sections.map(s =>
      s.participantId === participantId
        ? { ...s, notes: [...s.notes, { text, timestamp }] }
        : s
    );
    setSections(newSections);
    setNewNoteTexts(prev => ({ ...prev, [participantId]: '' }));
    debouncedSave(newSections);
  };

  const removeNote = (participantId: string, noteIndex: number) => {
    const newSections = sections.map(s =>
      s.participantId === participantId
        ? { ...s, notes: s.notes.filter((_, i) => i !== noteIndex) }
        : s
    );
    setSections(newSections);
    debouncedSave(newSections);
  };

  const handleMentionInputChange = (value: string) => {
    if (value.startsWith('@')) {
      setMentionQuery(value.slice(1));
      setShowMentionPopup(true);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(value);
      setShowMentionPopup(value.length > 0);
      setSelectedMentionIndex(0);
    }
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionPopup || filteredMentionParticipants.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => Math.min(prev + 1, filteredMentionParticipants.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addParticipantSection(filteredMentionParticipants[selectedMentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentionPopup(false);
    }
  };

  const getParticipant = (id: string) => participants.find(p => p.id === id);

  const exportPdf = () => {
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });

    let html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
<title>Nurse Rapport - ${dateStr}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: #1e293b; margin-bottom: 8px; }
  .meta { color: #64748b; margin-bottom: 24px; }
  .participant-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 16px; margin-bottom: 16px; page-break-inside: avoid;
  }
  .participant-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
  .participant-header img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .participant-header .avatar-fallback { width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 16px; }
  .participant-header h2 { margin: 0; color: #1e293b; font-size: 18px; }
  .participant-header p { margin: 2px 0 0 0; color: #64748b; font-size: 14px; }
  .note-entry { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .note-entry:last-child { border-bottom: none; }
  .note-time { color: #64748b; font-size: 12px; font-weight: 500; }
  .note-text { margin-top: 2px; font-size: 14px; line-height: 1.5; }
  @media print { body { padding: 12px; } .participant-card { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="meta">Eksportert: ${dateStr} | Deltakere: ${sections.filter(s => s.notes.length > 0).length}</p>`;

    sections.forEach(section => {
      if (section.notes.length === 0) return;
      const p = getParticipant(section.participantId);
      if (!p) return;
      const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;

      html += `<div class="participant-card"><div class="participant-header">`;
      if (p.image_url) {
        html += `<img src="${p.image_url}" alt="${p.name}" />`;
      } else {
        html += `<div class="avatar-fallback">👤</div>`;
      }
      html += `<div><h2>${p.name}</h2><p>${p.cabin?.name || 'Ingen hytte'}${age ? ` | ${age} år` : ''}</p></div></div>`;

      section.notes.forEach(note => {
        html += `<div class="note-entry"><span class="note-time">${note.timestamp}</span><div class="note-text">${note.text}</div></div>`;
      });

      html += `</div>`;
    });

    html += `</body></html>`;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Nurse Rapport
        </h2>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Lagret {format(lastSaved, 'HH:mm')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleManualSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Lagre
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={sections.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Add participant input with @-mention */}
      <div className="relative">
        <Input
          ref={mentionInputRef}
          placeholder="Skriv @ eller søk for å legge til deltaker..."
          onChange={(e) => handleMentionInputChange(e.target.value)}
          onKeyDown={handleMentionKeyDown}
          onFocus={() => {
            if (mentionInputRef.current?.value) {
              handleMentionInputChange(mentionInputRef.current.value);
            }
          }}
          onBlur={() => setTimeout(() => setShowMentionPopup(false), 200)}
        />
        {showMentionPopup && filteredMentionParticipants.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto">
            {filteredMentionParticipants.map((p, i) => (
              <button
                key={p.id}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                  i === selectedMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addParticipantSection(p);
                }}
                onMouseEnter={() => setSelectedMentionIndex(i)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p.image_url || undefined} alt={p.name} />
                  <AvatarFallback className="text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.cabin && (
                    <span className="text-xs text-muted-foreground ml-2">{p.cabin.name}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Participant sections */}
      {sections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Ingen deltakere lagt til</h3>
            <p className="text-muted-foreground mt-1">
              Skriv @ eller søk i feltet over for å legge til en deltaker
            </p>
          </CardContent>
        </Card>
      )}

      {sections.map(section => {
        const p = getParticipant(section.participantId);
        if (!p) return null;
        const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;

        return (
          <Card key={section.participantId} className="overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
              <Avatar className="w-10 h-10">
                <AvatarImage src={p.image_url || undefined} alt={p.name} />
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.cabin?.name || 'Ingen hytte'}
                  {age ? ` · ${age} år` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSection(section.participantId)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <CardContent className="p-4 space-y-2">
              {/* Existing notes */}
              {section.notes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2 group">
                  <div className="flex-1 bg-muted/50 rounded-md px-3 py-2">
                    <span className="text-xs text-muted-foreground font-medium">{note.timestamp}</span>
                    <p className="text-sm mt-0.5">{note.text}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 mt-1"
                    onClick={() => removeNote(section.participantId, idx)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              {/* Add new note */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Legg til notat..."
                  value={newNoteTexts[section.participantId] || ''}
                  onChange={(e) =>
                    setNewNoteTexts(prev => ({ ...prev, [section.participantId]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addNoteToSection(section.participantId);
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNoteToSection(section.participantId)}
                  disabled={!newNoteTexts[section.participantId]?.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
