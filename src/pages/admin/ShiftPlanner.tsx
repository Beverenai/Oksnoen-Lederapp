import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Shield, ArrowLeft, CalendarDays, Loader2, Sparkles, Send, Archive, Trash2, Users,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type ShiftSchedule = Tables<'shift_schedules'>;
type Team = 'team1' | 'team2' | 'team1f' | 'team2f';

const TEAM_META: Record<Team, { label: string; className: string }> = {
  team1:  { label: 'Team 1',  className: 'bg-red-500 text-white hover:bg-red-600' },
  team2:  { label: 'Team 2',  className: 'bg-blue-500 text-white hover:bg-blue-600' },
  team1f: { label: 'Team 1F', className: 'bg-orange-500 text-white hover:bg-orange-600' },
  team2f: { label: 'Team 2F', className: 'bg-yellow-400 text-foreground hover:bg-yellow-500' },
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft:     { label: 'Kladd',      variant: 'secondary' },
  published: { label: 'Publisert',  variant: 'default' },
  archived:  { label: 'Arkivert',   variant: 'outline' },
};

export default function ShiftPlanner() {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useStatusPopup();

  const [periodNumber, setPeriodNumber] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodLength, setPeriodLength] = useState<7 | 8>(7);

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, Team | ''>>({});
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTeams, setSavingTeams] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ldrRes, ltRes, scRes] = await Promise.all([
        supabase.from('leaders').select('*').eq('is_active', true).order('name'),
        supabase.from('leader_teams').select('*').eq('period_number', periodNumber).eq('year', year),
        supabase.from('shift_schedules').select('*').order('year', { ascending: false }).order('period_number', { ascending: false }),
      ]);
      const ldrs = (ldrRes.data || []).filter((l) => l.phone !== '12345678');
      setLeaders(ldrs);
      const map: Record<string, Team | ''> = {};
      ldrs.forEach((l) => { map[l.id] = ''; });
      (ltRes.data || []).forEach((row: { leader_id: string; team: string }) => {
        map[row.leader_id] = row.team as Team;
      });
      setTeamMap(map);
      setSchedules(scRes.data || []);
    } catch {
      showError('Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, periodNumber, year]);

  const counts = useMemo(() => {
    const c: Record<Team | 'unassigned', number> = {
      team1: 0, team2: 0, team1f: 0, team2f: 0, unassigned: 0,
    };
    Object.values(teamMap).forEach((t) => {
      if (t) c[t as Team] += 1; else c.unassigned += 1;
    });
    return c;
  }, [teamMap]);

  const canGenerate = counts.team1 >= 1 && counts.team2 >= 1 && counts.team1f >= 1 && counts.team2f >= 1;

  const setTeamFor = (leaderId: string, team: Team | '') => {
    setTeamMap((prev) => ({ ...prev, [leaderId]: team }));
  };

  const saveTeams = async () => {
    setSavingTeams(true);
    try {
      // Delete previous setup for period, then insert all assigned
      await supabase.from('leader_teams').delete()
        .eq('period_number', periodNumber).eq('year', year);
      const rows = Object.entries(teamMap)
        .filter(([, t]) => t)
        .map(([leader_id, team]) => ({ leader_id, team, period_number: periodNumber, year }));
      if (rows.length) {
        const { error } = await supabase.from('leader_teams').insert(rows);
        if (error) throw error;
      }
      showSuccess('Team-oppsett lagret');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lagre team-oppsett');
    } finally {
      setSavingTeams(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-shift-schedule', {
        body: { period_number: periodNumber, year, period_length: periodLength },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess(`Generert: ${data.assignments_count} tildelinger over ${data.days} dager`);
      loadAll();
    } catch (e) {
      console.error(e);
      showError((e as Error).message || 'Kunne ikke generere vaktplan');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id: string, status: 'draft' | 'published' | 'archived') => {
    try {
      const { error } = await supabase.from('shift_schedules').update({ status }).eq('id', id);
      if (error) throw error;
      showSuccess(`Status satt til ${status}`);
      loadAll();
    } catch {
      showError('Kunne ikke endre status');
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Slette denne vaktplanen permanent?')) return;
    try {
      const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Slettet');
      loadAll();
    } catch {
      showError('Kunne ikke slette');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">Ingen tilgang</h2>
            <p className="text-muted-foreground mt-2">Du har ikke tilgang til admin-panelet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredLeaders = leaders.filter((l) =>
    l.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-lg sm:text-2xl font-heading font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Vaktplan
            </h1>
            <p className="hidden sm:block text-sm text-muted-foreground">Sett opp team, generer og publiser vaktplaner</p>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader>
          <CardTitle>Periode</CardTitle>
          <CardDescription>Velg hvilken periode du jobber med</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Periodenummer</Label>
              <Input type="number" min={1} max={20} value={periodNumber}
                onChange={(e) => setPeriodNumber(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-2">
              <Label>År</Label>
              <Input type="number" min={2025} max={2099} value={year}
                onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Periodelengde</Label>
              <Select value={String(periodLength)} onValueChange={(v) => setPeriodLength(Number(v) as 7 | 8)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dager</SelectItem>
                  <SelectItem value="8">8 dager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Team-oppsett</CardTitle>
          <CardDescription>Tildel hver leder til et team for periode {periodNumber}/{year}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['team1','team2','team1f','team2f'] as Team[]).map((t) => (
              <Badge key={t} className={TEAM_META[t].className}>
                {TEAM_META[t].label}: {counts[t]}
              </Badge>
            ))}
            <Badge variant="outline">Uten team: {counts.unassigned}</Badge>
          </div>

          <Input placeholder="Søk leder..." value={filter} onChange={(e) => setFilter(e.target.value)} />

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto">
              {filteredLeaders.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 p-2 px-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{l.name}</div>
                    {l.age != null && (
                      <div className="text-xs text-muted-foreground">
                        {l.age} år {l.age < 18 ? '(under 18)' : ''}
                      </div>
                    )}
                  </div>
                  <Select
                    value={teamMap[l.id] || 'none'}
                    onValueChange={(v) => setTeamFor(l.id, v === 'none' ? '' : (v as Team))}
                  >
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ingen —</SelectItem>
                      <SelectItem value="team1">Team 1</SelectItem>
                      <SelectItem value="team2">Team 2</SelectItem>
                      <SelectItem value="team1f">Team 1F</SelectItem>
                      <SelectItem value="team2f">Team 2F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {filteredLeaders.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground">Ingen ledere</div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveTeams} disabled={savingTeams}>
              {savingTeams ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Lagre team-oppsett
            </Button>
            <Button onClick={generate} disabled={!canGenerate || generating} variant="default">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generer vaktplan
            </Button>
            {!canGenerate && (
              <p className="text-xs text-muted-foreground self-center">
                Trenger minst 1 leder i hvert team før du kan generere.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule list */}
      <Card>
        <CardHeader>
          <CardTitle>Vaktplaner</CardTitle>
          <CardDescription>Publiser, arkiver eller slett genererte planer</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ingen vaktplaner ennå</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Periode {s.period_number} / {s.year}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.period_length} dager • generert {new Date(s.generated_at!).toLocaleString('nb-NO')}
                    </div>
                  </div>
                  <Badge variant={STATUS_META[s.status]?.variant || 'secondary'}>
                    {STATUS_META[s.status]?.label || s.status}
                  </Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {s.status !== 'published' && (
                      <Button size="sm" onClick={() => setStatus(s.id, 'published')}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Publiser
                      </Button>
                    )}
                    {s.status === 'published' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'draft')}>
                        Avpubliser
                      </Button>
                    )}
                    {s.status !== 'archived' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'archived')}>
                        <Archive className="w-3.5 h-3.5 mr-1" /> Arkiver
                      </Button>
                    )}
                    {s.status === 'archived' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'draft')}>
                        Gjenåpne
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteSchedule(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}