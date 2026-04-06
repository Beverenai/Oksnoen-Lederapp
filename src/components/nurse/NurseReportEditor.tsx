import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Download, FileText, Plus, Trash2 } from 'lucide-react';
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
}

interface NurseReport {
  id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface NurseReportEditorProps {
  participants: Participant[];
}

export function NurseReportEditor({ participants }: NurseReportEditorProps) {
  const { leader } = useAuth();
  const [reports, setReports] = useState<NurseReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Mention state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  // Load reports
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('nurse_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports((data as NurseReport[]) || []);
      if (data && data.length > 0 && !activeReportId) {
        setActiveReportId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeReport = reports.find(r => r.id === activeReportId);

  // Set editor content when active report changes
  useEffect(() => {
    if (editorRef.current && activeReport) {
      editorRef.current.innerHTML = activeReport.content;
    }
  }, [activeReportId]);

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 8);

  const saveReport = useCallback(async (content: string) => {
    if (!activeReportId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', activeReportId);

      if (error) throw error;
      setLastSaved(new Date());
      // Update local state
      setReports(prev => prev.map(r => r.id === activeReportId ? { ...r, content } : r));
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeReportId]);

  const debouncedSave = useCallback((content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveReport(content), 2000);
  }, [saveReport]);

  const handleManualSave = async () => {
    if (!editorRef.current || !activeReportId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveReport(editorRef.current.innerHTML);
    await saveMentionData();
    hapticSuccess();
    toast.success('Rapport lagret');
  };

  const saveMentionData = async () => {
    if (!editorRef.current || !activeReportId) return;
    
    const mentions = editorRef.current.querySelectorAll('.mention[data-participant-id]');
    if (mentions.length === 0) return;

    // Parse mention text: for each mention, get text until next mention
    const mentionEntries: { participant_id: string; mention_text: string }[] = [];
    
    mentions.forEach((mention, index) => {
      const participantId = mention.getAttribute('data-participant-id');
      if (!participantId) return;

      // Get text nodes after this mention until next mention or end
      let text = '';
      let node: Node | null = mention.nextSibling;
      while (node) {
        if (node instanceof HTMLElement && node.classList?.contains('mention')) break;
        if (node instanceof HTMLBRElement) {
          text += '\n';
        } else {
          text += node.textContent || '';
        }
        node = node.nextSibling;
      }

      mentionEntries.push({
        participant_id: participantId,
        mention_text: text.trim(),
      });
    });

    try {
      // Delete existing mentions for this report
      await supabase
        .from('nurse_report_mentions')
        .delete()
        .eq('report_id', activeReportId);

      if (mentionEntries.length > 0) {
        await supabase
          .from('nurse_report_mentions')
          .insert(mentionEntries.map(e => ({
            report_id: activeReportId,
            participant_id: e.participant_id,
            mention_text: e.mention_text,
          })));
      }

      // Also save to participant_health_notes
      for (const entry of mentionEntries) {
        if (!entry.mention_text) continue;
        const noteContent = `[Nurse-rapport ${format(new Date(), 'd. MMM', { locale: nb })}] ${entry.mention_text}`;
        
        await supabase.from('participant_health_notes').insert({
          participant_id: entry.participant_id,
          content: noteContent,
          created_by: leader?.id,
        });
      }
    } catch (error) {
      console.error('Error saving mention data:', error);
    }
  };

  const createNewReport = async () => {
    try {
      const { data, error } = await supabase
        .from('nurse_reports')
        .insert({
          content: '',
          created_by: leader?.id,
        })
        .select()
        .single();

      if (error) throw error;
      const newReport = data as NurseReport;
      setReports(prev => [newReport, ...prev]);
      setActiveReportId(newReport.id);
      if (editorRef.current) editorRef.current.innerHTML = '';
      toast.success('Ny rapport opprettet');
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Kunne ikke opprette rapport');
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== reportId));
      if (activeReportId === reportId) {
        const remaining = reports.filter(r => r.id !== reportId);
        setActiveReportId(remaining.length > 0 ? remaining[0].id : null);
        if (editorRef.current) {
          editorRef.current.innerHTML = remaining.length > 0 ? remaining[0].content : '';
        }
      }
      toast.success('Rapport slettet');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Kunne ikke slette rapport');
    }
  };

  // Handle @-mention logic
  const handleInput = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    debouncedSave(content);

    // Check for @ mention
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      setShowMentionPopup(false);
      return;
    }

    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      if (atIndex === 0 || charBeforeAt === ' ' || charBeforeAt === '\n' || charBeforeAt === '\u00A0') {
        const query = textBeforeCursor.slice(atIndex + 1);
        if (!query.includes(' ') || query.length < 30) {
          setMentionQuery(query);
          setSelectedMentionIndex(0);
          setShowMentionPopup(true);

          // Position popup
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.bottom - editorRect.top + 4,
            left: rect.left - editorRect.left,
          });
          return;
        }
      }
    }

    setShowMentionPopup(false);
  };

  const insertMention = (participant: Participant) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex < 0) return;

    // Create mention span
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention';
    mentionSpan.setAttribute('data-participant-id', participant.id);
    mentionSpan.setAttribute('contenteditable', 'false');
    mentionSpan.textContent = `@${participant.name}`;

    // Split text node and insert mention
    const beforeText = text.slice(0, atIndex);
    const afterText = text.slice(cursorPos);

    const parentNode = textNode.parentNode;
    if (!parentNode) return;

    const beforeTextNode = document.createTextNode(beforeText);
    const afterTextNode = document.createTextNode('\u00A0' + afterText);

    parentNode.insertBefore(beforeTextNode, textNode);
    parentNode.insertBefore(mentionSpan, textNode);
    parentNode.insertBefore(afterTextNode, textNode);
    parentNode.removeChild(textNode);

    // Move cursor after mention
    const newRange = document.createRange();
    newRange.setStart(afterTextNode, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setShowMentionPopup(false);
    debouncedSave(editorRef.current.innerHTML);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionPopup) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => Math.min(prev + 1, filteredParticipants.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredParticipants[selectedMentionIndex]) {
        insertMention(filteredParticipants[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowMentionPopup(false);
    }
  };

  const exportPdf = async () => {
    if (!editorRef.current || !activeReportId) return;

    // Parse mentions and group text by participant
    const mentions = editorRef.current.querySelectorAll('.mention[data-participant-id]');
    const participantSections: Map<string, { name: string; texts: string[] }> = new Map();

    mentions.forEach(mention => {
      const pid = mention.getAttribute('data-participant-id');
      const name = mention.textContent?.replace('@', '') || '';
      if (!pid) return;

      let text = '';
      let node: Node | null = mention.nextSibling;
      while (node) {
        if (node instanceof HTMLElement && node.classList?.contains('mention')) break;
        if (node instanceof HTMLBRElement) text += '\n';
        else text += node.textContent || '';
        node = node.nextSibling;
      }

      if (!participantSections.has(pid)) {
        participantSections.set(pid, { name, texts: [] });
      }
      if (text.trim()) {
        participantSections.get(pid)!.texts.push(text.trim());
      }
    });

    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });

    let html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
