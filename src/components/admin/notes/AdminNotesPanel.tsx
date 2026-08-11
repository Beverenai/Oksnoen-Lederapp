import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  NotebookPen, Plus, PenLine, Pin, PinOff, Trash2, FileText, Presentation, Check, Loader2,
  Search, Copy, Maximize2, Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminNotes, type AdminNote } from '@/hooks/useAdminNotes';
import { RichNoteEditor } from './RichNoteEditor';
import { NotesWhiteboard, type Stroke } from './NotesWhiteboard';
import { NOTE_TEMPLATES } from './NoteTemplates';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { hapticImpact } from '@/lib/capacitorHaptics';

function relTime(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'nå';
  if (min < 60) return `${min} min siden`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.round(h / 24)} d siden`;
}

function stripHtml(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return (el.textContent || '').replace(/\u00a0/g, ' ').trim();
}

export function AdminNotesPanel() {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const { showError } = useStatusPopup();
  const {
    notes, isLoading, activeId, setActiveId, createNote, patchNote, deleteNote,
    duplicateNote, leaderNames,
  } = useAdminNotes(open);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingRef = useRef<Record<string, { id: string; patch: Record<string, unknown> }>>({});
  const [titleDraft, setTitleDraft] = useState('');

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || stripHtml(n.content || '').toLowerCase().includes(q),
    );
  }, [notes, query]);

  const pinned = filtered.filter((n) => n.is_pinned);
  const rest = filtered.filter((n) => !n.is_pinned);

  const setSavingFlag = (v: boolean) => {
    if (savingRef.current === v) return;
    savingRef.current = v;
    setSaving(v);
  };

  // Persist every queued edit right away (note switch, close, tab hidden, unmount)
  const flushPending = useRef<() => Promise<void>>(async () => {});
  flushPending.current = async () => {
    const entries = Object.entries(pendingRef.current);
    if (entries.length === 0) return;
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    pendingRef.current = {};
    try {
      await Promise.all(entries.map(([, e]) => patchNote(e.id, e.patch as never)));
    } catch {
      showError('Kunne ikke lagre notatet');
    } finally {
      setSavingFlag(false);
    }
  };

  // Flush before switching note or closing the panel
  const prevActive = useRef<string | null>(null);
  useEffect(() => {
    if (prevActive.current && prevActive.current !== activeId) {
      void flushPending.current();
    }
    prevActive.current = activeId;
    setTitleDraft(active?.title ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!open) void flushPending.current();
  }, [open]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flushPending.current(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flushPending.current();
    };
  }, []);

  const queueSave = (id: string, patch: Record<string, unknown>) => {
    const field = Object.keys(patch)[0] ?? 'x';
    const key = `${id}:${field}`;
    setSavingFlag(true);
    pendingRef.current[key] = { id, patch };
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(async () => {
      delete timersRef.current[key];
      delete pendingRef.current[key];
      try {
        await patchNote(id, patch as never);
      } catch {
        showError('Kunne ikke lagre notatet');
      } finally {
        if (Object.keys(timersRef.current).length === 0) setSavingFlag(false);
      }
    }, 250);
  };

  const handleCreate = async (kind: 'doc' | 'board') => {
    try {
      hapticImpact('light');
      await createNote(kind);
    } catch {
      showError('Kunne ikke opprette notat');
    }
  };

  const handleTemplate = async (key: string) => {
    const tpl = NOTE_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    try {
      hapticImpact('light');
      await createNote('doc', { title: tpl.title, content: tpl.content });
    } catch {
      showError('Kunne ikke opprette notat');
    }
  };

  // Auto-title from first line while the note still has its default name
  const maybeAutoTitle = (note: AdminNote, html: string) => {
    if (note.title !== 'Nytt notat') return;
    const first = stripHtml(html).split('\n')[0]?.slice(0, 60).trim();
    if (!first) return;
    setTitleDraft(first);
    queueSave(note.id, { title: first });
  };

  const NoteRow = ({ n, compact }: { n: AdminNote; compact?: boolean }) => (
    <button
      type="button"
      data-note-chip={compact ? n.id : undefined}
      onClick={() => setActiveId(n.id)}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
        compact ? 'shrink-0 whitespace-nowrap rounded-full py-1.5 text-xs' : 'w-full',
        n.id === activeId
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border/60 bg-card/60 text-muted-foreground hover:bg-card',
      )}
    >
      {n.kind === 'board' ? <Presentation className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
      <span className={cn('min-w-0 flex-1', compact && 'max-w-[140px]')}>
        <span className="block truncate text-[13px] font-medium text-foreground">{n.title}</span>
        {!compact && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {relTime(n.updated_at)}
            {n.updated_by && leaderNames[n.updated_by] ? ` · ${leaderNames[n.updated_by]}` : ''}
          </span>
        )}
      </span>
      {n.is_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
    </button>
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => { hapticImpact('medium'); setOpen(true); }}
        className="fixed right-4 bottom-24 lg:bottom-6 z-40 h-12 rounded-full shadow-lg px-4"
        aria-label="Åpne notater"
      >
        <NotebookPen className="h-5 w-5" />
        <span className="ml-2 hidden sm:inline">Notater</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cn(
            'flex h-[100dvh] max-h-[100dvh] flex-col gap-3 overflow-hidden px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]',
            fullscreen ? 'w-screen sm:max-w-none' : 'w-full sm:max-w-5xl',
          )}
        >
          <SheetHeader className="space-y-0 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4" />
              Notater
              <span className="hidden sm:inline text-xs font-normal text-muted-foreground">delt med alle admins</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
                {saving ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> lagrer…</>
                ) : (
                  <><Check className="h-3 w-3" /> lagret</>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title={fullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'}
                onClick={() => setFullscreen((v) => !v)}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 min-h-0 gap-3">
            {/* Sidebar (desktop) */}
            <aside className="hidden lg:flex w-[240px] shrink-0 flex-col gap-2 border-r border-border/60 pr-3">
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCreate('doc')}>
                  <Plus className="h-4 w-4 mr-1" /> Notat
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCreate('board')}>
                  <PenLine className="h-4 w-4 mr-1" /> Board
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søk i notater"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <ScrollArea className="flex-1 -mr-2 pr-2">
                <div className="flex flex-col gap-1.5 pb-2">
                  {isLoading && <span className="text-sm text-muted-foreground">Laster…</span>}
                  {!isLoading && filtered.length === 0 && (
                    <span className="text-sm text-muted-foreground">Ingen treff</span>
                  )}
                  {pinned.length > 0 && (
                    <>
                      <span className="px-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Festet</span>
                      {pinned.map((n) => <NoteRow key={n.id} n={n} />)}
                    </>
                  )}
                  {rest.length > 0 && pinned.length > 0 && (
                    <span className="px-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alle</span>
                  )}
                  {rest.map((n) => <NoteRow key={n.id} n={n} />)}
                </div>
              </ScrollArea>
            </aside>

            <div className="flex flex-1 min-w-0 flex-col gap-2">
              {/* Mobile controls */}
              <div className="lg:hidden flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCreate('doc')}>
                    <Plus className="h-4 w-4 mr-1" /> Notat
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCreate('board')}>
                    <PenLine className="h-4 w-4 mr-1" /> Whiteboard
                  </Button>
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Søk"
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>
                <div
                  ref={chipRowRef}
                  className="scrollbar-hide -mx-4 shrink-0 overflow-x-auto overflow-y-hidden px-4"
                  style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                >
                  <div className="flex w-max gap-2 pb-2">
                    {isLoading && <span className="text-sm text-muted-foreground">Laster…</span>}
                    {filtered.map((n) => <NoteRow key={n.id} n={n} compact />)}
                  </div>
                </div>
              </div>

              {active ? (
                <div className="flex flex-col flex-1 min-h-0 gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => {
                    const title = e.target.value;
                    setTitleDraft(title);
                    queueSave(active.id, { title });
                  }}
                  className="h-9 font-medium"
                  placeholder="Tittel"
                />
                <Badge variant="secondary" className="shrink-0 hidden sm:inline-flex">
                  {active.kind === 'board' ? 'Whiteboard' : 'Notat'}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 shrink-0"
                  title={active.is_pinned ? 'Fjern festing' : 'Fest øverst'}
                  onClick={() => patchNote(active.id, { is_pinned: !active.is_pinned } as never).catch(() => {})}
                >
                  {active.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 shrink-0"
                  title="Dupliser"
                  onClick={async () => {
                    try { await duplicateNote(active); } catch { showError('Kunne ikke duplisere'); }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 shrink-0 text-destructive"
                  title="Slett"
                  onClick={async () => {
                    if (!window.confirm(`Slette «${active.title}»?`)) return;
                    try { await deleteNote(active.id); } catch { showError('Kunne ikke slette'); }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Sist endret {relTime(active.updated_at)}
                {active.updated_by && leaderNames[active.updated_by] ? ` av ${leaderNames[active.updated_by]}` : ''}
              </p>

              {active.kind === 'board' ? (
                <NotesWhiteboard
                  noteId={active.id}
                  initialStrokes={(active.strokes as unknown as Stroke[]) || []}
                  onChange={(strokes) => queueSave(active.id, { strokes })}
                />
              ) : (
                <RichNoteEditor
                  noteId={active.id}
                  initialContent={active.content}
                  onChange={(html) => {
                    queueSave(active.id, { content: html });
                    maybeAutoTitle(active, html);
                  }}
                />
              )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                  <div>
                    <p className="text-sm font-medium">Ingen notat valgt</p>
                    <p className="text-sm text-muted-foreground">Start fra en mal, eller lag et tomt notat.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {NOTE_TEMPLATES.map((t) => (
                      <Button key={t.key} size="sm" variant="outline" onClick={() => handleTemplate(t.key)}>
                        <FileText className="h-4 w-4 mr-1" /> {t.label}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => handleCreate('board')}>
                      <PenLine className="h-4 w-4 mr-1" /> Whiteboard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}