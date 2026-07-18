import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useParticipantTeams } from '@/hooks/useParticipantTeams';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shuffle, ChevronDown, Users2 } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Trophy } from 'lucide-react';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#06b6d4', '#a855f7', '#f43f5e', '#78716c', '#0ea5e9',
];

interface ParticipantRow {
  id: string;
  name: string;
  team_id: string | null;
}

export function TeamsTab() {
  const qc = useQueryClient();
  const { showSuccess, showError } = useStatusPopup();
  const enabled = useTeamsEnabled();
  const { data: periodId } = useActivePeriodId();
  const { data: teams } = useParticipantTeams();
  const [saving, setSaving] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);

  // Fetch all participants for active period
  const { data: participants } = useQuery({
    queryKey: ['teams-participants', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async (): Promise<ParticipantRow[]> => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, team_id')
        .eq('period_id', periodId!)
        .order('name');
      if (error) throw error;
      return (data || []) as ParticipantRow[];
    },
  });

  // Points per team, split by source. Each match awards +1 to BOTH teams involved.
  // Each completed activity awards +1 to the participant's team.
  const { data: teamPoints } = useQuery({
    queryKey: ['team-points', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async (): Promise<Record<string, { matches: number; activities: number; total: number }>> => {
      const { data: matches, error } = await (supabase as any)
        .from('secret_word_matches')
        .select('participant_a_id, participant_b_id')
        .eq('period_id', periodId!);
      if (error) throw error;
      const { data: parts } = await supabase
        .from('participants')
        .select('id, team_id')
        .eq('period_id', periodId!);
      const teamById = new Map<string, string | null>();
      (parts || []).forEach((p: any) => teamById.set(p.id, p.team_id));
      const pts: Record<string, { matches: number; activities: number; total: number }> = {};
      const bump = (t: string, key: 'matches' | 'activities') => {
        if (!pts[t]) pts[t] = { matches: 0, activities: 0, total: 0 };
        pts[t][key] += 1;
        pts[t].total += 1;
      };
      (matches || []).forEach((m: any) => {
        const ta = teamById.get(m.participant_a_id);
        const tb = teamById.get(m.participant_b_id);
        if (ta) bump(ta, 'matches');
        if (tb && tb !== ta) bump(tb, 'matches');
      });
      // Activities: +1 per completed activity to the participant's team
      const participantIds = (parts || []).map((p: any) => p.id);
      if (participantIds.length > 0) {
        const { data: acts } = await supabase
          .from('participant_activities')
          .select('participant_id')
          .in('participant_id', participantIds);
        (acts || []).forEach((a: any) => {
          const t = teamById.get(a.participant_id);
          if (t) bump(t, 'activities');
        });
      }
      return pts;
    },
  });

  const membersByTeam = useMemo(() => {
    const m = new Map<string, ParticipantRow[]>();
    (participants || []).forEach((p) => {
      if (!p.team_id) return;
      const list = m.get(p.team_id) || [];
      list.push(p);
      m.set(p.team_id, list);
    });
    return m;
  }, [participants]);

  const unassigned = (participants || []).filter((p) => !p.team_id);

  const toggleEnabled = async (val: boolean) => {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'teams_enabled', value: val ? 'true' : 'false' }, { onConflict: 'key' });
    if (error) { showError('Kunne ikke lagre', error.message); return; }
    qc.invalidateQueries({ queryKey: ['teams-enabled'] });
  };

  const updateTeam = async (id: string, patch: Partial<{ name: string; color: string }>) => {
    setSaving(id);
    const { error } = await supabase.from('participant_teams').update(patch).eq('id', id);
    setSaving(null);
    if (error) { showError('Kunne ikke lagre', error.message); return; }
    qc.invalidateQueries({ queryKey: ['participant-teams'] });
  };

  const setParticipantTeam = async (participantId: string, teamId: string | null) => {
    const { error } = await supabase
      .from('participants')
      .update({ team_id: teamId })
      .eq('id', participantId);
    if (error) { showError('Kunne ikke flytte', error.message); return; }
    qc.invalidateQueries({ queryKey: ['teams-participants'] });
    qc.invalidateQueries({ queryKey: ['participants'] });
  };

  const distributeAll = async () => {
    if (!teams || teams.length === 0 || !participants) return;
    if (!confirm(`Dette vil fordele alle ${participants.length} deltakere tilfeldig i ${teams.length} lag. Fortsett?`)) return;
    setDistributing(true);
    try {
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const buckets: string[][] = teams.map(() => []);
      shuffled.forEach((p, i) => {
        buckets[i % teams.length].push(p.id);
      });
      // Update in batches
      for (let i = 0; i < teams.length; i++) {
        const ids = buckets[i];
        if (ids.length === 0) continue;
        const { error } = await supabase
          .from('participants')
          .update({ team_id: teams[i].id })
          .in('id', ids);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['teams-participants'] });
      qc.invalidateQueries({ queryKey: ['participants'] });
      showSuccess('Fordelt', `${participants.length} deltakere fordelt på ${teams.length} lag.`);
    } catch (e: any) {
      showError('Feil', e.message);
    } finally {
      setDistributing(false);
    }
  };

  const clearAll = async () => {
    if (!confirm('Fjern alle lag-tildelinger for aktiv periode?')) return;
    const { error } = await supabase
      .from('participants')
      .update({ team_id: null })
      .eq('period_id', periodId!);
    if (error) { showError('Feil', error.message); return; }
    qc.invalidateQueries({ queryKey: ['teams-participants'] });
    qc.invalidateQueries({ queryKey: ['participants'] });
  };

  if (!periodId || !teams) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users2 className="w-5 h-5" /> Lag</CardTitle>
          <CardDescription>
            Del deltakere i 10 lag. Når "Vis lag i appen" er på, ser ledere lag-merket på deltakerkortene.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <Label htmlFor="teams-enabled" className="cursor-pointer">Vis lag i appen</Label>
            <Switch id="teams-enabled" checked={enabled} onCheckedChange={toggleEnabled} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={distributeAll} disabled={distributing}>
              {distributing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shuffle className="w-4 h-4 mr-2" />}
              Fordel deltakere tilfeldig
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll}>Nullstill tildelinger</Button>
          </div>
          {unassigned.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {unassigned.length} deltakere er ikke tildelt et lag.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {teams.map((team) => {
          const members = membersByTeam.get(team.id) || [];
          return (
            <Collapsible key={team.id}>
              <Card>
                <div className="p-3 flex items-center gap-2 flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="w-8 h-8 rounded-full border-2 border-border shrink-0"
                        style={{ backgroundColor: team.color }}
                        aria-label="Endre farge"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2">
                      <div className="grid grid-cols-5 gap-2">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            className="w-8 h-8 rounded-full border-2 border-border hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                            onClick={() => updateTeam(team.id, { color: c })}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    className="flex-1 min-w-[120px] h-9"
                    defaultValue={team.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== team.name) updateTeam(team.id, { name: v });
                    }}
                  />
                  <Badge variant="secondary" className="shrink-0">{members.length}</Badge>
                  <Badge variant="default" className="shrink-0 gap-1">
                    <Trophy className="w-3 h-3" />
                    {teamPoints?.[team.id]?.total ?? 0}
                  </Badge>
                  {saving === team.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  <CollapsibleTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="border-t px-3 py-2 space-y-1 max-h-80 overflow-y-auto">
                    {members.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2 text-center">Ingen deltakere i dette laget</p>
                    )}
                    {members.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 py-1">
                        <span className="flex-1 text-sm truncate">{p.name}</span>
                        <Select
                          value={p.team_id ?? 'none'}
                          onValueChange={(v) => setParticipantTeam(p.id, v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— ingen —</SelectItem>
                            {teams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ikke tildelt ({unassigned.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {unassigned.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-sm truncate">{p.name}</span>
                  <Select
                    value="none"
                    onValueChange={(v) => setParticipantTeam(p.id, v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Velg lag" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— ingen —</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}