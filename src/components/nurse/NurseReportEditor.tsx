import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Save, Loader2, Download, Trash2, User, FileText } from 'lucide-react';
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

interface ReportLine {
  id: string;
  text: string;
  mentionIds: string[];
  timestamp: string;
}

interface NurseReportEditorProps {
  participants: Participant[];
}

export function NurseReportEditor({ participants }: NurseReportEditorProps) {
  const { leader } = useAuth();
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Input state
  const [inputText, setInputText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadReport(); }, []);

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
          setLines(Array.isArray(parsed) ? parsed : []);
        } catch { setLines([]); }
      } else {
        const { data, error: createErr } = await supabase
          .from('nurse_reports')
          .insert({ content: '[]', created_by: leader?.id })
          .select()
          .single();
        if (createErr) throw createErr;
        setReportId(data.id);
        setLines([]);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Kunne ikke laste rapport');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReport = useCallback(async (linesToSave: ReportLine[]) => {
    if (!reportId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .update({ content: JSON.stringify(linesToSave), updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  const debouncedSave = useCallback((linesToSave: ReportLine[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveReport(linesToSave), 2000);
  }, [saveReport]);

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveReport(lines);
    await syncMentionData(lines);
    hapticSuccess();
    toast.success('Rapport lagret');
  };

  const syncMentionData = async (linesToSync: ReportLine[]) => {
    if (!reportId) return;
    try {
      await supabase.from('nurse_report_mentions').delete().eq('report_id', reportId);

      // Group lines by participant
      const grouped: Record<string, ReportLine[]> = {};
      for (const line of linesToSync) {
        for (const pid of line.mentionIds) {
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push(line);
        }
      }

      const mentionEntries = Object.entries(grouped).map(([pid, pLines]) => ({
        report_id: reportId,
        participant_id: pid,
        mention_text: pLines.map(l => `[${l.timestamp}] ${l.text}`).join('\n'),
      }));

      if (mentionEntries.length > 0) {
        await supabase.from('nurse_report_mentions').insert(mentionEntries);
      }

      // Sync to participant_health_notes
      for (const [pid, pLines] of Object.entries(grouped)) {
        const noteContent = pLines.map(l => `[Nurse ${l.timestamp}] ${l.text}`).join('\n');
        await supabase.from('participant_health_notes').insert({
          participant_id: pid,
          content: noteContent,
          created_by: leader?.id,
        });
      }
    } catch (error) {
      console.error('Error syncing mention data:', error);
    }
  };

  // Parse @mentions from text, return participant IDs found
  const parseMentionIds = (text: string): string[] => {
    const ids: string[] = [];
    for (const p of participants) {
      if (text.includes(`@${p.name}`)) {
        ids.push(p.id);
      }
    }
    return ids;
  };

  const getParticipant = (id: string) => participants.find(p => p.id === id);

  // Filtered participants for mention popup
  const filteredMentionParticipants = mentionQuery !== null
    ? participants
        .filter(p => p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  const handleInputChange = (value: string) => {
    setInputText(value);

    // Detect @-mention
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(' ') || query.length < 30) {
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (participant: Participant) => {
    const before = inputText.slice(0, mentionStartIndex);
    const cursorPos = inputRef.current?.selectionStart ?? inputText.length;
    const after = inputText.slice(cursorPos);
    const newText = `${before}@${participant.name} ${after}`;
    setInputText(newText);
    setMentionQuery(null);
    setMentionStartIndex(-1);

    // Focus back
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + participant.name.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const submitLine = () => {
    const text = inputText.trim();
    if (!text) return;

    const mentionIds = parseMentionIds(text);
    const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
    const newLine: ReportLine = {
      id: crypto.randomUUID(),
      text,
      mentionIds,
      timestamp,
    };

    const newLines = [...lines, newLine];
    setLines(newLines);
    setInputText('');
    setMentionQuery(null);
    debouncedSave(newLines);
  };

  const removeLine = (lineId: string) => {
    const newLines = lines.filter(l => l.id !== lineId);
    setLines(newLines);
    debouncedSave(newLines);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMentionParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.min(prev + 1, filteredMentionParticipants.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredMentionParticipants[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitLine();
    }
  };

  // Render text with @mentions highlighted
  const renderLineText = (text: string, mentionIds: string[]) => {
    if (mentionIds.length === 0) return <span>{text}</span>;

    const mentionedParticipants = mentionIds
      .map(id => getParticipant(id))
      .filter(Boolean)
      .sort((a, b) => b!.name.length - a!.name.length); // longest first to avoid partial matches

    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      let earliestIdx = remaining.length;
      let matchedP: Participant | null = null;

      for (const p of mentionedParticipants) {
        if (!p) continue;
        const idx = remaining.indexOf(`@${p.name}`);
        if (idx >= 0 && idx < earliestIdx) {
          earliestIdx = idx;
          matchedP = p;
        }
      }

      if (!matchedP) {
        parts.push(remaining);
        break;
      }

      if (earliestIdx > 0) {
        parts.push(remaining.slice(0, earliestIdx));
      }

      parts.push(
        <span key={keyIdx++} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-sm font-medium mx-0.5">
          <Avatar className="w-4 h-4">
            <AvatarImage src={matchedP.image_url || undefined} alt={matchedP.name} />
            <AvatarFallback className="text-[8px]"><User className="w-2.5 h-2.5" /></AvatarFallback>
          </Avatar>
          {matchedP.name}
        </span>
      );

      remaining = remaining.slice(earliestIdx + 1 + matchedP.name.length);
    }

    return <>{parts}</>;
  };

  const exportPdf = () => {
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });

    // Group by participant
    const grouped: Record<string, ReportLine[]> = {};
    for (const line of lines) {
      for (const pid of line.mentionIds) {
        if (!grouped[pid]) grouped[pid] = [];
        grouped[pid].push(line);
      }
    }

    let html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
<title>Nurse Rapport - ${dateStr}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: #1e293b; margin-bottom: 8px; }
  .meta { color: #64748b; margin-bottom: 24px; }
  h2 { margin-top: 24px; }
  .participant-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .participant-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
  .participant-header img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .participant-header .avatar-fallback { width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 16px; }
  .participant-header h3 { margin: 0; color: #1e293b; font-size: 18px; }
  .participant-header p { margin: 2px 0 0 0; color: #64748b; font-size: 14px; }
  .note-entry { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .note-entry:last-child { border-bottom: none; }
  .note-time { color: #64748b; font-size: 12px; font-weight: 500; }
  .note-text { margin-top: 2px; font-size: 14px; line-height: 1.5; }
  .chronological { margin-bottom: 32px; }
  .chrono-entry { padding: 6px 0; }
  .chrono-time { color: #64748b; font-size: 12px; font-weight: 500; display: inline-block; min-width: 100px; }
  @media print { body { padding: 12px; } .participant-card { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="meta">Eksportert: ${dateStr} | Totalt ${lines.length} notater</p>

<h2>Kronologisk logg</h2>
<div class="chronological">`;

    for (const line of lines) {
      html += `<div class="chrono-entry"><span class="chrono-time">${line.timestamp}</span> <span class="note-text">${line.text}</span></div>`;
    }

    html += `</div><h2>Per deltaker</h2>`;

    for (const [pid, pLines] of Object.entries(grouped)) {
      const p = getParticipant(pid);
      if (!p) continue;
      const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;

      html += `<div class="participant-card"><div class="participant-header">`;
      if (p.image_url) {
        html += `<img src="${p.image_url}" alt="${p.name}" />`;
      } else {
        html += `<div class="avatar-fallback">👤</div>`;
      }
      html += `<div><h3>${p.name}</h3><p>${p.cabin?.name || 'Ingen hytte'}${age ? ` | ${age} år` : ''}</p></div></div>`;

      for (const line of pLines) {
        html += `<div class="note-entry"><span class="note-time">${line.timestamp}</span><div class="note-text">${line.text}</div></div>`;
      }
      html += `</div>`;
    }

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
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
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={lines.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Lines feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 min-h-0">
        {lines.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Tom rapport</h3>
            <p className="text-muted-foreground mt-1">
              Skriv i feltet under. Bruk @navn for å nevne en deltaker.
            </p>
          </div>
        )}

        {lines.map(line => (
          <div key={line.id} className="flex items-start gap-2 group px-1 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap pt-0.5 min-w-[90px]">
              {line.timestamp}
            </span>
            <p className="flex-1 text-sm leading-relaxed">
              {renderLineText(line.text, line.mentionIds)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => removeLine(line.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="relative border-t border-border pt-3">
        {mentionQuery !== null && filteredMentionParticipants.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full bg-popover border border-border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto z-50">
            {filteredMentionParticipants.map((p, i) => (
              <button
                key={p.id}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                  i === selectedMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                onMouseEnter={() => setSelectedMentionIndex(i)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p.image_url || undefined} alt={p.name} />
                  <AvatarFallback className="text-xs"><User className="w-3 h-3" /></AvatarFallback>
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
        <Textarea
          ref={inputRef}
          placeholder="Skriv notat... bruk @navn for å nevne en deltaker. Enter for å legge til."
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] resize-none text-sm"
          rows={2}
        />
      </div>
    </div>
  );
}
