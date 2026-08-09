import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  CheckSquare, Undo2, Redo2, Highlighter, RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  // Load content when switching notes (never while typing in the same note)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialContent || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

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
        { icon: Undo2, label: 'Angre', run: () => exec('undo') },
        { icon: Redo2, label: 'Gjør om', run: () => exec('redo') },
      ],
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      exec(e.key.toLowerCase() === 'b' ? 'bold' : e.key.toLowerCase() === 'i' ? 'italic' : 'underline');
      onChange(ref.current?.innerHTML ?? '');
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
                }}
              >
                <t.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-background/60">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onBlur={() => onChange(ref.current?.innerHTML ?? '')}
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
          }
        }}
        data-placeholder="Skriv notatet her…"
        className={cn(
          'mx-auto w-full max-w-[70ch] min-h-full p-5 sm:p-8',
          'text-[15px] leading-7 outline-none',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
        )}
      />
      </div>
    </div>
  );
}