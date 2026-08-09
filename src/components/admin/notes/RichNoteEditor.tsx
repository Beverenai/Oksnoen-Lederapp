import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  CheckSquare, Undo2, Redo2, Highlighter, RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParticipants } from '@/hooks/useParticipants';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';

interface RichNoteEditorProps {
  noteId: string;
  initialContent: string;
  onChange: (html: string) => void;
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

type ToolGroup = { key: string; tools: { icon: typeof Bold; label: string; run: () => void }[] };

export function RichNoteEditor({ noteId, initialContent, onChange }: RichNoteEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: participants = [] } = useParticipants();
  const [mention, setMention] = useState<
    { query: string; index: number; left: number; top: number } | null
  >(null);

  // ---- Undo / redo history (own stack — execCommand's stack breaks on our DOM edits)
  const history = useRef<string[]>([]);
  const pointer = useRef(-1);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applying = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(null);

  const syncFlags = () => {
    setCanUndo(pointer.current > 0);
    setCanRedo(pointer.current < history.current.length - 1);
  };

  const resetHistory = (html: string) => {
    history.current = [html];
    pointer.current = 0;
    syncFlags();
  };

  const commitHistory = (html: string) => {
    if (applying.current) return;
    if (history.current[pointer.current] === html) return;
    history.current = history.current.slice(0, pointer.current + 1);
    history.current.push(html);
    if (history.current.length > 100) history.current.shift();
    pointer.current = history.current.length - 1;
    syncFlags();
  };

  const pushSnapshot = (immediate = false) => {
    const html = ref.current?.innerHTML ?? '';
    if (pushTimer.current) clearTimeout(pushTimer.current);
    if (immediate) { commitHistory(html); return; }
    pushTimer.current = setTimeout(() => commitHistory(ref.current?.innerHTML ?? ''), 500);
  };