<title>Nurse Rapport - ${dateStr}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: #1e293b; margin-bottom: 8px; }
  .meta { color: #64748b; margin-bottom: 24px; }
  .participant-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .participant-card h2 { margin: 0 0 4px 0; color: #1e293b; font-size: 18px; }
  .participant-card .cabin { color: #64748b; font-size: 14px; margin-bottom: 12px; }
  .participant-card .text { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .full-report { margin-top: 32px; padding-top: 24px; border-top: 2px solid #e2e8f0; }
  .full-report h2 { margin-bottom: 12px; }
  .full-report-content { font-size: 14px; line-height: 1.6; }
  .mention { background: #dbeafe; color: #1d4ed8; padding: 1px 4px; border-radius: 4px; font-weight: 500; }
  @media print { body { padding: 12px; } .participant-card { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="meta">Eksportert: ${dateStr}</p>`;

    // Per-participant sections
    if (participantSections.size > 0) {
      html += `<h2>Per deltaker</h2>`;
      participantSections.forEach(({ name, texts }, pid) => {
        const p = participants.find(pp => pp.id === pid);
        const age = p?.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;
        html += `<div class="participant-card">
          <h2>${name}</h2>
          <div class="cabin">${p?.cabin?.name || 'Ingen hytte'}${age ? ` | ${age} år` : ''}</div>
          <div class="text">${texts.join('\n\n')}</div>
        </div>`;
      });
    }

    // Full report
    html += `<div class="full-report">
      <h2>Full rapport</h2>
      <div class="full-report-content">${editorRef.current.innerHTML}</div>
    </div>`;

    html += `</body></html>`;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Report selector + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {reports.map(report => (
            <div key={report.id} className="flex items-center gap-1">
              <Button
                variant={activeReportId === report.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveReportId(report.id)}
              >
                {format(new Date(report.created_at), 'd. MMM', { locale: nb })}
              </Button>
              {reports.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReport(report.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={createNewReport}>
            <Plus className="w-4 h-4 mr-1" />
            Ny rapport
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Lagret {format(lastSaved, 'HH:mm')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleManualSave} disabled={isSaving || !activeReportId}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Lagre
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!activeReportId}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Editor */}
      {activeReportId ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Rapport
            </CardTitle>
            <CardDescription>
              Skriv <Badge variant="outline" className="mx-1 text-xs">@</Badge> for å nevne en deltaker
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                className="min-h-[400px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 whitespace-pre-wrap leading-relaxed [&_.mention]:inline-flex [&_.mention]:items-center [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:px-1.5 [&_.mention]:py-0.5 [&_.mention]:rounded-md [&_.mention]:font-medium [&_.mention]:text-xs [&_.mention]:mx-0.5"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                suppressContentEditableWarning
              />

              {/* Mention popup */}
              {showMentionPopup && filteredParticipants.length > 0 && (
                <div
                  ref={mentionPopupRef}
                  className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-1 max-h-48 overflow-y-auto w-64"
                  style={{ top: mentionPosition.top, left: mentionPosition.left }}
                >
                  {filteredParticipants.map((p, i) => (
                    <button
                      key={p.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                        i === selectedMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(p);
                      }}
                      onMouseEnter={() => setSelectedMentionIndex(i)}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.cabin && (
                        <span className="text-xs text-muted-foreground">{p.cabin.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Ingen rapport</h3>
            <p className="text-muted-foreground mt-1 mb-4">Opprett en ny rapport for å komme i gang</p>
            <Button onClick={createNewReport}>
              <Plus className="w-4 h-4 mr-2" />
              Ny rapport
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
