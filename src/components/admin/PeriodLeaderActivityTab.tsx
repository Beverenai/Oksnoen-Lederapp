import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2, RefreshCw } from 'lucide-react';
import { periodBounds } from '@/lib/activityRegistration';
import { arrivalTime } from '@/lib/participantHistory';

interface Entry { id: string; leaderId: string | null; at: string; type: 'QR' | 'Manuelt' | 'Gomla' | 'Nurse'; title: string; detail: string }

export function PeriodLeaderActivityTab() {
  const { data: activeId } = useActivePeriodId();
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null);
  const periodId = selectedPeriod ?? activeId;
  const { data: periods = [] } = useQuery({
    queryKey: ['period-leader-overview-periods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periods').select('id,name,start_date,end_date,season_year').order('start_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const period = periods.find(p => p.id === periodId);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['period-leader-activity', periodId, period?.start_date, period?.end_date],
    enabled: !!period,
    staleTime: 15000,
    queryFn: async () => {
      if (!period || !period.start_date || !period.end_date) throw new Error('Perioden mangler datoer');
      const bounds = periodBounds(period.start_date, period.end_date);
      const [members, teams, activities, sales, notes] = await Promise.all([
        supabase.from('period_leaders').select('leader_id,period_number,leaders(name)').eq('period_id', period.id),
        supabase.from('leader_teams').select('leader_id,period_number,team').eq('year', period.season_year ?? new Date(period.start_date).getFullYear()),
        supabase.from('participant_activities').select('id,activity,registered_by,completed_at,source,participants(name)').eq('period_id', period.id).gte('completed_at', bounds.start).lt('completed_at', bounds.end),
        supabase.from('kiosk_sales').select('id,sold_by,total,sale_number,created_at,voided_at,participants(name)').eq('period_id', period.id).gte('created_at', bounds.start).lt('created_at', bounds.end),
        supabase.from('nurse_reports').select('id,created_by,content,created_at').eq('period_id', period.id).gte('created_at', bounds.start).lt('created_at', bounds.end),
      ]);
      for (const response of [members, teams, activities, sales, notes]) if (response.error) throw response.error;
      const entries: Entry[] = [
        ...(activities.data ?? []).map(row => ({ id: row.id, leaderId: row.registered_by, at: row.completed_at ?? '', type: row.source === 'qr' ? 'QR' as const : 'Manuelt' as const, title: row.activity, detail: row.participants?.name ?? 'Ukjent deltaker' })),
        ...(sales.data ?? []).map(row => ({ id: row.id, leaderId: row.sold_by, at: row.created_at, type: 'Gomla' as const, title: `Salg #${row.sale_number ?? ''} · ${row.total} kr${row.voided_at ? ' · Annullert' : ''}`, detail: row.participants?.name ?? 'Ukjent deltaker' })),
        ...(notes.data ?? []).map(row => ({ id: row.id, leaderId: row.created_by, at: row.created_at, type: 'Nurse' as const, title: 'Sykepleiernotat', detail: row.content })),
      ].sort((a, b) => b.at.localeCompare(a.at));
      const unique = new Map((members.data ?? []).map(member => [member.leader_id, member]));
      return { entries, leaders: [...unique.values()].map(member => ({ id: member.leader_id, name: member.leaders?.name ?? 'Ukjent leder', team: teams.data?.find(t => t.leader_id === member.leader_id && t.period_number === member.period_number)?.team ?? null })).sort((a,b) => a.name.localeCompare(b.name, 'nb')) };
    },
  });
  const leader = data?.leaders.find(row => row.id === selectedLeader);
  return <div className="space-y-4">
    <Select value={periodId ?? ''} onValueChange={id => { setSelectedPeriod(id); setSelectedLeader(null); }}>
      <SelectTrigger aria-label="Velg periode"><SelectValue placeholder="Velg periode" /></SelectTrigger>
      <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.season_year}</SelectItem>)}</SelectContent>
    </Select>
    {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
    {error && <div className="space-y-2"><p className="text-sm text-destructive">Kunne ikke hente registreringene</p><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Prøv igjen</Button></div>}
    <div className="divide-y divide-border">
      {data?.leaders.map(row => {
        const own = data.entries.filter(entry => entry.leaderId === row.id);
        return <Button key={row.id} variant="ghost" className="h-auto w-full justify-start py-4 text-left" onClick={() => setSelectedLeader(row.id)}>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-semibold break-words">{row.name}{row.team ? ` · ${row.team}` : ''}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(['QR', 'Manuelt', 'Gomla', 'Nurse'] as const).map(type => <span key={type}>{type} {own.filter(entry => entry.type === type).length}</span>)}
            </div>
          </div>
        </Button>;
      })}
    </div>
    {data && !data.leaders.length && <p className="text-sm text-muted-foreground">Ingen ledere er lagt til i denne perioden.</p>}
    <Sheet open={!!selectedLeader} onOpenChange={open => { if (!open) setSelectedLeader(null); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>{leader?.name ?? 'Registreringer'}</SheetTitle></SheetHeader>
        <div className="divide-y divide-border mt-4">
          {data?.entries.filter(entry => entry.leaderId === selectedLeader).map(entry => <div key={`${entry.type}-${entry.id}`} className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2"><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeZone: 'Europe/Oslo' }).format(new Date(entry.at))} · {arrivalTime(entry.at)}</time><Badge variant="outline">{entry.type}</Badge></div>
            <p className="text-sm font-semibold break-words">{entry.title}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{entry.detail}</p>
          </div>)}
          {!data?.entries.some(entry => entry.leaderId === selectedLeader) && <p className="py-4 text-sm text-muted-foreground">Ingen registreringer i perioden.</p>}
        </div>
      </SheetContent>
    </Sheet>
  </div>;
}