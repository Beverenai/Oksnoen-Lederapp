import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Download, User, FileText, Search, Trash2, Clock, Plus, Pencil, ChevronRight } from 'lucide-react';
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
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

type EntrySource = 'mention' | 'health_note' | 'health_event';

interface ReportEntry {
  id: string;
  participant_id: string;
  text: string;
  created_at: string;
  source: EntrySource;
  source_label: string;
}

interface NurseReportEditorProps {
  participants: Participant[];
  onDataChange?: () => void;
  onOpenParticipant?: (participantId: string) => void;
}

const sourceLabels: Record<EntrySource, string> = {
  mention: 'Nurse',
  health_note: 'Nurse-notat',
  health_event: 'Hendelse',
};

export function NurseReportEditor({ participants, onDataChange, onOpenParticipant }: NurseReportEditorProps) {
  const { showSuccess, showError } = useStatusPopup();
  const { leader } = useAuth();
  const [reportId, setReportId] = useState<string | null>(null);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Aggregated data
  const [mentions, setMentions] = useState<{ id: string; participant_id: string; mention_text: string; created_at: string }[]>([]);
  const [healthNotes, setHealthNotes] = useState<{ id: string; participant_id: string; content: string; created_at: string }[]>([]);
  const [healthEvents, setHealthEvents] = useState<{ id: string; participant_id: string; event_type: string; description: string; created_at: string }[]>([]);

  // Add-note dialog
  const [addNoteFor, setAddNoteFor] = useState<Participant | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Delete confirmation (mention notes only — others are managed elsewhere)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; participantName: string } | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'recent' | 'name' | 'date'>('recent');

  const getParticipant = useCallback((id: string) => participants.find((p) => p.id === id), [participants]);

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel('nurse-report-period-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'periods' }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveActiveReportId = async (): Promise<string | null> => {
    try {
      const { data: periodRow } = await supabase
        .from('periods')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      const pid = periodRow?.id ?? null;

      let q = supabase
        .from('nurse_reports')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      if (pid) q = q.eq('period_id', pid);
      const { data: existing } = await q;
      if (existing && existing.length > 0) {
        if (existing[0].id !== reportId) setReportId(existing[0].id);
        if (pid !== activePeriodId) setActivePeriodId(pid);
        return existing[0].id;
      }
      const { data: created, error: createErr } = await supabase
        .from('nurse_reports')
        .insert({ content: '', created_by: leader?.id, period_id: pid })
        .select('id')
        .single();
      if (createErr) throw createErr;
      setReportId(created.id);
      setActivePeriodId(pid);
      return created.id;
    } catch (e) {
      console.error('resolveActiveReportId failed:', e);
      return null;
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const rid = await resolveActiveReportId();

      const [m, hn, he] = await Promise.all([
        rid
          ? supabase
              .from('nurse_report_mentions')
              .select('id, participant_id, mention_text, created_at')
              .eq('report_id', rid)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from('participant_health_notes')
          .select('id, participant_id, content, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('participant_health_events')
          .select('id, participant_id, event_type, description, created_at')
          .order('created_at', { ascending: true }),
      ]);

      setMentions((m as any).data || []);
      setHealthNotes((hn as any).data || []);
      setHealthEvents((he as any).data || []);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Error loading nurse data:', e);
      showError('Kunne ikke laste rapport');
    } finally {
      setIsLoading(false);
    }
  };

  // Combine all sources into one entry list
  const allEntries: ReportEntry[] = useMemo(() => {
    const out: ReportEntry[] = [];
    mentions.forEach((m) => {
      // Skip auto-generated "[Nurse Rapport]" duplicates that already exist as mentions
      out.push({
        id: m.id,
        participant_id: m.participant_id,
        text: m.mention_text,
        created_at: m.created_at,
        source: 'mention',
        source_label: m.mention_text?.startsWith('[Hendelse]') ? 'Hendelse (leder)' : sourceLabels.mention,
      });
    });
    healthNotes.forEach((n) => {
      // Skip the auto-synced "[Nurse Rapport] ..." note to avoid double-listing mentions
      if (n.content?.startsWith('[Nurse Rapport]')) return;
      out.push({
        id: n.id,
        participant_id: n.participant_id,
        text: n.content,
        created_at: n.created_at,
        source: 'health_note',
        source_label: sourceLabels.health_note,
      });
    });
    healthEvents.forEach((e) => {
      out.push({
        id: e.id,
        participant_id: e.participant_id,
        text: `${e.event_type}: ${e.description}`,
        created_at: e.created_at,
        source: 'health_event',
        source_label: sourceLabels.health_event,
      });
    });
    return out;
  }, [mentions, healthNotes, healthEvents]);

  // Group by participant. Default: most recently written report first.
  const groupedEntries = useMemo(() => {
    const map = new Map<string, ReportEntry[]>();
    allEntries.forEach((e) => {
      if (!map.has(e.participant_id)) map.set(e.participant_id, []);
      map.get(e.participant_id)!.push(e);
    });
    const latest = (pid: string) =>
      (map.get(pid) || []).reduce((acc, e) => (e.created_at > acc ? e.created_at : acc), '');
    const order = Array.from(map.keys()).sort((a, b) => {
      if (viewMode === 'name') {
        const pa = getParticipant(a)?.name || '';
        const pb = getParticipant(b)?.name || '';
        return pa.localeCompare(pb, 'nb');
      }
      return latest(b).localeCompare(latest(a));
    });
    order.forEach((pid) => {
      map.get(pid)!.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    });
    return { map, order };
  }, [allEntries, getParticipant, viewMode]);

  // Search across participants who have any entry
  const filteredOrder = useMemo(() => {
    if (!searchQuery.trim()) return groupedEntries.order;
    const q = searchQuery.toLowerCase();
    return groupedEntries.order.filter((pid) => {
      const p = getParticipant(pid);
      return p?.name.toLowerCase().includes(q);
    });
  }, [groupedEntries, searchQuery, getParticipant]);

  // Chronological view: group entries by day (newest day first)
  const dateGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const entries = allEntries.filter((e) => {
      if (!q) return true;
      const p = getParticipant(e.participant_id);
      return (p?.name.toLowerCase().includes(q) ?? false) || e.text.toLowerCase().includes(q);
    });
    const map = new Map<string, ReportEntry[]>();
    entries.forEach((e) => {
      const key = e.created_at ? e.created_at.slice(0, 10) : 'ukjent';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    const order = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    order.forEach((k) =>
      map.get(k)!.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    );
    return { map, order };
  }, [allEntries, searchQuery, getParticipant]);

  // Participants available for "add note" dropdown (all)
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [participants]
  );
  const [addPickerQuery, setAddPickerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerResults = useMemo(() => {
    if (!addPickerQuery.trim()) return sortedParticipants.slice(0, 20);
    const q = addPickerQuery.toLowerCase();
    return sortedParticipants.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [sortedParticipants, addPickerQuery]);

  const submitNewNote = async () => {
    if (!addNoteFor || !newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const rid = await resolveActiveReportId();
      if (!rid) throw new Error('Ingen aktiv rapport');
      const { data, error } = await supabase
        .from('nurse_report_mentions')
        .insert({ report_id: rid, participant_id: addNoteFor.id, mention_text: newNoteText.trim() })
        .select('id, participant_id, mention_text, created_at')
        .single();
      if (error) throw error;
      setMentions((prev) => [...prev, data]);
      setNewNoteText('');
      setAddNoteFor(null);
      hapticSuccess();
      showSuccess('Notat lagt til');
      onDataChange?.();
    } catch (e) {
      console.error('Error saving note:', e);
      showError('Kunne ikke lagre notat');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteMention = async (id: string) => {
    try {
      const { error } = await supabase.from('nurse_report_mentions').delete().eq('id', id);
      if (error) throw error;
      setMentions((prev) => prev.filter((m) => m.id !== id));
      showSuccess('Notat slettet');
      onDataChange?.();
    } catch (e) {
      console.error(e);
      showError('Kunne ikke slette');
    }
  };

  const startEdit = (entry: ReportEntry) => {
    setEditingId(entry.id);
    setEditText(entry.text);
  };

  const saveEdit = async (entry: ReportEntry) => {
    const value = editText.trim();
    if (!value) return;
    setSavingEdit(true);
    try {
      if (entry.source === 'mention') {
        const { error } = await supabase
          .from('nurse_report_mentions')
          .update({ mention_text: value })
          .eq('id', entry.id);
        if (error) throw error;
        setMentions((prev) => prev.map((m) => (m.id === entry.id ? { ...m, mention_text: value } : m)));
      } else if (entry.source === 'health_note') {
        const { error } = await supabase
          .from('participant_health_notes')
          .update({ content: value })
          .eq('id', entry.id);
        if (error) throw error;
        setHealthNotes((prev) => prev.map((n) => (n.id === entry.id ? { ...n, content: value } : n)));
      }
      setEditingId(null);
      hapticSuccess();
      showSuccess('Notat oppdatert');
      onDataChange?.();
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lagre endringen');
    } finally {
      setSavingEdit(false);
    }
  };

  const exportPdf = () => {
    const dateStr = format(new Date(), 'd. MMMM yyyy', { locale: nb });
    let sectionsHtml = '';
    for (const pid of groupedEntries.order) {
      const p = getParticipant(pid);
      if (!p) continue;
      const pEntries = groupedEntries.map.get(pid) || [];
      const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;

      sectionsHtml += `
        <div class="participant-section">
          <div class="header">
            ${p.image_url ? `<img src="${p.image_url}" />` : '<span class="avatar">👤</span>'}
            <div>
              <strong>${p.name}</strong>
              <div class="meta">${p.cabin?.name || 'Ingen hytte'}${age ? ` · ${age} år` : ''}</div>
            </div>
          </div>
          <div class="content">
            ${pEntries
              .map((e) => {
                const ts = e.created_at
                  ? format(new Date(e.created_at), 'd. MMM HH:mm', { locale: nb })
                  : '—';
                return `<p><span class="ts">${ts}</span> <span class="tag">${e.source_label}</span> ${escapeHtml(e.text)}</p>`;
              })
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
  .content p { margin: 6px 0; }
  .ts { color: #94a3b8; font-size: 12px; margin-right: 4px; }
  .tag { background: #e2e8f0; color: #475569; font-size: 11px; padding: 1px 6px; border-radius: 4px; margin-right: 6px; }
  @media print { body { padding: 12px; } .participant-section { break-inside: avoid; } }
</style></head><body>
<h1>Nurse Rapport</h1>
<p class="date">Eksportert: ${dateStr}</p>
${sectionsHtml || '<p style="color:#94a3b8;">Ingen data registrert.</p>'}
</body></html>`;

    try {
      const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nurse-rapport-${format(new Date(), 'yyyy-MM-dd')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showSuccess('Rapport lastet ned – åpne filen og bruk "Skriv ut → Lagre som PDF"');
    } catch (e) {
      console.error('Export failed:', e);
      showError('Kunne ikke laste ned rapport');
    }
  };

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground">
              Oppdatert {format(lastRefreshed, 'HH:mm')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Search + add note */}
      <div className="flex items-center gap-2 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'date' ? 'Søk deltaker eller tekst...' : 'Søk deltaker...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button size="sm" variant="default" onClick={() => { setPickerOpen(true); setAddPickerQuery(''); }}>
          <Plus className="w-4 h-4 mr-1" />
          Notat
        </Button>
      </div>

      {/* View mode */}
      <div className="flex items-center gap-1 pb-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Sortering</span>
        {(['participant', 'date'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setViewMode(m)}
            className={
              'px-3 py-1 rounded-full text-xs border ' +
              (viewMode === m
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground')
            }
          >
            {m === 'participant' ? 'Deltaker' : 'Dato'}
          </button>
        ))}
      </div>

      {viewMode === 'date' ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-1 pb-4">
          {dateGroups.order.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Ingen oppføringer.</p>
            </div>
          )}
          {dateGroups.order.map((day) => (
            <div key={day} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/60 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {day === 'ukjent' ? 'Ukjent dato' : format(new Date(day), 'EEEE d. MMMM', { locale: nb })}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {dateGroups.map.get(day)!.length} oppføringer
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {dateGroups.map.get(day)!.map((entry) => {
                  const p = getParticipant(entry.participant_id);
                  return (
                    <div key={`${entry.source}-${entry.id}`} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {entry.created_at ? format(new Date(entry.created_at), 'HH:mm') : '—'}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold hover:text-primary"
                          onClick={() => onOpenParticipant?.(entry.participant_id)}
                        >
                          {p?.name || 'Ukjent deltaker'}
                        </button>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {entry.source_label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0.5">{entry.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-1 pb-4">
        {filteredOrder.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Ingen data registrert ennå.</p>
          </div>
        )}

        {filteredOrder.map((pid) => {
          const p = getParticipant(pid);
          if (!p) return null;
          const pEntries = groupedEntries.map.get(pid) || [];
          const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;

          return (
            <div
              key={pid}
              id={`nurse-section-${pid}`}
              className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/[0.06] border-b border-primary/10">
                <button
                  type="button"
                  className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-primary/10 transition-colors"
                  onClick={() => onOpenParticipant?.(p.id)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={p.image_url || undefined} alt={p.name} />
                    <AvatarFallback className="text-xs"><User className="w-3 h-3" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.cabin?.name || 'Ingen hytte'}
                      {age ? ` · ${age} år` : ''}
                      {' · '}
                      {pEntries.length} oppføring{pEntries.length !== 1 ? 'er' : ''}
                    </div>
                  </div>
                  {onOpenParticipant && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setAddNoteFor(p); setNewNoteText(''); }}
                >
                  + Notat
                </Button>
              </div>

              <div className="divide-y divide-border/50">
                {pEntries.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 group">
                    <div className="flex items-start gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">
                            {entry.created_at ? format(new Date(entry.created_at), 'd. MMM HH:mm', { locale: nb }) : '—'}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {entry.source_label}
                          </span>
                        </div>
                        {editingId === entry.id ? (
                          <div className="mt-1 space-y-2">
                            <Textarea
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-[90px] text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Avbryt</Button>
                              <Button size="sm" onClick={() => saveEdit(entry)} disabled={savingEdit || !editText.trim()}>
                                {savingEdit ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                                Lagre
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0.5">
                            {entry.text}
                          </p>
                        )}
                      </div>
                      {entry.source !== 'health_event' && editingId !== entry.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="text-muted-foreground hover:text-primary p-1"
                            onClick={() => startEdit(entry)}
                            aria-label="Rediger notat"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {entry.source === 'mention' && (
                            <button
                              className="text-muted-foreground hover:text-destructive p-1"
                              onClick={() => setDeleteTarget({ id: entry.id, participantName: p.name })}
                              aria-label="Slett notat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add note dialog */}
      <ResponsiveDialog open={!!addNoteFor} onOpenChange={(o) => { if (!o) { setAddNoteFor(null); setNewNoteText(''); } }}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Nytt notat{addNoteFor ? ` — ${addNoteFor.name}` : ''}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 p-4">
            <Textarea
              autoFocus
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Skriv notat..."
              className="min-h-[120px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setAddNoteFor(null); setNewNoteText(''); }}>
                Avbryt
              </Button>
              <Button onClick={submitNewNote} disabled={savingNote || !newNoteText.trim()}>
                {savingNote ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Lagre notat
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Participant picker dialog */}
      <ResponsiveDialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Velg deltaker</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 p-4">
            <Input
              autoFocus
              placeholder="Søk navn..."
              value={addPickerQuery}
              onChange={(e) => setAddPickerQuery(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {pickerResults.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-muted"
                  onClick={() => {
                    setPickerOpen(false);
                    setAddNoteFor(p);
                    setNewNoteText('');
                  }}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={p.image_url || undefined} alt={p.name} />
                    <AvatarFallback className="text-xs"><User className="w-3 h-3" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.cabin?.name || 'Ingen hytte'}
                    </div>
                  </div>
                </button>
              ))}
              {pickerResults.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Ingen treff
                </div>
              )}
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett notat?</AlertDialogTitle>
            <AlertDialogDescription>
              Notatet for {deleteTarget?.participantName} blir slettet permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteMention(deleteTarget.id); setDeleteTarget(null); } }}>
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}