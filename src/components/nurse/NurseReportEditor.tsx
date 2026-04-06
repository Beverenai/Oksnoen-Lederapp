import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Save, Loader2, Download, User, FileText, Search } from 'lucide-react';
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

interface NurseReportEditorProps {
  participants: Participant[];
}

export function NurseReportEditor({ participants }: NurseReportEditorProps) {
  const { leader } = useAuth();
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // @-mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionRangeRef = useRef<Range | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  useEffect(() => { loadReport(); }, []);

  // Apply pending content once editor is mounted
  useEffect(() => {
    if (!isLoading && editorRef.current && pendingContentRef.current !== null) {
      editorRef.current.innerHTML = pendingContentRef.current;
      pendingContentRef.current = null;
    }
  }, [isLoading]);

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
        // Detect old JSON format and convert to HTML
        let content = report.content || '<p><br></p>';
        if (content.trim().startsWith('[')) {
          try {
            const lines = JSON.parse(content);
            if (Array.isArray(lines)) {
              content = lines.map((line: any) => {
                const mentionedNames = (line.mentionIds || [])
                  .map((id: string) => participants.find(p => p.id === id))
                  .filter(Boolean);
                let text = line.text || '';
                // Bold @mentions
                for (const p of mentionedNames) {
                  text = text.replace(`@${p.name}`, `<strong>@${p.name}</strong>`);
                }
                return `<p><span style="color:hsl(var(--muted-foreground));font-size:12px;">${line.timestamp || ''}</span> ${text}</p>`;
              }).join('') || '<p><br></p>';
            }
          } catch { /* not JSON, use as-is */ }
        }
        pendingContentRef.current = content;
      } else {
        const { data, error: createErr } = await supabase
          .from('nurse_reports')
          .insert({ content: '<p><br></p>', created_by: leader?.id })
          .select()
          .single();
        if (createErr) throw createErr;
        setReportId(data.id);
        pendingContentRef.current = '<p><br></p>';
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Kunne ikke laste rapport');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReport = useCallback(async () => {
    if (!reportId || !editorRef.current) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .update({ content: editorRef.current.innerHTML, updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveReport(), 2000);
  }, [saveReport]);

  const syncToParticipantNotes = async () => {
    if (!reportId || !editorRef.current) return;
    try {
      // Delete old synced mentions
      await supabase.from('nurse_report_mentions').delete().eq('report_id', reportId);

      // Find all participant sections
      const sections = editorRef.current.querySelectorAll('[data-participant-id]');
      const mentionEntries: { report_id: string; participant_id: string; mention_text: string }[] = [];

      for (const section of sections) {
        const pid = section.getAttribute('data-participant-id');
        if (!pid) continue;
        const contentEl = section.querySelector('.participant-content');
        const text = contentEl?.textContent?.trim() || '';
        if (!text) continue;

        mentionEntries.push({
          report_id: reportId,
          participant_id: pid,
          mention_text: text,
        });

        // Also sync to participant_health_notes
        // First check existing
        const { data: existing } = await supabase
          .from('participant_health_notes')
          .select('id')
          .eq('participant_id', pid)
          .eq('created_by', leader?.id || '')
          .order('created_at', { ascending: false })
          .limit(1);

        const noteContent = `[Nurse Rapport] ${text}`;
        if (existing && existing.length > 0) {
          await supabase
            .from('participant_health_notes')
            .update({ content: noteContent, updated_at: new Date().toISOString() })
            .eq('id', existing[0].id);
        } else {
          await supabase
            .from('participant_health_notes')
            .insert({
              participant_id: pid,
              content: noteContent,
              created_by: leader?.id,
            });
        }
      }

      if (mentionEntries.length > 0) {
        await supabase.from('nurse_report_mentions').insert(mentionEntries);
      }
    } catch (error) {
      console.error('Error syncing mention data:', error);
    }
  };

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveReport();
    await syncToParticipantNotes();
    hapticSuccess();
    toast.success('Rapport lagret og synkronisert');
  };

  const getParticipant = (id: string) => participants.find(p => p.id === id);

  // Filtered participants for mention popup
  const filteredMentionParticipants = mentionQuery !== null
    ? participants
        .filter(p => p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  // Create participant section HTML
  const createParticipantSection = (participant: Participant): string => {
    const age = participant.birth_date ? differenceInYears(new Date(), new Date(participant.birth_date)) : null;
    const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
    const imgHtml = participant.image_url
      ? `<img src="${participant.image_url}" alt="${participant.name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<span style="width:32px;height:32px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:#94a3b8;">👤</span>`;

    return `<div class="participant-section" data-participant-id="${participant.id}" contenteditable="false" style="border:2px solid hsl(var(--primary)/0.3);border-radius:12px;margin:12px 0;background:hsl(var(--primary)/0.04);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:hsl(var(--primary)/0.08);border-bottom:1px solid hsl(var(--primary)/0.15);pointer-events:none;">
        ${imgHtml}
        <div>
          <strong style="font-size:15px;color:hsl(var(--foreground));">${participant.name}</strong>
          <div style="font-size:12px;color:hsl(var(--muted-foreground));">${participant.cabin?.name || 'Ingen hytte'}${age ? ` · ${age} år` : ''}</div>
        </div>
      </div>
      <div class="participant-content" contenteditable="true" style="padding:10px 14px;min-height:40px;outline:none;font-size:14px;line-height:1.6;" data-placeholder="Skriv notater om ${participant.name}...">
        <p><span style="color:hsl(var(--muted-foreground));font-size:12px;">${timestamp}</span> </p>
      </div>
    </div><p><br></p>`;
  };

  // Find existing section for participant
  const findExistingSection = (participantId: string): Element | null => {
    if (!editorRef.current) return null;
    return editorRef.current.querySelector(`[data-participant-id="${participantId}"]`);
  };

  const insertParticipantSection = (participant: Participant) => {
    const existing = findExistingSection(participant.id);
    if (existing) {
      // Scroll to existing section
      existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const contentEl = existing.querySelector('.participant-content') as HTMLElement;
      if (contentEl) {
        // Add new timestamped line
        const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
        const p = document.createElement('p');
        p.innerHTML = `<span style="color:hsl(var(--muted-foreground));font-size:12px;">${timestamp}</span> `;
        contentEl.appendChild(p);
        // Place cursor at end of new line
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStartAfter(p.lastChild!);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentEl.focus();
      }
      return;
    }

    // Remove the @mention text from the editor
    if (mentionRangeRef.current) {
      mentionRangeRef.current.deleteContents();
    }

    // Insert new section at cursor
    const html = createParticipantSection(participant);
    document.execCommand('insertHTML', false, html);
    
    // Focus the new content area
    setTimeout(() => {
      const newSection = findExistingSection(participant.id);
      if (newSection) {
        const contentEl = newSection.querySelector('.participant-content') as HTMLElement;
        if (contentEl) {
          const lastP = contentEl.querySelector('p:last-child');
          if (lastP) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStartAfter(lastP.lastChild || lastP);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
          contentEl.focus();
        }
      }
    }, 50);
  };

  // Detect @-mention in contentEditable
  const handleInput = () => {
    debouncedSave();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setMentionQuery(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      setMentionQuery(null);
      return;
    }

    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || charBefore === '\u00A0' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes('\n') && query.length < 40) {
          // Store range for deletion later
          const mentionRange = document.createRange();
          mentionRange.setStart(textNode, lastAtIndex);
          mentionRange.setEnd(textNode, cursorPos);
          mentionRangeRef.current = mentionRange;

          // Get position for popup
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();
          if (editorRect) {
            setMentionPosition({
              top: rect.top - editorRect.top - 10,
              left: rect.left - editorRect.left,
            });
          }

          setMentionQuery(query);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        insertParticipantSection(filteredMentionParticipants[selectedMentionIndex]);
        setMentionQuery(null);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
  };

  // Handle paste: detect @names in pasted text
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    // Check for @mentions in pasted text
    const mentionPattern = /@([^\n@]+)/g;
    let match;
    const foundParticipants: { participant: Participant; fullMatch: string }[] = [];

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const found = participants.find(p =>
        p.name.toLowerCase() === mentionName.toLowerCase() ||
        p.name.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (found) {
        foundParticipants.push({ participant: found, fullMatch: match[0] });
      }
    }

    if (foundParticipants.length === 0) {
      // No mentions found, just paste as plain text
      document.execCommand('insertText', false, text);
      return;
    }

    // Split text by mentions and create sections
    let remaining = text;
    for (const { participant, fullMatch } of foundParticipants) {
      const idx = remaining.indexOf(fullMatch);
      if (idx > 0) {
        // Insert text before the mention
        document.execCommand('insertText', false, remaining.slice(0, idx));
      }

      // Find text belonging to this participant (until next @mention or end)
      const afterMention = remaining.slice(idx + fullMatch.length);
      const nextAtIdx = afterMention.search(/@[A-ZÆØÅa-zæøå]/);
      const participantText = nextAtIdx >= 0 ? afterMention.slice(0, nextAtIdx).trim() : afterMention.trim();

      // Insert participant section
      const html = createParticipantSection(participant);
      document.execCommand('insertHTML', false, html);

      // Add the pasted content into the section
      if (participantText) {
        const section = findExistingSection(participant.id);
        if (section) {
          const contentEl = section.querySelector('.participant-content');
          if (contentEl) {
            const p = document.createElement('p');
            p.textContent = participantText;
            contentEl.appendChild(p);
          }
        }
      }

      remaining = nextAtIdx >= 0 ? afterMention.slice(nextAtIdx) : '';
    }

    if (remaining.trim()) {
      document.execCommand('insertText', false, remaining);
    }

    debouncedSave();
  };

  // Search: jump to participant section
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !editorRef.current) return;

    const sections = editorRef.current.querySelectorAll('[data-participant-id]');
    for (const section of sections) {
      const pid = section.getAttribute('data-participant-id');
      const p = pid ? getParticipant(pid) : null;
      if (p && p.name.toLowerCase().includes(query.toLowerCase())) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight briefly
        (section as HTMLElement).style.boxShadow = '0 0 0 3px hsl(var(--primary))';
        setTimeout(() => {
          (section as HTMLElement).style.boxShadow = '';
        }, 2000);
        break;
      }
    }
  };

  // PDF export
  const exportPdf = () => {
    if (!editorRef.current) return;
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });

    const html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
