import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  NotebookPen, Plus, PenLine, Pin, PinOff, Trash2, FileText, Presentation, Check, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminNotes } from '@/hooks/useAdminNotes';
import { RichNoteEditor } from './RichNoteEditor';
import { NotesWhiteboard, type Stroke } from './NotesWhiteboard';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { hapticImpact } from '@/lib/capacitorHaptics';

export function AdminNotesPanel() {
  const [open, setOpen] = useState(false);
  const { showError } = useStatusPopup();
  const { notes, isLoading, activeId, setActiveId, createNote, patchNote, deleteNote } =
    useAdminNotes(open);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const queueSave = (id: string, patch: Record<string, unknown>) => {
    setSaving(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await patchNote(id, patch as never);
      } catch {
        showError('Kunne ikke lagre notatet');
      } finally {
        setSaving(false);
      }
    }, 700);
  };

  const handleCreate = async (kind: 'doc' | 'board') => {
    try {
      hapticImpact('light');
      await createNote(kind);
    } catch {
      showError('Kunne ikke opprette notat');
    }
  };

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
          className="w-full sm:max-w-3xl flex flex-col gap-3 p-4 pt-5"
        >
          <SheetHeader className="space-y-0 pr-8">
            <SheetTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4" />
              Notater
              <span className="text-xs font-normal text-muted-foreground">delt med alle admins</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
                {saving ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> lagrer…</>
                ) : (
                  <><Check className="h-3 w-3" /> lagret</>
                )}
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleCreate('doc')}>
              <Plus className="h-4 w-4 mr-1" /> Notat
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCreate('board')}>
              <PenLine className="h-4 w-4 mr-1" /> Whiteboard
            </Button>
          </div>

          <ScrollArea className="shrink-0">
            <div className="flex gap-2 pb-2">
              {isLoading && <span className="text-sm text-muted-foreground">Laster…</span>}
              {!isLoading && notes.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Ingen notater ennå – lag ditt første.
                </span>
              )}
              {notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  className={cn(
                    'flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    n.id === activeId
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 bg-card/60 text-muted-foreground hover:bg-card',
                  )}
                >
                  {n.kind === 'board' ? <Presentation className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  <span className="max-w-[140px] truncate">{n.title}</span>
                  {n.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>
          </ScrollArea>

          {active ? (
            <div className="flex flex-col flex-1 min-h-0 gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={active.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    patchNote(active.id, { title } as never).catch(() => {});
                    queueSave(active.id, { title });
                  }}
                  className="h-9 font-medium"
                  placeholder="Tittel"
                />
                <Badge variant="secondary" className="shrink-0">
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
                  onChange={(html) => queueSave(active.id, { content: html })}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Velg eller lag et notat
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}