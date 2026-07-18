import { useMemo, useState } from 'react';
import {
  useParticipantIncidents,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type Incident,
  type IncidentCategory,
  type IncidentSeverity,
} from '@/hooks/useParticipantIncidents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { IncidentSheet } from '@/components/incidents/IncidentSheet';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export function IncidentsTab() {
  const { data: incidents = [], isLoading } = useParticipantIncidents({ adminAll: true });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<IncidentCategory | 'all'>('all');
  const [sev, setSev] = useState<IncidentSeverity | 'all'>('all');
  const [editing, setEditing] = useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false;
      if (sev !== 'all' && i.severity !== sev) return false;
      if (!q) return true;
      const hay = [
        i.title,
        i.description ?? '',
        i.leader?.name ?? '',
        ...i.participants.map((p) => p.name),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [incidents, search, cat, sev]);

  const openEdit = (i: Incident) => {
    setEditing(i);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk tittel, beskrivelse, leder eller deltager…"
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCat('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs border',
            cat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
          )}
        >
          Alle kategorier
        </button>
        {(Object.keys(CATEGORY_LABELS) as IncidentCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              'px-3 py-1 rounded-full text-xs border',
              cat === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSev('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs border',
            sev === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
          )}
        >
          Alle nivåer
        </button>
        {(Object.keys(SEVERITY_LABELS) as IncidentSeverity[]).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs border',
              sev === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            )}
          >
            {SEVERITY_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Ingen hendelser</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <Card
              key={i.id}
              className="cursor-pointer hover:bg-muted/50 transition"
              onClick={() => openEdit(i)}
            >
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{i.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(i.created_at), 'dd.MM.yy HH:mm')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={cn('text-[10px]', CATEGORY_COLORS[i.category])}>
                    {CATEGORY_LABELS[i.category]}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', SEVERITY_COLORS[i.severity])}>
                    {SEVERITY_LABELS[i.severity]}
                  </Badge>
                  {i.participants.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-[10px]">
                      {p.name}
                    </Badge>
                  ))}
                </div>
                {i.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{i.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Registrert av <span className="font-medium">{i.leader?.name ?? 'Ukjent'}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IncidentSheet open={sheetOpen} onOpenChange={setSheetOpen} incident={editing} />
    </div>
  );
}