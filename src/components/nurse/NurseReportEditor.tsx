import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Save, Loader2, Download, User, FileText, Search } from 'lucide-react';
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

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionRangeRef = useRef<Range | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HTMLElement | null>(null);

  const getParticipant = useCallback((id: string) => participants.find((p) => p.id === id), [participants]);

  const getSectionFromNode = useCallback((node: Node | null): HTMLElement | null => {
    if (!node) return null;
    if (node instanceof HTMLElement) {
      return node.closest('.participant-section');
    }
    return node.parentElement?.closest('.participant-section') || null;
  }, []);

  const getTopLevelNode = useCallback((node: Node | null): ChildNode | null => {
    if (!node || !editorRef.current) return null;
    let current: Node | null = node instanceof HTMLElement ? node : node.parentNode;

    while (current && current.parentNode && current.parentNode !== editorRef.current) {
      current = current.parentNode;
    }

    return current as ChildNode | null;
  }, []);

  const createDeleteButton = useCallback((participantName?: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('contenteditable', 'false');
    button.setAttribute('data-section-delete', 'true');
    button.setAttribute('aria-label', `Slett notat for ${participantName || 'deltaker'}`);
    button.textContent = 'Slett';
    button.style.cssText = [
      'margin-left:auto',
      'border:1px solid hsl(var(--border))',
      'background:hsl(var(--background))',
      'color:hsl(var(--foreground))',
      'border-radius:9999px',
      'padding:6px 10px',
      'font-size:12px',
      'line-height:1',
      'cursor:pointer',
      'flex-shrink:0'
    ].join(';');
    return button;
  }, []);

  const normalizeParticipantSections = useCallback((root: HTMLElement) => {
    let nestedSections = Array.from(root.querySelectorAll('.participant-section .participant-section')) as HTMLElement[];

    while (nestedSections.length > 0) {
      nestedSections.forEach((section) => {
        const parentSection = section.parentElement?.closest('.participant-section') as HTMLElement | null;
        if (!parentSection) return;

        parentSection.insertAdjacentElement('afterend', section);

        const next = section.nextElementSibling as HTMLElement | null;
        const hasSpacer = next?.tagName === 'P' && !next.textContent?.trim();
        if (!hasSpacer) {
          const spacer = document.createElement('p');
          spacer.innerHTML = '<br>';
          section.insertAdjacentElement('afterend', spacer);
        }
      });

      nestedSections = Array.from(root.querySelectorAll('.participant-section .participant-section')) as HTMLElement[];
    }
  }, []);

  const ensureSectionActions = useCallback((root: HTMLElement) => {
    const sections = Array.from(root.querySelectorAll('.participant-section')) as HTMLElement[];

    sections.forEach((section) => {
      const header = section.firstElementChild as HTMLElement | null;
      if (!header) return;

      header.style.pointerEvents = 'auto';
      if (!header.querySelector('[data-section-delete="true"]')) {
        const participantName = getParticipant(section.dataset.participantId || '')?.name;
        header.appendChild(createDeleteButton(participantName));
      }
    });
  }, [createDeleteButton, getParticipant]);

  const prepareEditorDom = useCallback(() => {
    if (!editorRef.current) return;
    normalizeParticipantSections(editorRef.current);
    ensureSectionActions(editorRef.current);
  }, [ensureSectionActions, normalizeParticipantSections]);

  const getCleanEditorHtml = useCallback(() => {
    if (!editorRef.current) return '<p><br></p>';

    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    normalizeParticipantSections(clone);
    clone.querySelectorAll('[data-section-delete="true"]').forEach((button) => button.remove());

    const html = clone.innerHTML.trim();
    return html || '<p><br></p>';
  }, [normalizeParticipantSections]);

  useEffect(() => {
    loadReport();
  }, []);

  useEffect(() => {
    if (!isLoading && editorRef.current && pendingContentRef.current !== null) {
      editorRef.current.innerHTML = pendingContentRef.current;
      pendingContentRef.current = null;
      prepareEditorDom();
    }
  }, [isLoading, prepareEditorDom]);

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

        let content = report.content || '<p><br></p>';
        if (content.trim().startsWith('[')) {
          try {
            const lines = JSON.parse(content);
            if (Array.isArray(lines)) {
              content = lines.map((line: any) => {
                const mentionedNames = (line.mentionIds || [])
                  .map((id: string) => participants.find((p) => p.id === id))
                  .filter(Boolean);
                let text = line.text || '';
                for (const p of mentionedNames) {
                  text = text.replace(`@${p.name}`, `<strong>@${p.name}</strong>`);
                }
                return `<p><span style="color:hsl(var(--muted-foreground));font-size:12px;">${line.timestamp || ''}</span> ${text}</p>`;
              }).join('') || '<p><br></p>';
            }
          } catch {
            // not JSON, use as-is
          }
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

    prepareEditorDom();
    const content = getCleanEditorHtml();

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('nurse_reports')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [getCleanEditorHtml, prepareEditorDom, reportId]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveReport(), 2000);
  }, [saveReport]);

  const syncToParticipantNotes = useCallback(async () => {
    if (!reportId || !editorRef.current) return;

    prepareEditorDom();

    try {
      await supabase.from('nurse_report_mentions').delete().eq('report_id', reportId);

      const sections = Array.from(editorRef.current.querySelectorAll('.participant-section')) as HTMLElement[];
      const mentionEntries: { report_id: string; participant_id: string; mention_text: string }[] = [];
      const activeParticipantIds = new Set<string>();

      for (const section of sections) {
        const pid = section.getAttribute('data-participant-id');
        if (!pid) continue;

        const contentEl = section.querySelector('.participant-content');
        const text = contentEl?.textContent?.trim() || '';
        if (!text) continue;

        activeParticipantIds.add(pid);
        mentionEntries.push({
          report_id: reportId,
          participant_id: pid,
          mention_text: text,
        });

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

        const { data: existingInfo } = await supabase
          .from('participant_health_info')
          .select('id, info')
          .eq('participant_id', pid)
          .limit(1);

        const nurseInfo = `[Nurse] ${text}`;
        if (!existingInfo || existingInfo.length === 0) {
          await supabase.from('participant_health_info').insert({
            participant_id: pid,
            info: nurseInfo,
          });
        } else if ((existingInfo[0].info || '').startsWith('[Nurse]')) {
          await supabase
            .from('participant_health_info')
            .update({ info: nurseInfo, updated_at: new Date().toISOString() })
            .eq('id', existingInfo[0].id);
        }
      }

      const { data: existingNurseNotes } = await supabase
        .from('participant_health_notes')
        .select('id, participant_id')
        .eq('created_by', leader?.id || '')
        .like('content', '[Nurse Rapport]%');

      const staleNoteIds = (existingNurseNotes || [])
        .filter((note) => !activeParticipantIds.has(note.participant_id))
        .map((note) => note.id);

      if (staleNoteIds.length > 0) {
        await supabase.from('participant_health_notes').delete().in('id', staleNoteIds);
      }

      const { data: existingNurseInfo } = await supabase
        .from('participant_health_info')
        .select('id, participant_id, info')
        .like('info', '[Nurse]%');

      const staleInfoIds = (existingNurseInfo || [])
        .filter((info) => (info.info || '').startsWith('[Nurse]'))
        .filter((info) => !activeParticipantIds.has(info.participant_id))
        .map((info) => info.id);

      if (staleInfoIds.length > 0) {
        await supabase.from('participant_health_info').delete().in('id', staleInfoIds);
      }

      if (mentionEntries.length > 0) {
        await supabase.from('nurse_report_mentions').insert(mentionEntries);
      }
    } catch (error) {
      console.error('Error syncing mention data:', error);
    }
  }, [leader?.id, prepareEditorDom, reportId]);

  const persistReportState = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveReport();
    await syncToParticipantNotes();
  }, [saveReport, syncToParticipantNotes]);

  const handleManualSave = async () => {
    await persistReportState();
    hapticSuccess();
    toast.success('Rapport lagret og synkronisert');
  };

  const filteredMentionParticipants = mentionQuery !== null
    ? participants
        .filter((p) => p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  const createParticipantSection = (participant: Participant): string => {
    const age = participant.birth_date ? differenceInYears(new Date(), new Date(participant.birth_date)) : null;
    const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
    const imgHtml = participant.image_url
      ? `<img src="${participant.image_url}" alt="${participant.name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<span style="width:32px;height:32px;border-radius:50%;background:hsl(var(--muted));display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:hsl(var(--muted-foreground));">👤</span>`;

    return `<div class="participant-section" data-participant-id="${participant.id}" contenteditable="false" style="border:2px solid hsl(var(--primary)/0.3);border-radius:12px;margin:12px 0;background:hsl(var(--primary)/0.04);overflow:hidden;">
      <div class="participant-section-header" contenteditable="false" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:hsl(var(--primary)/0.08);border-bottom:1px solid hsl(var(--primary)/0.15);">
        ${imgHtml}
        <div>
          <strong style="font-size:15px;color:hsl(var(--foreground));">${participant.name}</strong>
          <div style="font-size:12px;color:hsl(var(--muted-foreground));">${participant.cabin?.name || 'Ingen hytte'}${age ? ` · ${age} år` : ''}</div>
        </div>
        <button type="button" contenteditable="false" data-section-delete="true" aria-label="Slett notat for ${participant.name}" style="margin-left:auto;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:9999px;padding:6px 10px;font-size:12px;line-height:1;cursor:pointer;flex-shrink:0;">Slett</button>
      </div>
      <div class="participant-content" contenteditable="true" style="padding:10px 14px;min-height:40px;outline:none;font-size:14px;line-height:1.6;" data-placeholder="Skriv notater om ${participant.name}...">
        <p><span style="color:hsl(var(--muted-foreground));font-size:12px;">${timestamp}</span> </p>
      </div>
    </div><p><br></p>`;
  };

  const findExistingSection = (participantId: string): HTMLElement | null => {
    if (!editorRef.current) return null;
    return editorRef.current.querySelector(`[data-participant-id="${participantId}"]`);
  };

  const focusSectionContent = (section: HTMLElement) => {
    const contentEl = section.querySelector('.participant-content') as HTMLElement | null;
    if (!contentEl) return;

    const lastP = contentEl.querySelector('p:last-child');
    if (lastP) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(lastP);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    contentEl.focus();
  };

  const insertParticipantSection = (participant: Participant) => {
    const existing = findExistingSection(participant.id);
    if (existing) {
      existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const contentEl = existing.querySelector('.participant-content') as HTMLElement | null;
      if (contentEl) {
        const timestamp = format(new Date(), 'd. MMM HH:mm', { locale: nb });
        const p = document.createElement('p');
        p.innerHTML = `<span style="color:hsl(var(--muted-foreground));font-size:12px;">${timestamp}</span> `;
        contentEl.appendChild(p);
        focusSectionContent(existing);
      }
      setMentionQuery(null);
      mentionRangeRef.current = null;
      debouncedSave();
      return;
    }

    const insertionNode = mentionRangeRef.current?.startContainer || window.getSelection()?.anchorNode || null;
    const currentSection = getSectionFromNode(insertionNode);
    const topLevelNode = getTopLevelNode(insertionNode);

    if (mentionRangeRef.current) {
      mentionRangeRef.current.deleteContents();
      mentionRangeRef.current.collapse(false);
    }

    const template = document.createElement('template');
    template.innerHTML = createParticipantSection(participant);
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    if (currentSection && currentSection.parentNode) {
      currentSection.parentNode.insertBefore(fragment, currentSection.nextSibling);
    } else if (topLevelNode && topLevelNode.parentNode === editorRef.current) {
      topLevelNode.parentNode.insertBefore(fragment, topLevelNode.nextSibling);
    } else {
      editorRef.current?.appendChild(fragment);
    }

    prepareEditorDom();
    mentionRangeRef.current = null;
    setMentionQuery(null);
    debouncedSave();

    setTimeout(() => {
      const newSection = findExistingSection(participant.id);
      if (newSection) {
        focusSectionContent(newSection);
      }
    }, 50);
  };

  const deleteParticipantSection = useCallback(async (section: HTMLElement) => {
    const participantName = getParticipant(section.dataset.participantId || '')?.name || 'notatet';
    const next = section.nextElementSibling as HTMLElement | null;
    if (next?.tagName === 'P' && !next.textContent?.trim()) {
      next.remove();
    }

    section.remove();
    setMentionQuery(null);
    mentionRangeRef.current = null;
    prepareEditorDom();
    await persistReportState();
    toast.success(`Slettet notat for ${participantName}`);
  }, [getParticipant, persistReportState, prepareEditorDom]);

  const handleInput = () => {
    prepareEditorDom();
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
          const mentionRange = document.createRange();
          mentionRange.setStart(textNode, lastAtIndex);
          mentionRange.setEnd(textNode, cursorPos);
          mentionRangeRef.current = mentionRange;

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

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const deleteButton = target.closest('[data-section-delete="true"]');
    if (!deleteButton) return;

    e.preventDefault();
    e.stopPropagation();

    const section = deleteButton.closest('.participant-section') as HTMLElement | null;
    if (!section) return;

    setDeleteTarget(section);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteParticipantSection(deleteTarget);
    setDeleteTarget(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        insertParticipantSection(filteredMentionParticipants[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    const mentionPattern = /@([^\n@]+)/g;
    let match;
    const foundParticipants: { participant: Participant; fullMatch: string }[] = [];

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const found = participants.find((p) =>
        p.name.toLowerCase() === mentionName.toLowerCase() ||
        p.name.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (found) {
        foundParticipants.push({ participant: found, fullMatch: match[0] });
      }
    }

    if (foundParticipants.length === 0) {
      document.execCommand('insertText', false, text);
      return;
    }

    let remaining = text;
    for (const { participant, fullMatch } of foundParticipants) {
      const idx = remaining.indexOf(fullMatch);
      if (idx > 0) {
        document.execCommand('insertText', false, remaining.slice(0, idx));
      }

      const afterMention = remaining.slice(idx + fullMatch.length);
      const nextAtIdx = afterMention.search(/@[A-ZÆØÅa-zæøå]/);
      const participantText = nextAtIdx >= 0 ? afterMention.slice(0, nextAtIdx).trim() : afterMention.trim();

      const existing = findExistingSection(participant.id);
      if (existing) {
        const contentEl = existing.querySelector('.participant-content') as HTMLElement | null;
        if (contentEl) {
          const p = document.createElement('p');
          p.textContent = participantText;
          contentEl.appendChild(p);
        }
      } else {
        const html = createParticipantSection(participant);
        document.execCommand('insertHTML', false, html);
        const section = findExistingSection(participant.id);
        if (section) {
          const contentEl = section.querySelector('.participant-content');
          if (contentEl && participantText) {
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

    prepareEditorDom();
    debouncedSave();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !editorRef.current) return;

    const sections = editorRef.current.querySelectorAll('[data-participant-id]');
    for (const section of sections) {
      const pid = section.getAttribute('data-participant-id');
      const participant = pid ? getParticipant(pid) : null;
      if (participant && participant.name.toLowerCase().includes(query.toLowerCase())) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (section as HTMLElement).style.boxShadow = '0 0 0 3px hsl(var(--primary))';
        setTimeout(() => {
          (section as HTMLElement).style.boxShadow = '';
        }, 2000);
        break;
      }
    }
  };

  const exportPdf = () => {
    if (!editorRef.current) return;
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });
    const cleanHtml = getCleanEditorHtml();

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
${cleanHtml}
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

      {/* Search bar — jumps to participant section in doc */}
      <div className="relative py-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter deltaker i rapporten..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto">
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

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[400px] outline-none text-sm leading-relaxed p-3 rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleEditorClick}
          data-placeholder='Skriv her — legg til deltaker med "@navn"'
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        />

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
          .participant-content:focus {
            outline: none;
          }
          .participant-section {
            position: relative;
          }
          .participant-section [data-section-delete="true"]:hover {
            filter: brightness(0.96);
          }
        `}</style>
      </div>
    </div>
  );
}
