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

export function RichNoteEditor({ noteId, initialContent, onChange }: RichNoteEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Load content when switching notes (never while typing in the same note)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialContent || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const tools: { icon: typeof Bold; label: string; run: () => void }[] = [
    { icon: Heading1, label: 'Tittel', run: () => exec('formatBlock', '<h2>') },
    { icon: Heading2, label: 'Undertittel', run: () => exec('formatBlock', '<h3>') },
    { icon: Bold, label: 'Fet', run: () => exec('bold') },
    { icon: Italic, label: 'Kursiv', run: () => exec('italic') },
    { icon: Underline, label: 'Understrek', run: () => exec('underline') },
    { icon: Highlighter, label: 'Marker', run: () => exec('hiliteColor', '#fde68a') },
    { icon: List, label: 'Punktliste', run: () => exec('insertUnorderedList') },
    { icon: ListOrdered, label: 'Nummerert liste', run: () => exec('insertOrderedList') },
    {
      icon: CheckSquare,
      label: 'Sjekkliste',
      run: () => exec('insertHTML', '<div>☐ </div>'),
    },
    { icon: RemoveFormatting, label: 'Fjern format', run: () => exec('removeFormat') },
    { icon: Undo2, label: 'Angre', run: () => exec('undo') },
    { icon: Redo2, label: 'Gjør om', run: () => exec('redo') },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap gap-1 border-b border-border/60 pb-2 mb-2">
        {tools.map((t) => (
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
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onBlur={() => onChange(ref.current?.innerHTML ?? '')}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const text = target.textContent || '';
          if (target.isContentEditable === false) return;
          if (/^\s*[☐☑]/.test(text) && target !== ref.current) {
            target.textContent = text.startsWith('☐')
              ? text.replace('☐', '☑')
              : text.replace('☑', '☐');
            onChange(ref.current?.innerHTML ?? '');
          }
        }}
        data-placeholder="Skriv notatet her…"
        className={cn(
          'flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-background/60 p-4',
          'text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring',
          '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
        )}
      />
    </div>
  );
}