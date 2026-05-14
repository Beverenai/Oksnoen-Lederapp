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
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Shield, ArrowLeft, CalendarDays, Loader2, Sparkles, Send, Archive, Trash2, Users, Eye,
  Download, AlertTriangle, Pencil,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { exportShiftScheduleXlsx } from '@/lib/exportShiftScheduleXlsx';

type Leader = Tables<'leaders'>;
type ShiftSchedule = Tables<'shift_schedules'>;
type ShiftAssignment = Tables<'shift_assignments'>;
type ShiftType = Tables<'shift_types'>;
type Team = 'team1' | 'team2' | 'team1f' | 'team2f';

const TEAM_META: Record<Team, { label: string; className: string }> = {
  team1:  { label: 'Team 1',  className: 'bg-red-500 text-white hover:bg-red-600' },
  team2:  { label: 'Team 2',  className: 'bg-orange-500 text-white hover:bg-orange-600' },
  team1f: { label: 'Team 1F', className: 'bg-yellow-400 text-foreground hover:bg-yellow-500' },
  team2f: { label: 'Team 2F', className: 'bg-blue-500 text-white hover:bg-blue-600' },
};

const PROFILE_TO_TEAM: Record<string, Team> = { '1': 'team1', '2': 'team2', '1f': 'team1f', '2f': 'team2f' };

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
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewScheduleId, setViewScheduleId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [warnings, setWarnings] = useState<Array<{ leader_id: string; leader_name: string; day_index: number | null; rule: string; detail: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ldrRes, scRes, stRes] = await Promise.all([
        supabase.from('leaders').select('*').eq('is_active', true).order('name'),
        supabase.from('shift_schedules').select('*').order('year', { ascending: false }).order('period_number', { ascending: false }),
        supabase.from('shift_types').select('*').order('day_type').order('sort_order'),
      ]);
      const ldrs = (ldrRes.data || []).filter((l) => l.phone !== '12345678');
      setLeaders(ldrs);
      setSchedules(scRes.data || []);
      setShiftTypes(stRes.data || []);
    } catch {
      showError('Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  const leaderById = useMemo(() => {
    const m = new Map<string, Leader>();
    leaders.forEach((l) => m.set(l.id, l));
    return m;
  }, [leaders]);

  const counts = useMemo(() => {
    const c: Record<Team | 'other', number> = {
      team1: 0, team2: 0, team1f: 0, team2f: 0, other: 0,
    };
    leaders.forEach((l) => {
      const t = PROFILE_TO_TEAM[(l.team || '').trim()];
      if (t) c[t] += 1; else c.other += 1;
    });
    return c;
  }, [leaders]);

  const canGenerate = counts.team1 >= 1 && counts.team2 >= 1 && counts.team1f >= 1 && counts.team2f >= 1;

  const generate = async () => {
    setGenerating(true);
    try {
      const publishedSchedule = schedules.find(
        (schedule) => schedule.period_number === periodNumber && schedule.year === year && schedule.status === 'published',
      );

      const shouldForceRegenerate = publishedSchedule
        ? confirm('Denne perioden er publisert. Arkivér og generer på nytt?')
        : false;

      if (publishedSchedule && !shouldForceRegenerate) {
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-shift-schedule', {
        body: {
          period_number: periodNumber,
          year,
          period_length: periodLength,
          force_regenerate: shouldForceRegenerate,
        },
      });

      let errMsg = (error as any)?.message || data?.error || '';
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try { const body = await ctx.clone().json(); errMsg = body?.error || errMsg; } catch {}
      }
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess(`Generert: ${data.assignments_count} tildelinger over ${data.days} dager`);
      setWarnings(data.validation?.warnings || []);
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
      if (viewScheduleId === id) { setViewScheduleId(null); setAssignments([]); }
      loadAll();
    } catch {
      showError('Kunne ikke slette');
    }
  };

  const downloadXlsx = async (s: ShiftSchedule) => {
    try {
      const { data, error } = await supabase.from('shift_assignments').select('*').eq('schedule_id', s.id);
      if (error) throw error;
      await exportShiftScheduleXlsx({
        schedule: s, assignments: data || [], shiftTypes, leaders,
      });
      showSuccess('Excel lastet ned');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lage Excel');
    }
  };

  const loadGrid = async (id: string) => {
    setViewScheduleId(id);
    setLoadingGrid(true);
    try {
      const { data, error } = await supabase.from('shift_assignments')
        .select('*').eq('schedule_id', id);
      if (error) throw error;
      setAssignments(data || []);
      await revalidate(id);
    } catch {
      showError('Kunne ikke laste vaktplan-grid');
    } finally {
      setLoadingGrid(false);
    }
  };

  const viewedSchedule = schedules.find((s) => s.id === viewScheduleId) || null;

  // Eligible leaders for manual swap: all active, excluding kitchen/chef/nurse profiles.
  const eligibleLeaders = useMemo(() => {
    return leaders.filter((l) => {
      const t = (l.team || '').trim().toLowerCase();
      return t === '1' || t === '2' || t === '1f' || t === '2f';
    });
  }, [leaders]);

  const revalidate = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('revalidate-shift-schedule', {
        body: { schedule_id: scheduleId },
      });
      if (error) throw error;
      setWarnings(data?.warnings || []);
    } catch (e) {
      console.error('revalidate failed', e);
    }
  };

  const swapAssignmentLeader = async (assignmentId: string, newLeaderId: string) => {
    if (!viewedSchedule) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ leader_id: newLeaderId, assignment_type: 'leader', team_name: null })
        .eq('id', assignmentId);
      if (error) throw error;
      setAssignments((prev) => prev.map((a) =>
        a.id === assignmentId ? { ...a, leader_id: newLeaderId, assignment_type: 'leader', team_name: null } : a
      ));
      setEditingId(null);
      await revalidate(viewedSchedule.id);
      showSuccess('Vakt oppdatert');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke endre tildeling');
    } finally {
      setSavingEdit(false);
    }
  };

  const warningSummary = useMemo(() => {
    const byRule: Record<string, { count: number; leaders: Set<string> }> = {};
    for (const w of warnings) {
      const k = w.rule;
      if (!byRule[k]) byRule[k] = { count: 0, leaders: new Set() };
      byRule[k].count += 1;
      byRule[k].leaders.add(w.leader_name);
    }
    const RULE_LABEL: Record<string, string> = {
      '8h_max': 'Over 8t/dag',
      '11h_rest': 'Under 11t hvile mellom dager',
      'f_team_after_21': 'F-team etter 21:00',
    };
    return Object.entries(byRule).map(([rule, v]) => ({
      rule, label: RULE_LABEL[rule] || rule, count: v.count, leaderCount: v.leaders.size,
    }));
  }, [warnings]);

  // Timer per leder per dag. Telt som UNION av tidsintervaller (ikke sum av
  // varigheter), slik at overlappende vakter — f.eks. kjøkkenvakt 09–17 som
  // overlapper teamets vekking/frokost/økt1/middag/økt2 — ikke dobbelttelles.
  // Generator-koden ekskluderer slike ledere fra team-vakter i recordWork, men
  // shift_assignments-radene lagrer ikke ekskluderingen, så UI må håndtere det
  // via intervall-union.
  const hoursMatrix = useMemo(() => {
    if (!viewedSchedule) return null;
    const days = viewedSchedule.period_length;
    const stById = new Map(shiftTypes.map((s) => [s.id, s]));
    const teamMembers: Record<Team, Leader[]> = { team1: [], team2: [], team1f: [], team2f: [] };
    const teamLeaders: Leader[] = [];
    for (const l of leaders) {
      const k = PROFILE_TO_TEAM[(l.team || '').trim()];
      if (k) { teamMembers[k].push(l); teamLeaders.push(l); }
    }
    teamLeaders.sort((a, b) => a.name.localeCompare(b.name, 'nb'));

    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    // Intervaller per (leder, dag): minutter siden midnatt på dayIndex
    // (kan være > 1440 hvis vakten krysser midnatt).
    const intervalsPerLeaderDay = new Map<string, [number, number][][]>();
    for (const l of teamLeaders) {
      intervalsPerLeaderDay.set(l.id, Array.from({ length: days }, () => [] as [number, number][]));
    }
    const addInterval = (leaderId: string, day: number, st: { start_time: string; end_time: string }) => {
      const grid = intervalsPerLeaderDay.get(leaderId);
      if (!grid || day < 0 || day >= days) return;
      const s = toMin(st.start_time);
      let e = toMin(st.end_time);
      if (e <= s) e += 24 * 60;
      grid[day].push([s, e]);
    };

    for (const a of assignments) {
      const st = stById.get(a.shift_type_id);
      if (!st) continue;
      if (a.assignment_type === 'leader' && a.leader_id) {
        addInterval(a.leader_id, a.day_index, st);
      } else if (a.assignment_type === 'team' && a.team_name) {
        const members = teamMembers[a.team_name as Team];
        if (!members) continue;
        for (const m of members) addInterval(m.id, a.day_index, st);
      }
    }

    const hours = new Map<string, number[]>();
    for (const l of teamLeaders) {
      const grid = intervalsPerLeaderDay.get(l.id)!;
      const row = grid.map((ivs) => {
        if (ivs.length === 0) return 0;
        const sorted = [...ivs].sort((a, b) => a[0] - b[0]);
        let total = 0;
        let [curS, curE] = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const [s, e] = sorted[i];
          if (s <= curE) {
            curE = Math.max(curE, e);
          } else {
            total += curE - curS;
            [curS, curE] = [s, e];
          }
        }
        total += curE - curS;
        return total / 60;
      });
      hours.set(l.id, row);
    }
    return { days, leaders: teamLeaders, hours };
  }, [viewedSchedule, shiftTypes, assignments, leaders]);

  const grid = useMemo(() => {
    if (!viewedSchedule) return [];
    const days: { dayIndex: number; dayType: string; rows: { st: ShiftType; items: ShiftAssignment[] }[] }[] = [];
    for (let d = 0; d < viewedSchedule.period_length; d++) {
      const dt = d === 0 ? 'arrival' : d === viewedSchedule.period_length - 1 ? 'departure' : 'normal';
      const types = shiftTypes.filter((s) => s.day_type === dt);
      const rows = types.map((st) => ({
        st,
        items: assignments
          .filter((a) => a.day_index === d && a.shift_type_id === st.id)
          .sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '')),
      }));
      days.push({ dayIndex: d, dayType: dt, rows });
    }
    return days;
  }, [viewedSchedule, shiftTypes, assignments]);

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
            <p className="hidden sm:block text-sm text-muted-foreground">Generer, publiser og se vaktplaner</p>
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

      {/* Team summary (read-only — hentet fra lederprofil) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Team</CardTitle>
          <CardDescription>
            Team hentes fra lederprofilen (felt: <em>team</em>). Kun <strong>1, 2, 1F, 2F</strong> er med i vaktplan —
            Kjøkken, Sjef og Nurse er ekskludert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['team1','team2','team1f','team2f'] as Team[]).map((t) => (
              <Badge key={t} className={TEAM_META[t].className}>
                {TEAM_META[t].label}: {counts[t]}
              </Badge>
            ))}
            <Badge variant="outline">Ekskludert (kjøkken/sjef/nurse/uten): {counts.other}</Badge>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(['team1','team2','team1f','team2f'] as Team[]).map((t) => {
                const members = leaders.filter((l) => PROFILE_TO_TEAM[(l.team || '').trim()] === t);
                return (
                  <div key={t} className="border rounded-lg p-3 space-y-2">
                    <Badge className={TEAM_META[t].className}>{TEAM_META[t].label}</Badge>
                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ingen ledere</p>
                    ) : (
                      <ul className="text-sm space-y-0.5">
                        {members.map((m) => (
                          <li key={m.id} className="truncate">
                            {m.name}{m.age != null && m.age < 18 ? <span className="text-muted-foreground text-xs"> ({m.age})</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={!canGenerate || generating} variant="default">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generer vaktplan ({periodLength} dager)
            </Button>
            {!canGenerate && (
              <p className="text-xs text-muted-foreground self-center">
                Trenger minst 1 leder i hvert av team 1, 2, 1F og 2F.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule list */}
      <Card>
        <CardHeader>
          <CardTitle>Vaktplaner</CardTitle>
          <CardDescription>Vis, publiser, arkiver eller slett genererte planer</CardDescription>
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
                    <Button size="sm" variant={viewScheduleId === s.id ? 'default' : 'secondary'} onClick={() => loadGrid(s.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Vis
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadXlsx(s)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Excel
                    </Button>
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

      {/* Grid view */}
      {viewedSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>
              Vaktplan · Periode {viewedSchedule.period_number}/{viewedSchedule.year}
            </CardTitle>
            <CardDescription>
              {viewedSchedule.period_length} dager · {STATUS_META[viewedSchedule.status]?.label || viewedSchedule.status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {warnings.length > 0 && (
              <div className="mb-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  {warnings.length} advarsel{warnings.length === 1 ? '' : 'er'}
                </div>
                {warningSummary.length > 0 && (
                  <div className="mb-2 text-xs space-y-0.5">
                    {warningSummary.map((s) => (
                      <div key={s.rule}>
                        <strong>{s.label}:</strong> {s.count} tilfeller ({s.leaderCount} ledere)
                      </div>
                    ))}
                  </div>
                )}
                <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <strong>{w.leader_name}</strong>
                      {w.day_index != null ? ` — Dag ${w.day_index + 1}` : ''}: {w.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length === 0 && viewScheduleId && (
              <div className="mb-4 border border-green-500/30 bg-green-500/10 rounded-lg p-2 text-xs text-green-800 dark:text-green-200">
                Ingen regelbrudd oppdaget i siste generering.
              </div>
            )}
            {loadingGrid ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="space-y-6">
                {grid.map((day) => (
                  <div key={day.dayIndex} className="space-y-2">
                    <h3 className="font-heading font-semibold text-base">
                      Dag {day.dayIndex + 1}
                      <span className="ml-2 text-xs font-normal text-muted-foreground uppercase">
                        {day.dayType === 'arrival' ? 'Ankomst' : day.dayType === 'departure' ? 'Avreise' : 'Normal'}
                      </span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 w-20">Tid</th>
                            <th className="text-left p-2">Vakt</th>
                            <th className="text-left p-2">Tildelt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.rows.map(({ st, items }) => (
                            <tr key={st.id} className="border-t align-top">
                              <td className="p-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                {st.start_time?.slice(0, 5)}–{st.end_time?.slice(0, 5)}
                              </td>
                              <td className="p-2 font-medium">{st.name}</td>
                              <td className="p-2">
                                {items.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {items.map((a) => {
                                      const isEditable = viewedSchedule.status !== 'archived';
                                      const editButton = isEditable ? (
                                        <Popover open={editingId === a.id} onOpenChange={(o) => setEditingId(o ? a.id : null)}>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-background/40"
                                              aria-label="Endre"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-64 p-2 space-y-2">
                                            <p className="text-xs font-medium">Bytt person</p>
                                            <Select
                                              disabled={savingEdit}
                                              onValueChange={(v) => swapAssignmentLeader(a.id, v)}
                                            >
                                              <SelectTrigger><SelectValue placeholder="Velg leder" /></SelectTrigger>
                                              <SelectContent>
                                                {eligibleLeaders.map((l) => (
                                                  <SelectItem key={l.id} value={l.id}>
                                                    {l.name}
                                                    {l.age != null ? ` (${l.age})` : ''}
                                                    {l.team ? ` · ${l.team}` : ''}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </PopoverContent>
                                        </Popover>
                                      ) : null;
                                      if (a.assignment_type === 'team' && a.team_name) {
                                        const t = a.team_name as Team;
                                        const meta = TEAM_META[t];
                                        return (
                                          <Badge key={a.id} className={`${meta?.className || ''} gap-1`}>
                                            {meta?.label || a.team_name}
                                            {a.note ? <span className="ml-1 opacity-80">{a.note}</span> : null}
                                            {editButton}
                                          </Badge>
                                        );
                                      }
                                      const ldr = a.leader_id ? leaderById.get(a.leader_id) : null;
                                      return (
                                        <Badge key={a.id} variant="outline" className="gap-1">
                                          {ldr?.name || 'Ukjent'}
                                          {a.role && a.role !== 'standard' ? <span className="ml-1 text-[10px] opacity-70">({a.role})</span> : null}
                                          {editButton}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hours per leader */}
      {viewedSchedule && hoursMatrix && (
        <Card>
          <CardHeader>
            <CardTitle>Timer per leder</CardTitle>
            <CardDescription>
              Totale arbeidstimer per leder per dag. Røde celler er over 8t/dag.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-muted/50 z-10">Leder</th>
                    {Array.from({ length: hoursMatrix.days }, (_, d) => (
                      <th key={d} className="text-center p-2 tabular-nums font-medium whitespace-nowrap">
                        Dag {d + 1}
                      </th>
                    ))}
                    <th className="text-center p-2 tabular-nums font-semibold whitespace-nowrap">Sum</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursMatrix.leaders.map((l) => {
                    const row = hoursMatrix.hours.get(l.id) || [];
                    const sum = row.reduce((s, x) => s + x, 0);
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="p-2 font-medium sticky left-0 bg-background whitespace-nowrap">
                          {l.name}
                          {l.team ? <span className="ml-1 text-xs text-muted-foreground">({l.team})</span> : null}
                        </td>
                        {row.map((h, d) => (
                          <td
                            key={d}
                            className={`text-center p-2 tabular-nums ${
                              h > 8.01
                                ? 'bg-destructive/10 text-destructive font-semibold'
                                : h === 0
                                ? 'text-muted-foreground/40'
                                : ''
                            }`}
                          >
                            {h === 0 ? '–' : h.toFixed(1)}
                          </td>
                        ))}
                        <td className="text-center p-2 tabular-nums font-semibold">{sum.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="p-2 sticky left-0 bg-muted/30">Sum dag</td>
                    {Array.from({ length: hoursMatrix.days }, (_, d) => {
                      const total = hoursMatrix.leaders.reduce(
                        (s, l) => s + ((hoursMatrix.hours.get(l.id) || [])[d] || 0),
                        0,
                      );
                      return (
                        <td key={d} className="text-center p-2 tabular-nums">{total.toFixed(1)}</td>
                      );
                    })}
                    <td className="text-center p-2 tabular-nums">
                      {hoursMatrix.leaders.reduce(
                        (s, l) => s + (hoursMatrix.hours.get(l.id) || []).reduce((a, b) => a + b, 0),
                        0,
                      ).toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}