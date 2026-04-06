import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Save, Loader2, Download, User, FileText, Search, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  id: string;
  participant_id: string;
  mention_text: string;
  created_at: string;
}

interface NurseReportEditorProps {
  participants: Participant[];
}

export function NurseReportEditor({ participants }: NurseReportEditorProps) {
  const { leader } = useAuth();
  const [reportId, setReportId] = useState<string | null>(null);
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Free-writing input state
  const [inputValue, setInputValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);

  // Edit state
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'entry' | 'section'; id: string; participantId: string; name: string } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const getParticipant = useCallback((id: string) => participants.find((p) => p.id === id), [participants]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get or create report
      const { data: reports, error } = await supabase
        .from('nurse_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;

      let rid: string;
      if (reports && reports.length > 0) {
        rid = reports[0].id;
      } else {
        const { data, error: createErr } = await supabase
          .from('nurse_reports')
          .insert({ content: '', created_by: leader?.id })
          .select()
          .single();
        if (createErr) throw createErr;
        rid = data.id;
      }
      setReportId(rid);

      // Load entries from nurse_report_mentions
      const { data: mentions } = await supabase
        .from('nurse_report_mentions')
        .select('*')
        .eq('report_id', rid)
        .order('created_at', { ascending: true });

      setEntries(mentions || []);
    } catch (e) {
      console.error('Error loading report:', e);
      toast.error('Kunne ikke laste rapport');
    } finally {
      setIsLoading(false);
    }
  };

  // Group entries by participant, maintaining order of first appearance
  const groupedEntries = useMemo(() => {
    const map = new Map<string, NoteEntry[]>();
    const order: string[] = [];
    entries.forEach((e) => {
      if (!map.has(e.participant_id)) {
        map.set(e.participant_id, []);
        order.push(e.participant_id);
      }
      map.get(e.participant_id)!.push(e);
    });
    return { map, order };
  }, [entries]);

  // Filtered participants for mention dropdown
  const filteredMentionParticipants = useMemo(() => {
    if (mentionQuery === null) return [];
    return participants
      .filter((p) => p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 8);
  }, [mentionQuery, participants]);

  // Handle input changes and detect @mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes('\n') && query.length < 40) {
          setMentionQuery(query);
          setSelectedMentionIndex(0);

          // Position dropdown near the textarea
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setMentionPosition({ top: rect.height + 4, left: 0 });
          }
          return;
        }
      }
    }

    setMentionQuery(null);
  };

  // Select a participant from the mention dropdown
  const selectMentionParticipant = (participant: Participant) => {
    // Remove the @query from input, keep text before @
    const cursorPos = inputRef.current?.selectionStart || inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const textBefore = lastAtIndex > 0 ? inputValue.slice(0, lastAtIndex).trimEnd() : '';
    const textAfter = inputValue.slice(cursorPos).trimStart();

    // Combine remaining text as the note
    const noteText = [textBefore, textAfter].filter(Boolean).join(' ').trim();

    setActiveParticipant(participant);
    setInputValue(noteText);
    setMentionQuery(null);

    // Focus back on input
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Submit the current input as an entry for the active participant
  const submitEntry = async () => {
    if (!activeParticipant || !inputValue.trim() || !reportId) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('nurse_report_mentions')
        .insert({
          report_id: reportId,
          participant_id: activeParticipant.id,
          mention_text: inputValue.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setEntries((prev) => [...prev, data]);
      setInputValue('');
      setActiveParticipant(null);
      setLastSaved(new Date());

      // Sync health info
      await syncParticipantHealth(activeParticipant.id);
      hapticSuccess();
    } catch (e) {
      console.error('Error saving entry:', e);
      toast.error('Kunne ikke lagre notat');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard in input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention dropdown navigation
    if (mentionQuery !== null && filteredMentionParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => Math.min(prev + 1, filteredMentionParticipants.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectMentionParticipant(filteredMentionParticipants[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    // Submit on Enter (without shift) when there's an active participant
    if (e.key === 'Enter' && !e.shiftKey && activeParticipant) {
      e.preventDefault();
      submitEntry();
    }
  };

  // Sync health data for a participant
  const syncParticipantHealth = async (participantId: string) => {
    if (!reportId) return;

    try {
      const participantEntries = entries
        .filter((e) => e.participant_id === participantId)
        .concat([]); // current state might not include the just-inserted one, but we reload below

      // Reload fresh entries for this participant
      const { data: freshEntries } = await supabase
        .from('nurse_report_mentions')
        .select('*')
        .eq('report_id', reportId)
        .eq('participant_id', participantId)
        .order('created_at', { ascending: true });

      const allText = (freshEntries || []).map((e) => e.mention_text).join('\n');
      if (!allText.trim()) return;

      // Update health notes
      const { data: existingNotes } = await supabase
        .from('participant_health_notes')
        .select('id')
        .eq('participant_id', participantId)
        .eq('created_by', leader?.id || '')
        .like('content', '[Nurse Rapport]%')
        .limit(1);

      const noteContent = `[Nurse Rapport] ${allText}`;
      if (existingNotes && existingNotes.length > 0) {
        await supabase
          .from('participant_health_notes')
          .update({ content: noteContent, updated_at: new Date().toISOString() })
          .eq('id', existingNotes[0].id);
      } else {
        await supabase
          .from('participant_health_notes')
          .insert({ participant_id: participantId, content: noteContent, created_by: leader?.id });
      }

      // Update health info (flag as having health info)
      const nurseInfo = `[Nurse] ${allText}`;
      const { data: existingInfo } = await supabase
        .from('participant_health_info')
        .select('id, info')
        .eq('participant_id', participantId)
        .limit(1);

      if (!existingInfo || existingInfo.length === 0) {
        await supabase.from('participant_health_info').insert({ participant_id: participantId, info: nurseInfo });
      } else if ((existingInfo[0].info || '').startsWith('[Nurse]')) {
        await supabase
          .from('participant_health_info')
          .update({ info: nurseInfo, updated_at: new Date().toISOString() })
          .eq('id', existingInfo[0].id);
      }
    } catch (e) {
      console.error('Error syncing health data:', e);
    }
  };

  // Update an existing entry
  const updateEntry = async (entryId: string) => {
    if (!editText.trim()) return;

    try {
      const { error } = await supabase
        .from('nurse_report_mentions')
        .update({ mention_text: editText.trim() })
        .eq('id', entryId);

      if (error) throw error;

      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, mention_text: editText.trim() } : e))
      );
      setEditingEntry(null);
      setEditText('');
      setLastSaved(new Date());

      const entry = entries.find((e) => e.id === entryId);
      if (entry) await syncParticipantHealth(entry.participant_id);
    } catch (e) {
      console.error('Error updating entry:', e);
      toast.error('Kunne ikke oppdatere');
    }
  };

  // Delete an entry
  const deleteEntry = async (entryId: string, participantId: string) => {
    try {
      const { error } = await supabase.from('nurse_report_mentions').delete().eq('id', entryId);
      if (error) throw error;

      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setLastSaved(new Date());

      // Check if this was the last entry for this participant
      const remaining = entries.filter((e) => e.participant_id === participantId && e.id !== entryId);
      if (remaining.length === 0) {
        // Clean up health info
        await supabase
          .from('participant_health_notes')
          .delete()
          .eq('participant_id', participantId)
          .eq('created_by', leader?.id || '')
          .like('content', '[Nurse Rapport]%');

        const { data: healthInfo } = await supabase
          .from('participant_health_info')
          .select('id, info')
          .eq('participant_id', participantId)
          .like('info', '[Nurse]%');

        if (healthInfo && healthInfo.length > 0) {
          await supabase.from('participant_health_info').delete().in('id', healthInfo.map((h) => h.id));
        }
      } else {
        await syncParticipantHealth(participantId);
      }

      toast.success('Notat slettet');
    } catch (e) {
      console.error('Error deleting entry:', e);
      toast.error('Kunne ikke slette');
    }
  };

  // Delete all entries for a participant (section delete)
  const deleteSection = async (participantId: string) => {
    try {
      const ids = entries.filter((e) => e.participant_id === participantId).map((e) => e.id);
      if (ids.length === 0) return;

      const { error } = await supabase.from('nurse_report_mentions').delete().in('id', ids);
      if (error) throw error;

      setEntries((prev) => prev.filter((e) => e.participant_id !== participantId));
      setLastSaved(new Date());

      // Clean up health data
      await supabase
        .from('participant_health_notes')
        .delete()
        .eq('participant_id', participantId)
        .eq('created_by', leader?.id || '')
        .like('content', '[Nurse Rapport]%');

      const { data: healthInfo } = await supabase
        .from('participant_health_info')
        .select('id, info')
        .eq('participant_id', participantId)
        .like('info', '[Nurse]%');

      if (healthInfo && healthInfo.length > 0) {
        await supabase.from('participant_health_info').delete().in('id', healthInfo.map((h) => h.id));
      }

      toast.success('Deltaker-seksjon slettet');
    } catch (e) {
      console.error('Error deleting section:', e);
      toast.error('Kunne ikke slette seksjon');
    }
  };

  // Handle confirm delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'section') {
      await deleteSection(deleteTarget.participantId);
    } else {
      await deleteEntry(deleteTarget.id, deleteTarget.participantId);
    }
    setDeleteTarget(null);
  };

  // Search and scroll to a participant card
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return;

    const matchId = groupedEntries.order.find((pid) => {
      const p = getParticipant(pid);
      return p?.name.toLowerCase().includes(query.toLowerCase());
    });

    if (matchId) {
      const el = document.getElementById(`nurse-section-${matchId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 0 3px hsl(var(--primary))';
        setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      }
    }
  };

  // PDF export
  const exportPdf = () => {
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });

    let sectionsHtml = '';
    for (const pid of groupedEntries.order) {
      const participant = getParticipant(pid);
      if (!participant) continue;
      const pEntries = groupedEntries.map.get(pid) || [];
      const age = participant.birth_date ? differenceInYears(new Date(), new Date(participant.birth_date)) : null;

      sectionsHtml += `
        <div class="participant-section">
          <div class="header">
            ${participant.image_url ? `<img src="${participant.image_url}" />` : '<span class="avatar">👤</span>'}
            <div>
              <strong>${participant.name}</strong>
              <div class="meta">${participant.cabin?.name || 'Ingen hytte'}${age ? ` · ${age} år` : ''}</div>
            </div>
          </div>
          <div class="content">
            ${pEntries
              .map(
                (e) =>
                  `<p><span class="ts">${format(new Date(e.created_at), 'd. MMM HH:mm', { locale: nb })}</span> ${e.mention_text}</p>`
              )
              .join('')}
          </div>
        </div>`;
    }

    const html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
<title>Nurse Rapport - ${dateStr}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: #1e293b; margin-bottom: 8px; }
  .date { color: #64748b; margin-bottom: 24px; }
  .participant-section { border: 2px solid #cbd5e1; border-radius: 12px; margin: 16px 0; overflow: hidden; page-break-inside: avoid; }
  .header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .header img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
  .header strong { font-size: 15px; }
  .header .meta { font-size: 12px; color: #64748b; }
  .content { padding: 10px 14px; font-size: 14px; line-height: 1.6; }
  .content p { margin: 4px 0; }
  .ts { color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 12px; } .participant-section { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="date">Eksportert: ${dateStr}</p>
${sectionsHtml}
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // Handle paste with @mentions
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('@')) return; // Let default paste handle it

    e.preventDefault();
    const mentionPattern = /@([^\n@]+)/g;
    let match;
    const foundPairs: { participant: Participant; text: string }[] = [];
    let lastEnd = 0;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const found = participants.find(
        (p) =>
          p.name.toLowerCase() === mentionName.toLowerCase() ||
          p.name.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (found) {
        // Text after the mention until next @ or end
        const afterMatch = text.slice(match.index + match[0].length);
        const nextAt = afterMatch.search(/@[A-ZÆØÅa-zæøå]/);
        const noteText = nextAt >= 0 ? afterMatch.slice(0, nextAt).trim() : afterMatch.trim();
        foundPairs.push({ participant: found, text: noteText });
      }
    }

    if (foundPairs.length === 0) {
      // No valid mentions found, just paste normally
      const textarea = inputRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = inputValue.slice(0, start) + text + inputValue.slice(end);
        setInputValue(newValue);
      }
      return;
    }

    // Auto-create entries for each mentioned participant
    const createEntries = async () => {
      for (const { participant, text: noteText } of foundPairs) {
        if (!noteText || !reportId) continue;
        const { data, error } = await supabase
          .from('nurse_report_mentions')
          .insert({ report_id: reportId, participant_id: participant.id, mention_text: noteText })
          .select()
          .single();
        if (!error && data) {
          setEntries((prev) => [...prev, data]);
          await syncParticipantHealth(participant.id);
        }
      }
      setLastSaved(new Date());
      hapticSuccess();
      toast.success(`${foundPairs.length} notat(er) lagt til`);
    };

    createEntries();
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
      {/* Header with actions */}
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
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative py-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter deltaker i rapporten..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
        {/* Free-writing input area */}
        <div className="relative">
          {activeParticipant && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-muted-foreground">Skriver for:</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <User className="w-3 h-3" />
                {activeParticipant.name}
                <button
                  onClick={() => setActiveParticipant(null)}
                  className="ml-1 hover:text-destructive transition-colors"
                  aria-label="Fjern valgt deltaker"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
            placeholder={activeParticipant ? `Skriv notat for ${activeParticipant.name}... (Enter for å lagre)` : 'Skriv her — legg til deltaker med @navn'}
            className="min-h-[80px] text-sm resize-none"
            rows={3}
          />

          {/* Mention dropdown */}
          {mentionQuery !== null && filteredMentionParticipants.length > 0 && (
            <div
              ref={mentionDropdownRef}
              className="absolute left-0 right-0 bg-popover border border-border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto z-50"
              style={{ top: mentionPosition.top }}
            >
              {filteredMentionParticipants.map((p, i) => (
                <button
                  key={p.id}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                    i === selectedMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMentionParticipant(p);
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

          {activeParticipant && inputValue.trim() && (
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={submitEntry} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Legg til notat
              </Button>
            </div>
          )}
        </div>

        {/* Participant cards */}
        {groupedEntries.order.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Ingen deltakere lagt til ennå.</p>
            <p className="text-xs mt-1">Bruk <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd> for å legge til en deltaker.</p>
          </div>
        )}

        {groupedEntries.order.map((pid) => {
          const participant = getParticipant(pid);
          if (!participant) return null;
          const pEntries = groupedEntries.map.get(pid) || [];
          const age = participant.birth_date
            ? differenceInYears(new Date(), new Date(participant.birth_date))
            : null;

          return (
            <div
              key={pid}
              id={`nurse-section-${pid}`}
              className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] overflow-hidden transition-shadow"
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/[0.06] border-b border-primary/10">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={participant.image_url || undefined} alt={participant.name} />
                  <AvatarFallback className="text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{participant.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {participant.cabin?.name || 'Ingen hytte'}
                    {age ? ` · ${age} år` : ''}
                    {' · '}
                    {pEntries.length} notat{pEntries.length !== 1 ? 'er' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setActiveParticipant(participant);
                      inputRef.current?.focus();
                    }}
                  >
                    + Notat
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setDeleteTarget({ type: 'section', id: pid, participantId: pid, name: participant.name })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Entries */}
              <div className="divide-y divide-border/50">
                {pEntries.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 group">
                    <div className="flex items-start gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(entry.created_at), 'd. MMM HH:mm', { locale: nb })}
                        </span>
                        {editingEntry === entry.id ? (
                          <div className="mt-1">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="text-sm min-h-[60px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  updateEntry(entry.id);
                                }
                                if (e.key === 'Escape') {
                                  setEditingEntry(null);
                                  setEditText('');
                                }
                              }}
                            />
                            <div className="flex gap-1 mt-1">
                              <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={() => updateEntry(entry.id)}>
                                Lagre
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditingEntry(null); setEditText(''); }}>
                                Avbryt
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="text-sm leading-relaxed cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                            onClick={() => {
                              setEditingEntry(entry.id);
                              setEditText(entry.mention_text);
                            }}
                          >
                            {entry.mention_text}
                          </p>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'entry',
                            id: entry.id,
                            participantId: pid,
                            name: participant.name,
                          })
                        }
                        aria-label="Slett notat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'section' ? 'Slett alle notater?' : 'Slett notat?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'section'
                ? `Er du sikker på at du vil slette alle notater for ${deleteTarget.name}?`
                : 'Er du sikker på at du vil slette dette notatet?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
