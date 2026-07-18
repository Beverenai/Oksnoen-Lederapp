import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useParticipantIncidents,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type Incident,
} from '@/hooks/useParticipantIncidents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquareWarning } from 'lucide-react';
import { IncidentSheet } from './IncidentSheet';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function MyIncidentsList() {
  const { effectiveLeader } = useAuth();
  const { data: incidents = [], isLoading } = useParticipantIncidents({ leaderId: effectiveLeader?.id ?? null });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (i: Incident) => {
    setEditing(i);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Mine hendelser</h3>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Ny
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laster…</p>
      ) : incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ingen hendelser registrert ennå.</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => (
            <Card
              key={i.id}
              className="cursor-pointer hover:bg-muted/50 transition"
              onClick={() => openEdit(i)}
            >
              <CardContent className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{i.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(i.created_at), 'dd.MM HH:mm')}
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
                  <p className="text-xs text-muted-foreground line-clamp-2">{i.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IncidentSheet open={sheetOpen} onOpenChange={setSheetOpen} incident={editing} />
    </div>
  );
}