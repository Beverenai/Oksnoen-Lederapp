import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Search, LayoutGrid, List, Clock, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';
import { LeirskoleCompetenceSheet } from '@/components/leirskole/LeirskoleCompetenceSheet';
import type { LeirskoleStaff } from '@/hooks/useLeirskole';

type StaffRow = LeirskoleStaff & {
  leader: {
    id: string;
    name: string;
    profile_image_url: string | null;
    leirskole_competencies: string[] | null;
    phone?: string | null;
  } | null;
};

interface Props {
  weekName: string;
  weekDates: string;
  staff: StaffRow[];
  /** timer per staff-id fra vaktplanen */
  hoursByStaff: Map<string, number>;
  maxDailyHours?: number | null;
  /** aktiviteter lederen har fått (leader_id -> aktivitetsnøkler) */
  activitiesByLeader?: Map<string, string[]>;
  /** åpne detaljark for en leder */
  onSelect?: (staff: StaffRow) => void;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');

export function LeirskoleStaffPanel({
  weekName,
  weekDates,
  staff,
  hoursByStaff,
  activitiesByLeader,
  onSelect,
}: Props) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'alle' | 'mangler'>('alle');
  const [editing] = useState<StaffRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      const comps = s.leader?.leirskole_competencies ?? [];
      if (filter === 'mangler' && comps.length > 0) return false;
      if (!q) return true;
      const hay = [s.leader?.name, s.role_label, ...comps.map(competenceLabel)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [staff, search, filter]);

  const missing = staff.filter((s) => (s.leader?.leirskole_competencies ?? []).length === 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-heading font-bold">Lederoversikt</h2>
          <p className="text-sm text-muted-foreground">
            {weekName} · {weekDates}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as 'grid' | 'list')}
          className="rounded-full bg-muted/60 p-1"
        >
          <ToggleGroupItem value="grid" aria-label="Rutenett" className="rounded-full">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Liste" className="rounded-full">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk på navn eller kompetanse…"
            className="rounded-full pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as 'alle' | 'mangler')}
          className="rounded-full bg-muted/60 p-1"
        >
          <ToggleGroupItem value="alle" className="rounded-full px-3 text-xs">Alle</ToggleGroupItem>
          <ToggleGroupItem value="mangler" className="rounded-full px-3 text-xs">
            Mangler kompetanse{missing ? ` (${missing})` : ''}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} av {staff.length} ledere · trykk på en leder for å se kompetanse, aktiviteter og sende beskjed
      </p>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Ingen ledere er satt opp på denne uken ennå.
          </CardContent>
        </Card>
      ) : (
        <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-2'}>
          {filtered.map((s) => {
            const comps = s.leader?.leirskole_competencies ?? [];
            const hours = hoursByStaff.get(s.id) ?? 0;
            const acts = (s.leader?.id && activitiesByLeader?.get(s.leader.id)) || [];
            const shownComps = comps.slice(0, 4);
            const restComps = comps.length - shownComps.length;
            return (
              <Card
                key={s.id}
                onClick={() => onSelect?.(s)}
                className="group cursor-pointer overflow-hidden rounded-2xl border transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <CardContent className="space-y-2.5 p-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={s.leader?.profile_image_url ?? undefined} alt={s.leader?.name ?? ''} />
                      <AvatarFallback>{initials(s.leader?.name ?? '?')}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold leading-tight">{s.leader?.name ?? 'Ukjent'}</p>
                        {s.role_label && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{s.role_label}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {hours.toFixed(1)} t
                        </span>
                        <span>·</span>
                        <span>{acts.length} aktiviteter</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  {comps.length === 0 ? (
                    <div className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Mangler kompetanse — trykk for å legge inn
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {shownComps.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {competenceEmoji(c)} {competenceLabel(c)}
                        </span>
                      ))}
                      {restComps > 0 && (
                        <span className="text-[11px] font-medium text-muted-foreground">+{restComps} flere</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing?.leader && (
        <LeirskoleCompetenceSheet
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          leaderId={editing.leader.id}
          leaderName={editing.leader.name}
          current={editing.leader.leirskole_competencies ?? []}
        />
      )}
    </div>
  );
}