<title>Nurse Rapport - ${dateStr}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: #1e293b; margin-bottom: 8px; }
  .meta { color: #64748b; margin-bottom: 24px; }
  .participant-section { border: 2px solid #cbd5e1; border-radius: 12px; margin: 16px 0; overflow: hidden; page-break-inside: avoid; }
  .participant-section > div:first-child { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .participant-section img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .participant-content { padding: 10px 14px; font-size: 14px; line-height: 1.6; }
  p { margin: 4px 0; }
  @media print { body { padding: 12px; } .participant-section { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="meta">Eksportert: ${dateStr}</p>
${editorRef.current.innerHTML}
</body></html>`;

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
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative py-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter deltaker i rapporten..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Editor */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {/* Mention popup */}
        {mentionQuery !== null && filteredMentionParticipants.length > 0 && (
          <div
            className="absolute bg-popover border border-border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto z-50"
            style={{ top: mentionPosition.top, left: mentionPosition.left, minWidth: 250 }}
          >
            {filteredMentionParticipants.map((p, i) => (
              <button
                key={p.id}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                  i === selectedMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertParticipantSection(p);
                  setMentionQuery(null);
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

        {/* ContentEditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[400px] outline-none text-sm leading-relaxed p-3 rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder="Skriv fritt her... bruk @ for å nevne en deltaker og opprette en seksjon."
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        />

        {/* Empty state placeholder */}
        <style>{`
          [data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
          }
          .participant-content[data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
          }
          .participant-section {
            user-select: contain;
          }
          .participant-content:focus {
            outline: none;
          }
        `}</style>
      </div>
    </div>
  );
}
