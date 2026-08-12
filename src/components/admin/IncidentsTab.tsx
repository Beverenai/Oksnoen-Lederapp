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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getParticipantThumb } from '@/lib/participantImage';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export function IncidentsTab() {
  const { data: incidents = [], isLoading } = useParticipantIncidents({ adminAll: true });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<IncidentCategory | 'all'>('all');
  const [sev, setSev] = useState<IncidentSeverity | 'all'>('all');
  const [editing, setEditing] = useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailParticipantId, setDetailParticipantId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openParticipant = (id: string) => {
    setDetailParticipantId(id);
    setDetailOpen(true);
  };

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
                  <div className="flex items-center gap-2 min-w-0">
                    {i.participants.length > 0 && (
                      <div className="flex -space-x-2.5 shrink-0">
                        {i.participants.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openParticipant(p.id); }}
                            className="rounded-full transition active:scale-95"
                            aria-label={`Åpne ${p.name}`}
                          >
                            <Avatar className="h-11 w-11 ring-2 ring-background">
                              <AvatarImage
                                src={getParticipantThumb(p as any)}
                                alt={p.name}
                                loading="lazy"
                                decoding="async"
                              />
                              <AvatarFallback className="text-xs">{p.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          </button>
                        ))}
                        {i.participants.length > 3 && (
                          <div className="h-11 w-11 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-xs font-medium">
                            +{i.participants.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="font-medium text-sm truncate">{i.title}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(i.created_at), 'd. MMM HH:mm', { locale: nb })}
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
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 cursor-pointer hover:bg-secondary/80"
                      onClick={(e) => { e.stopPropagation(); openParticipant(p.id); }}
                    >
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

      <ParticipantDetailDialog
        participantId={detailParticipantId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}