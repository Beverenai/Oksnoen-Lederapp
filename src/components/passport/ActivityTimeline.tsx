import { Badge } from '@/components/ui/badge';
import { activityTimeline, type ActivityEntry } from '@/lib/activityRegistration';
import { arrivalTime } from '@/lib/participantHistory';

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  const counts = new Map<string, number>();
  entries.forEach(row => {
    const key = row.activity.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  if (!entries.length) return null;
  return <div className="space-y-4 pt-2" aria-label="Aktivitetshistorikk">
    {activityTimeline(entries).map(([day, rows]) => <section key={day} className="space-y-2">
      <h5 className="text-xs font-semibold text-muted-foreground">{day === 'Ukjent dato' ? day : new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeZone: 'Europe/Oslo' }).format(new Date(`${day}T12:00:00Z`))}</h5>
      <ol className="space-y-3 border-l border-border pl-3">
        {rows.map(row => <li key={row.id} className="flex items-start gap-3 text-sm">
          <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.completed_at ? arrivalTime(row.completed_at) : '—'}</time>
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{row.activity}{(counts.get(row.activity.trim().toLowerCase()) ?? 0) > 1 && ` ×${counts.get(row.activity.trim().toLowerCase())}`}</p>
            <p className="text-xs text-muted-foreground break-words">{row.leaders?.name ?? 'Ukjent leder'}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">{row.source === 'qr' ? 'QR' : 'Manuelt'}</Badge>
        </li>)}
      </ol>
    </section>)}
  </div>;
}