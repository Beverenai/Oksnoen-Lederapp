import { cn } from '@/lib/utils';

/**
 * Lightweight renderer for the kitchen guide texts.
 * Supports ##/### headings, "- " bullets and **bold** inline.
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function KitchenGuide({ body, className }: { body: string; className?: string }) {
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-1.5 pl-5 list-disc marker:text-primary">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-muted-foreground leading-relaxed">{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (line.startsWith('- ')) { bullets.push(line.slice(2)); return; }
    flush();
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={idx} className="text-sm font-semibold uppercase tracking-wide text-primary pt-2">
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={idx} className="text-base font-heading font-bold text-foreground pt-2">
          {line.slice(3)}
        </h3>,
      );
    } else {
      blocks.push(
        <p key={idx} className="text-sm text-muted-foreground leading-relaxed">{inline(line)}</p>,
      );
    }
  });
  flush();

  return <div className={cn('space-y-2', className)}>{blocks}</div>;
}