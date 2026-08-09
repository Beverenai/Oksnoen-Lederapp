import { Badge } from '@/components/ui/badge';
import { categoryEmoji, categoryLabel, MailboxMessage, statusLabel } from '@/hooks/useMailbox';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function MyMessagesList({ messages }: { messages: MailboxMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        Du har ikke sendt inn noe ennå.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              <span aria-hidden className="mr-1">{categoryEmoji(m.category)}</span>
              {categoryLabel(m.category)}
            </span>
            <Badge variant={m.status === 'replied' ? 'default' : 'secondary'}>
              {statusLabel(m.status)}
            </Badge>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{m.content}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {fmt(m.created_at)}
            {m.is_anonymous ? ' · sendt anonymt' : ''}
          </p>
          {m.admin_reply && (
            <div className="mt-3 rounded-xl bg-muted/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Svar fra admin
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.admin_reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