  const applyHistory = (dir: -1 | 1) => {
    if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
    commitHistory(ref.current?.innerHTML ?? '');
    const next = pointer.current + dir;
    if (next < 0 || next >= history.current.length) { syncFlags(); return; }
    pointer.current = next;
    applying.current = true;
    if (ref.current) {
      ref.current.innerHTML = history.current[next];
      // put caret at the end of the restored content
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      onChange(ref.current.innerHTML);
    }
    applying.current = false;
    setMention(null);
    syncFlags();
  };

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase().trim();
    const list = q
      ? participants.filter((p) => {
          const name = (p.name || '').toLowerCase();
          if (name.includes(q)) return true;
          // match on any name part ("and" -> "Nils Andersen")
          return name.split(/\s+/).some((part) => part.startsWith(q));
        })
      : participants;
    return list.slice(0, 8);
  }, [mention, participants]);

  const MENTION_RE = /@([\p{L}\p{N}'-]*(?:\s[\p{L}\p{N}'-]+)?)$/u;

  /** Text inside the editor from its start up to the caret. Works for text and element anchors. */
  const textBeforeCaret = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return null;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer)) return null;
    const probe = document.createRange();
    probe.selectNodeContents(ref.current);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString();
  };

  const caretRect = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    const rect = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!rect || (rect.top === 0 && rect.left === 0)) {
      const el = (sel.anchorNode as HTMLElement | null)?.parentElement;
      const b = el?.getBoundingClientRect();
      return b ? { left: b.left, top: b.top, bottom: b.bottom } : null;
    }
    return { left: rect.left, top: rect.top, bottom: rect.bottom };
  };

  // Detect the "@query" the caret currently sits after
  const detectMention = () => {
    const before = textBeforeCaret();
    if (before == null) { setMention(null); return; }
    const m = before.replace(/\u00a0/g, ' ').match(MENTION_RE);
    if (!m) { setMention(null); return; }
    const rect = caretRect();
    const top = rect ? Math.min(rect.bottom + 6, window.innerHeight - 280) : 80;
    const left = rect ? Math.min(rect.left, window.innerWidth - 280) : 40;
    setMention((prev) => ({ query: m[1], index: prev?.query === m[1] ? prev.index : 0, left, top }));
  };

  const insertMention = (name: string, imageUrl?: string | null, participantId?: string) => {
    if (!ref.current) return;
    const before = textBeforeCaret();
    if (before == null) return;
    const m = before.replace(/\u00a0/g, ' ').match(MENTION_RE);
    if (!m) return;
    ref.current.focus();
    // Remove the typed "@query" (works regardless of node boundaries)
    for (let i = 0; i < m[0].length; i += 1) exec('delete');
    const safeName = name.replace(/"/g, '&quot;');
    const img = imageUrl
      ? `<img class="note-mention-img" src="${imageUrl.replace(/"/g, '&quot;')}" alt="" />`
      : '';
    exec(
      'insertHTML',
      `<span class="note-mention" contenteditable="false" data-mention="${safeName}"` +
        `${participantId ? ` data-participant-id="${participantId}"` : ''}>${img}@${name}</span>&nbsp;`,
    );
    setMention(null);
    if (ref.current) onChange(ref.current.innerHTML);
    pushSnapshot(true);
  };

  // Load content when switching notes (never while typing in the same note)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialContent || '';
    resetHistory(initialContent || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => () => { if (pushTimer.current) clearTimeout(pushTimer.current); }, []);

  const groups: ToolGroup[] = [
    {
      key: 'text',
      tools: [
        { icon: Heading1, label: 'Tittel', run: () => exec('formatBlock', '<h2>') },
        { icon: Heading2, label: 'Undertittel', run: () => exec('formatBlock', '<h3>') },
        { icon: Bold, label: 'Fet (⌘B)', run: () => exec('bold') },
        { icon: Italic, label: 'Kursiv (⌘I)', run: () => exec('italic') },
        { icon: Underline, label: 'Understrek (⌘U)', run: () => exec('underline') },
        { icon: Highlighter, label: 'Marker', run: () => exec('hiliteColor', '#fde68a') },
      ],
    },
    {
      key: 'lists',
      tools: [
        { icon: List, label: 'Punktliste', run: () => exec('insertUnorderedList') },
        { icon: ListOrdered, label: 'Nummerert liste', run: () => exec('insertOrderedList') },
        { icon: CheckSquare, label: 'Sjekkliste ([] + mellomrom)', run: () => exec('insertHTML', '<div>☐&nbsp;</div>') },
      ],
    },
    {
      key: 'history',
      tools: [
        { icon: RemoveFormatting, label: 'Fjern format', run: () => exec('removeFormat') },
      ],
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      applyHistory(e.shiftKey ? 1 : -1);
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      applyHistory(1);
      return;
    }
    if (mention && matches.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setMention((m) => m && ({
          ...m,
          index: (m.index + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length,
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const p = matches[mention.index];
        insertMention(p?.name ?? '', p?.image_thumb_url || p?.image_url);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return; }
    }
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      exec(e.key.toLowerCase() === 'b' ? 'bold' : e.key.toLowerCase() === 'i' ? 'italic' : 'underline');
      onChange(ref.current?.innerHTML ?? '');
      pushSnapshot(true);
      return;
    }
    if (e.key === ' ') {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const text = node?.textContent ?? '';
      if (/\[\]$/.test(text.slice(0, sel?.anchorOffset ?? 0))) {
        e.preventDefault();
        if (node && node.nodeType === Node.TEXT_NODE) {
          const offset = sel!.anchorOffset;
          node.textContent = text.slice(0, offset - 2) + '☐\u00a0' + text.slice(offset);
          const range = document.createRange();
          range.setStart(node, offset);
          range.collapse(true);
          sel!.removeAllRanges();
          sel!.addRange(range);
          onChange(ref.current?.innerHTML ?? '');
          pushSnapshot(true);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border/60 bg-background/90 backdrop-blur px-1 pb-2 mb-2">
        {groups.map((g, gi) => (
          <div key={g.key} className="flex items-center gap-1">
            {gi > 0 && <span className="mx-1 h-5 w-px bg-border/70" aria-hidden />}
            {g.tools.map((t) => (
              <Button
                key={t.label}
                type="button"
                variant="ghost"
                size="sm"
                title={t.label}
                className="h-8 w-8 p-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  ref.current?.focus();
                  t.run();
                  if (ref.current) onChange(ref.current.innerHTML);
                  pushSnapshot(true);
                }}
              >
                <t.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        ))}
        <span className="mx-1 h-5 w-px bg-border/70" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Angre (⌘Z)"
          disabled={!canUndo}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { ref.current?.focus(); applyHistory(-1); }}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Gjør om (⇧⌘Z)"
          disabled={!canRedo}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { ref.current?.focus(); applyHistory(1); }}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-background/60">
      <div className="relative">
      {mention && matches.length > 0 && (
        <div
          style={{ left: mention.left, top: mention.top }}
          className="fixed z-[60] w-64 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur shadow-lg p-1"
        >
          {matches.map((p, i) => {
            const src = p.image_thumb_url || p.image_url;
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(p.name, src); }}
                className={cn(
                  'w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-sm',
                  i === mention.index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-7 w-7 shrink-0 rounded-full object-cover border border-border/60"
                  />
                ) : (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground grid place-items-center text-[11px] font-medium">
                    {(p.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { onChange(ref.current?.innerHTML ?? ''); detectMention(); pushSnapshot(); }}
        onKeyUp={detectMention}
        onBlur={() => { onChange(ref.current?.innerHTML ?? ''); pushSnapshot(true); setTimeout(() => setMention(null), 100); }}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const text = target.textContent || '';
          if (target.isContentEditable === false) return;
          if (/^\s*[☐☑]/.test(text) && target !== ref.current) {
            target.textContent = text.startsWith('☐')
              ? text.replace('☐', '☑')
              : text.replace('☑', '☐');
            target.style.textDecoration = text.startsWith('☐') ? 'line-through' : 'none';
            target.style.opacity = text.startsWith('☐') ? '0.6' : '1';
            onChange(ref.current?.innerHTML ?? '');
            pushSnapshot(true);
          }
        }}
        data-placeholder="Skriv notatet her…"
        className={cn(
          'mx-auto w-full max-w-[70ch] min-h-full p-5 sm:p-8',
          'text-[15px] leading-7 outline-none',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_.note-mention]:rounded-md [&_.note-mention]:bg-primary/15 [&_.note-mention]:text-primary [&_.note-mention]:px-1 [&_.note-mention]:py-0.5 [&_.note-mention]:font-medium',
          '[&_.note-mention]:inline-flex [&_.note-mention]:items-center [&_.note-mention]:gap-1 [&_.note-mention]:align-middle',
          '[&_.note-mention-img]:h-5 [&_.note-mention-img]:w-5 [&_.note-mention-img]:rounded-full [&_.note-mention-img]:object-cover [&_.note-mention-img]:inline-block',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
        )}
      />
      </div>
      </div>
    </div>
  );
}