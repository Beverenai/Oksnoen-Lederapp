import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  ArrowLeft, Sparkles, Loader2, Users, Shield, CalendarDays, Plus, X,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type DayType = 'arrival' | 'normal' | 'departure';

interface ShiftType {
  id: string;
  name: string;
  slug: string;
  day_type: DayType;
  sort_order: number;
  start_time: string;
  end_time: string;
  min_leaders: number;
}

interface AssignmentRow {
  id: string;
  day_index: number;
  shift_type_id: string;
  leader_id: string | null;
  leaders: { name: string } | null;
}

interface Warning {
  leader_id: string | null;
  leader_name: string | null;
  day_index: number | null;
  rule: string;
  detail: string;
}

export default function ShiftPlannerMini() {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useStatusPopup();

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [periodNumber, setPeriodNumber] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodLength, setPeriodLength] = useState(7);
  const [includeArrival, setIncludeArrival] = useState(true);
  const [includeDeparture, setIncludeDeparture] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [days, setDays] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<Warning[]>([]);
  const [understaffed, setUnderstaffed] = useState<Warning[]>([]);
  const [openCell, setOpenCell] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('leaders')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        const rows = (data || []).filter((l) => l.phone !== '12345678');
        setLeaders(rows);
        setSelected(new Set(rows.map((r) => r.id)));
      } catch {
        showError('Kunne ikke laste ledere');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, showError]);

  const filteredLeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaders;
    return leaders.filter((l) => (l.name || '').toLowerCase().includes(q));
  }, [leaders, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(leaders.map((l) => l.id)));
  const clearAll = () => setSelected(new Set());

  const generate = async () => {
    if (selected.size === 0) {
      showError('Velg minst én leder');
      return;
    }
    setGenerating(true);
    setScheduleId(null);
    setAssignments([]);
    try {
      const { data, error } = await supabase.functions.invoke('generate-shift-schedule-mini', {
        body: {
          period_number: periodNumber,
          year,
          period_length: periodLength,
          leader_ids: Array.from(selected),
          include_arrival: includeArrival,
          include_departure: includeDeparture,
          force_regenerate: true,
        },
      });
      let errMsg = (error as any)?.message || (data as any)?.error || '';
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try { const b = await ctx.clone().json(); errMsg = b?.error || errMsg; } catch {}
      }
      if (error) throw new Error(errMsg || (error as Error).message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const sid = (data as any).schedule_id as string;
      setScheduleId(sid);
      setDays((data as any).days);
      setUnderstaffed(((data as any).understaffed || []) as Warning[]);
      setValidationWarnings((((data as any).validation?.warnings) || []) as Warning[]);
      await loadMatrix(sid);
      showSuccess(`Generert: ${(data as any).assignments_count} tildelinger`);
    } catch (e) {
      console.error(e);
      showError((e as Error).message || 'Kunne ikke generere');
    } finally {
      setGenerating(false);
    }
  };

  const loadMatrix = async (sid: string) => {
    const [aRes, stRes] = await Promise.all([
      supabase
        .from('shift_assignments')
        .select('id, day_index, shift_type_id, leader_id, leaders(name)')
        .eq('schedule_id', sid),
      supabase
        .from('shift_types')
        .select('id, name, slug, day_type, sort_order, start_time, end_time, min_leaders')
        .gt('min_leaders', 0)
        .order('sort_order'),
    ]);
    if (aRes.error) console.error(aRes.error);
    if (stRes.error) console.error(stRes.error);
    setAssignments((aRes.data || []) as AssignmentRow[]);
    setShiftTypes((stRes.data || []) as ShiftType[]);
  };

  const revalidate = async (sid: string) => {
    try {
      const { data } = await supabase.functions.invoke('revalidate-shift-schedule', {
        body: { schedule_id: sid },
      });
      setValidationWarnings(((data as any)?.warnings || []) as Warning[]);
    } catch (e) { console.error(e); }
  };

  const addLeader = async (day: number, shift_type_id: string, leader_id: string) => {
    if (!scheduleId) return;
    setOpenCell(null);
    const st = shiftTypes.find((s) => s.id === shift_type_id);
    const { error } = await supabase.from('shift_assignments').insert({
      schedule_id: scheduleId,
      day_index: day,
      day_type: st?.day_type || 'normal',
      shift_type_id,
      assignment_type: 'leader',
      leader_id,
      role: 'standard',
      excluded_leader_ids: [],
    });
    if (error) { showError(error.message); return; }
    await loadMatrix(scheduleId);
    revalidate(scheduleId);
  };

  const removeAssignment = async (id: string) => {
    if (!scheduleId) return;
    const { error } = await supabase.from('shift_assignments').delete().eq('id', id);
    if (error) { showError(error.message); return; }
    await loadMatrix(scheduleId);
    revalidate(scheduleId);
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Kun admin
        </CardContent></Card>
      </div>
    );
  }

  // Day types per day index
  const dayTypes: DayType[] = useMemo(() => {
    const arr: DayType[] = [];
    for (let d = 0; d < days; d++) {
      if (d === 0 && includeArrival) arr.push('arrival');
      else if (d === days - 1 && includeDeparture) arr.push('departure');
      else arr.push('normal');
    }
    return arr;
  }, [days, includeArrival, includeDeparture]);

  // Rows to render: normal shifts always; arrival/departure only if that day exists
  const rowTypes: ShiftType[] = useMemo(() => {
    const hasArrival = dayTypes.includes('arrival');
    const hasDeparture = dayTypes.includes('departure');
    return shiftTypes
      .filter((st) =>
        st.day_type === 'normal' ||
        (st.day_type === 'arrival' && hasArrival) ||
        (st.day_type === 'departure' && hasDeparture),
      )
      .sort((a, b) => {
        const rank = (t: DayType) => (t === 'arrival' ? 0 : t === 'normal' ? 1 : 2);
        const r = rank(a.day_type) - rank(b.day_type);
        return r !== 0 ? r : a.sort_order - b.sort_order;
      });
  }, [shiftTypes, dayTypes]);

  // Cell lookup: `${shift_type_id}|${day}` -> AssignmentRow[]
  const cellMap = useMemo(() => {
    const m = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const k = `${a.shift_type_id}|${a.day_index}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    return m;
  }, [assignments]);

  // Regelbrudd per leader+day
  const violationSet = useMemo(() => {
    const s = new Set<string>();
    for (const w of validationWarnings) {
      if (w.leader_id != null && w.day_index != null) s.add(`${w.leader_id}|${w.day_index}`);
    }
    return s;
  }, [validationWarnings]);

  // Understaffed lookup: `${shift_type_slug or name}|${day}` — server sends slug in detail
  const understaffedSet = useMemo(() => {
    const s = new Set<string>();
    for (const w of understaffed) {
      // detail: `${slug}: x/y ledere (dag N)`
      const slug = (w.detail || '').split(':')[0]?.trim();
      if (slug && w.day_index != null) s.add(`${slug}|${w.day_index}`);
    }
    return s;
  }, [understaffed]);

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-heading font-bold">Vaktplan Mini</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">
              Enkel generator for få ledere. Samme regler: 8t/dag, F-team ikke etter 21, 11t hvile.
            </p>
          </div>
        </div>
        <Link to="/admin/shifts">
          <Button variant="outline" size="sm">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Full planner</span>
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Parametere
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Periode</Label>
              <Input type="number" min={1} max={20} value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label>År</Label>
              <Input type="number" value={year}
                onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            </div>
            <div>
              <Label>Antall dager</Label>
              <Input type="number" min={1} max={14} value={periodLength}
                onChange={(e) => setPeriodLength(Number(e.target.value) || 7)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={includeArrival} onCheckedChange={setIncludeArrival} id="arr" />
              <Label htmlFor="arr" className="cursor-pointer">Ankomstdag (dag 0)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={includeDeparture} onCheckedChange={setIncludeDeparture} id="dep" />
              <Label htmlFor="dep" className="cursor-pointer">Avreisedag (siste dag)</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Ledere ({selected.size}/{leaders.length})
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAll}>Alle</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Ingen</Button>
            </div>
          </div>
          <CardDescription>Kun valgte ledere brukes i genereringen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Søk ledere..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filteredLeaders.map((l) => (
                <label key={l.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <span className="text-sm truncate">{l.name}</span>
                </label>
              ))}
              {filteredLeaders.length === 0 && (
                <div className="text-sm text-muted-foreground py-2">Ingen treff</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10">
        <Button
          onClick={generate}
          disabled={generating || selected.size === 0}
          className="w-full h-12 text-base gap-2"
          size="lg"
        >
          {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          Generer vaktplan
        </Button>
      </div>

      {scheduleId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Vaktoversikt</CardTitle>
                <CardDescription>Klikk + for å legge til leder. × fjerner.</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {validationWarnings.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> {validationWarnings.length} regelbrudd
                  </span>
                )}
                {understaffed.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> {understaffed.length} underbemannet
                  </span>
                )}
                <Link to="/admin/shifts">
                  <Button variant="outline" size="sm" className="h-7">
                    <CalendarDays className="h-3.5 w-3.5 mr-1" /> Full planner
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background z-20 text-left px-2 py-2 border-b border-r border-border/60 min-w-[130px]">Vakt</th>
                    {Array.from({ length: days }, (_, d) => (
                      <th key={d} className="text-left px-2 py-2 border-b border-border/60 min-w-[150px]">
                        <div className="font-medium">Dag {d}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {dayTypes[d] === 'arrival' ? 'ankomst' : dayTypes[d] === 'departure' ? 'avreise' : 'normal'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowTypes.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="sticky left-0 bg-background z-10 px-2 py-1.5 border-b border-r border-border/40">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}
                        </div>
                      </td>
                      {Array.from({ length: days }, (_, d) => {
                        const applicable = row.day_type === dayTypes[d];
                        const key = `${row.id}|${d}`;
                        const items = cellMap.get(key) || [];
                        const usedIds = new Set(items.map((i) => i.leader_id).filter(Boolean) as string[]);
                        const missing = applicable && items.length < row.min_leaders;
                        return (
                          <td key={d} className="px-1.5 py-1 border-b border-border/40">
                            {!applicable ? (
                              <span className="text-muted-foreground/30">—</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {items.map((it) => {
                                  const bad = it.leader_id && violationSet.has(`${it.leader_id}|${d}`);
                                  return (
                                    <div key={it.id}
                                      className={`group inline-flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] ${bad ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                                      <span className="truncate">{it.leaders?.name || '—'}</span>
                                      <button onClick={() => removeAssignment(it.id)}
                                        className="opacity-40 hover:opacity-100">
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                                <Popover
                                  open={openCell === key}
                                  onOpenChange={(o) => setOpenCell(o ? key : null)}
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border border-dashed ${missing ? 'border-amber-500 text-amber-600' : 'border-border/60 text-muted-foreground'} hover:bg-muted`}>
                                      <Plus className="h-3 w-3" />
                                      {missing ? `${items.length}/${row.min_leaders}` : 'Legg til'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="p-0 w-56" align="start">
                                    <Command>
                                      <CommandInput placeholder="Søk leder..." />
                                      <CommandList>
                                        <CommandEmpty>Ingen treff</CommandEmpty>
                                        <CommandGroup>
                                          {leaders
                                            .filter((l) => !usedIds.has(l.id))
                                            .map((l) => (
                                              <CommandItem
                                                key={l.id}
                                                value={l.name || ''}
                                                onSelect={() => addLeader(d, row.id, l.id)}
                                              >
                                                {l.name}
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}