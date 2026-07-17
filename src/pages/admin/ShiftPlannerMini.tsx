import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowLeft, Loader2, Users, Shield, CalendarDays, Plus, X, Trash2, AlertTriangle, Wand2, Eraser } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;

interface MiniShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  min_leaders: number;
  sort_order: number;
}

interface MiniAssignment {
  id: string;
  shift_id: string;
  day_index: number;
  leader_id: string;
}

function durationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function absMinutes(day: number, start: string, end: string): { s: number; e: number } {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = day * 24 * 60 + sh * 60 + sm;
  let e = day * 24 * 60 + eh * 60 + em;
  if (e <= s) e += 24 * 60;
  return { s, e };
}

export default function ShiftPlannerMini() {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useStatusPopup();

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [days, setDays] = useState(7);
  const [shifts, setShifts] = useState<MiniShift[]>([]);
  const [assignments, setAssignments] = useState<MiniAssignment[]>([]);

  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('12:00');

  const [openCell, setOpenCell] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  const leaderById = useMemo(() => {
    const m = new Map<string, Leader>();
    for (const l of leaders) m.set(l.id, l);
    return m;
  }, [leaders]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, sRes, aRes] = await Promise.all([
        supabase.from('leaders').select('*').eq('is_active', true).order('name'),
        supabase.from('shift_planner_mini_shifts').select('*').order('sort_order').order('start_time'),
        supabase.from('shift_planner_mini_assignments').select('*'),
      ]);
      if (lRes.error) throw lRes.error;
      if (sRes.error) throw sRes.error;
      if (aRes.error) throw aRes.error;
      const ls = (lRes.data || []).filter((l) => l.phone !== '12345678');
      setLeaders(ls);
      setSelected((prev) => (prev.size === 0 ? new Set(ls.map((l) => l.id)) : prev));
      setShifts((sRes.data || []) as MiniShift[]);
      setAssignments((aRes.data || []) as MiniAssignment[]);
    } catch (e) {
      console.error(e);
      showError('Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const filteredLeaders = useMemo(() => {
    const q = leaderSearch.trim().toLowerCase();
    const base = leaders.filter((l) => selected.has(l.id));
    if (!q) return base;
    return base.filter((l) => (l.name || '').toLowerCase().includes(q));
  }, [leaders, leaderSearch, selected]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const stats = useMemo(() => {
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const perLeaderPerDay = new Map<string, number>();
    const totals = new Map<string, number>();
    const intervals = new Map<string, { s: number; e: number; day: number; shiftId: string }[]>();

    for (const a of assignments) {
      const sh = shiftById.get(a.shift_id);
      if (!sh) continue;
      const dur = durationHours(sh.start_time, sh.end_time);
      const dk = `${a.leader_id}|${a.day_index}`;
      perLeaderPerDay.set(dk, (perLeaderPerDay.get(dk) || 0) + dur);
      totals.set(a.leader_id, (totals.get(a.leader_id) || 0) + dur);
      const iv = absMinutes(a.day_index, sh.start_time, sh.end_time);
      const arr = intervals.get(a.leader_id) || [];
      arr.push({ s: iv.s, e: iv.e, day: a.day_index, shiftId: a.shift_id });
      intervals.set(a.leader_id, arr);
    }

    const restViolCells = new Set<string>();
    const restViolLeaders = new Map<string, number>();
    for (const [lid, arr] of intervals) {
      arr.sort((a, b) => a.s - b.s);
      // Slå sammen økter som er rygg-mot-rygg (gap <= 0) til blokker
      type Block = { s: number; e: number; members: typeof arr };
      const blocks: Block[] = [];
      for (const iv of arr) {
        const last = blocks[blocks.length - 1];
        if (last && iv.s <= last.e) {
          last.e = Math.max(last.e, iv.e);
          last.members.push(iv);
        } else {
          blocks.push({ s: iv.s, e: iv.e, members: [iv] });
        }
      }
      // Sjekk hvile mellom blokker
      for (let i = 1; i < blocks.length; i++) {
        const prev = blocks[i - 1];
        const cur = blocks[i];
        const gap = cur.s - prev.e;
        if (gap >= 11 * 60) continue;
        const prevDurH = (prev.e - prev.s) / 60;
        const endHour = ((prev.e % (24 * 60)) + 24 * 60) % (24 * 60) / 60; // 0..24
        const wasNight = endHour >= 0 && endHour < 7; // slutter natt/tidlig morgen
        if (prevDurH >= 8 || wasNight) {
          for (const m of prev.members) restViolCells.add(`${lid}|${m.shiftId}|${m.day}`);
          for (const m of cur.members) restViolCells.add(`${lid}|${m.shiftId}|${m.day}`);
          restViolLeaders.set(lid, (restViolLeaders.get(lid) || 0) + 1);
        }
      }
    }

    const overCells = new Set<string>();
    for (const [k, h] of perLeaderPerDay) if (h > 8) overCells.add(k);

    return { perLeaderPerDay, totals, restViolCells, restViolLeaders, overCells };
  }, [assignments, shifts]);

  const cellMap = useMemo(() => {
    const m = new Map<string, MiniAssignment[]>();
    for (const a of assignments) {
      const k = `${a.shift_id}|${a.day_index}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    return m;
  }, [assignments]);

  const addShift = async () => {
    if (!newName.trim()) { showError('Skriv inn navn'); return; }
    const { data, error } = await supabase
      .from('shift_planner_mini_shifts')
      .insert({
        name: newName.trim(),
        start_time: newStart,
        end_time: newEnd,
        sort_order: shifts.length,
      })
      .select('*')
      .single();
    if (error) { showError(error.message); return; }
    setShifts((prev) => [...prev, data as MiniShift]);
    setNewName('');
    showSuccess('Økt lagt til');
  };

  const deleteShift = async (id: string) => {
    const { error } = await supabase.from('shift_planner_mini_shifts').delete().eq('id', id);
    if (error) { showError(error.message); return; }
    setShifts((prev) => prev.filter((s) => s.id !== id));
    setAssignments((prev) => prev.filter((a) => a.shift_id !== id));
  };

  const assignLeader = async (shift_id: string, day: number, leader_id: string) => {
    setOpenCell(null);
    const exists = assignments.some((a) => a.shift_id === shift_id && a.day_index === day && a.leader_id === leader_id);
    if (exists) return;
    const tmp: MiniAssignment = { id: `tmp-${Math.random()}`, shift_id, day_index: day, leader_id };
    setAssignments((prev) => [...prev, tmp]);
    const { data, error } = await supabase
      .from('shift_planner_mini_assignments')
      .insert({ shift_id, day_index: day, leader_id })
      .select('*')
      .single();
    if (error) {
      setAssignments((prev) => prev.filter((a) => a.id !== tmp.id));
      showError(error.message);
      return;
    }
    setAssignments((prev) => prev.map((a) => (a.id === tmp.id ? (data as MiniAssignment) : a)));
  };

  const removeAssignment = async (id: string) => {
    const before = assignments;
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from('shift_planner_mini_assignments').delete().eq('id', id);
    if (error) { setAssignments(before); showError(error.message); }
  };

  function targetForShift(name: string): number {
    const n = name.toLowerCase();
    if (n.includes('nattevakt')) return 1;
    if (n.includes('sanitas')) return 2;
    if (n.includes('frokost') || n.includes('vekking')) return 1;
    if (n.includes('middag')) return 2;
    if (n.includes('kveldsmat')) return 2;
    return 99;
  }

  const clearAll = async () => {
    if (!confirm('Fjerne alle tildelinger?')) return;
    const before = assignments;
    setAssignments([]);
    const { error } = await supabase.from('shift_planner_mini_assignments').delete().not('id', 'is', null);
    if (error) { setAssignments(before); showError(error.message); return; }
    showSuccess('Nullstilt');
  };

  const autoFill = async () => {
    if (shifts.length === 0) { showError('Legg til økter først'); return; }
    const pool = leaders.filter((l) => selected.has(l.id));
    if (pool.length === 0) { showError('Ingen ledere valgt'); return; }
    setAutoFilling(true);
    try {
      const existing = [...assignments];
      const dayMinutes = new Map<string, number>();
      const leaderIntervals = new Map<string, { s: number; e: number }[]>();
      const shiftById = new Map(shifts.map((s) => [s.id, s]));
      const totalMins = new Map<string, number>();
      for (const a of existing) {
        const sh = shiftById.get(a.shift_id);
        if (!sh) continue;
        const iv = absMinutes(a.day_index, sh.start_time, sh.end_time);
        const mins = iv.e - iv.s;
        dayMinutes.set(`${a.leader_id}|${a.day_index}`, (dayMinutes.get(`${a.leader_id}|${a.day_index}`) || 0) + mins);
        const arr = leaderIntervals.get(a.leader_id) || [];
        arr.push({ s: iv.s, e: iv.e });
        leaderIntervals.set(a.leader_id, arr);
        totalMins.set(a.leader_id, (totalMins.get(a.leader_id) || 0) + mins);
      }

      type Slot = { shift: MiniShift; day: number; s: number; e: number; target: number };
      const slots: Slot[] = [];
      for (let d = 0; d < days; d++) {
        for (const sh of shifts) {
          const iv = absMinutes(d, sh.start_time, sh.end_time);
          slots.push({ shift: sh, day: d, s: iv.s, e: iv.e, target: targetForShift(sh.name) });
        }
      }
      slots.sort((a, b) => a.s - b.s);

      const canAssign = (lid: string, slot: Slot): boolean => {
        if (existing.some((a) => a.shift_id === slot.shift.id && a.day_index === slot.day && a.leader_id === lid)) return false;
        const slotMins = slot.e - slot.s;
        if ((dayMinutes.get(`${lid}|${slot.day}`) || 0) + slotMins > 8 * 60) return false;
        const ivs = [...(leaderIntervals.get(lid) || []), { s: slot.s, e: slot.e }].sort((a, b) => a.s - b.s);
        const blocks: { s: number; e: number }[] = [];
        for (const iv of ivs) {
          const last = blocks[blocks.length - 1];
          if (last && iv.s < last.e) return false;
          if (last && iv.s === last.e) last.e = Math.max(last.e, iv.e);
          else blocks.push({ s: iv.s, e: iv.e });
        }
        for (let i = 1; i < blocks.length; i++) {
          const prev = blocks[i - 1];
          const cur = blocks[i];
          const gap = cur.s - prev.e;
          if (gap >= 11 * 60) continue;
          const prevDurH = (prev.e - prev.s) / 60;
          const endHour = (prev.e % (24 * 60)) / 60;
          const wasNight = endHour >= 0 && endHour < 7;
          if (prevDurH >= 8 || wasNight) return false;
        }
        return true;
      };

      const additions: { shift_id: string; day_index: number; leader_id: string }[] = [];
      for (const slot of slots) {
        const cur = existing.filter((a) => a.shift_id === slot.shift.id && a.day_index === slot.day).length
          + additions.filter((a) => a.shift_id === slot.shift.id && a.day_index === slot.day).length;
        let need = Math.max(0, slot.target - cur);
        if (need === 0) continue;
        const candidates = pool
          .filter((l) => canAssign(l.id, slot))
          .sort((a, b) => (totalMins.get(a.id) || 0) - (totalMins.get(b.id) || 0));
        for (const l of candidates) {
          if (need === 0) break;
          additions.push({ shift_id: slot.shift.id, day_index: slot.day, leader_id: l.id });
          const slotMins = slot.e - slot.s;
          dayMinutes.set(`${l.id}|${slot.day}`, (dayMinutes.get(`${l.id}|${slot.day}`) || 0) + slotMins);
          const arr = leaderIntervals.get(l.id) || [];
          arr.push({ s: slot.s, e: slot.e });
          leaderIntervals.set(l.id, arr);
          totalMins.set(l.id, (totalMins.get(l.id) || 0) + slotMins);
          need--;
        }
      }

      if (additions.length === 0) { showError('Fant ingen mulige tildelinger'); return; }
      const { data, error } = await supabase.from('shift_planner_mini_assignments').insert(additions).select('*');
      if (error) { showError(error.message); return; }
      setAssignments((prev) => [...prev, ...((data || []) as MiniAssignment[])]);
      showSuccess(`La til ${additions.length} tildelinger`);
    } finally {
      setAutoFilling(false);
    }
  };

  const moveAssignment = async (id: string, shift_id: string, day: number) => {
    const before = assignments;
    const a = before.find((x) => x.id === id);
    if (!a) return;
    if (a.shift_id === shift_id && a.day_index === day) return;
    const dup = before.some((x) => x.shift_id === shift_id && x.day_index === day && x.leader_id === a.leader_id);
    if (dup) { await removeAssignment(id); return; }
    setAssignments((prev) => prev.map((x) => (x.id === id ? { ...x, shift_id, day_index: day } : x)));
    const { error } = await supabase
      .from('shift_planner_mini_assignments')
      .update({ shift_id, day_index: day })
      .eq('id', id);
    if (error) { setAssignments(before); showError(error.message); }
  };

  const onDragStartLeader = (e: React.DragEvent, leader_id: string) => {
    e.dataTransfer.setData('text/mini', JSON.stringify({ kind: 'leader', leader_id }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onDragStartAssignment = (e: React.DragEvent, a: MiniAssignment) => {
    e.dataTransfer.setData('text/mini', JSON.stringify({ kind: 'assignment', id: a.id, leader_id: a.leader_id }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverCell = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDropCell = async (e: React.DragEvent, shift_id: string, day: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/mini');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.kind === 'leader') await assignLeader(shift_id, day, p.leader_id);
      else if (p.kind === 'assignment') await moveAssignment(p.id, shift_id, day);
    } catch {
      // Ignore invalid drag payloads.
    }
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

  const totalRestViol = stats.restViolCells.size / 2;

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
              Manuell planlegger — dra ledere til vakter. Regner timer og 11 t hvile.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Dager</Label>
          <Input type="number" min={1} max={14} value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 7)))}
            className="w-16 h-8" />
          <Button size="sm" variant="outline" onClick={clearAll}>
            <Eraser className="h-3.5 w-3.5 mr-1" />Nullstill
          </Button>
          <Button size="sm" onClick={autoFill} disabled={autoFilling}>
            {autoFilling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            Auto-fyll
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Økter ({shifts.length})
          </CardTitle>
          <CardDescription>Definer navn, start og slutt. Varighet regnes automatisk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Navn</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="F.eks. Bings Økt 1" />
            </div>
            <div>
              <Label className="text-xs">Start</Label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-28" />
            </div>
            <div>
              <Label className="text-xs">Slutt</Label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-28" />
            </div>
            <Button onClick={addShift}><Plus className="h-4 w-4 mr-1" />Legg til</Button>
          </div>
          {shifts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {shifts.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {durationHours(s.start_time, s.end_time)}t
                  </span>
                  <button onClick={() => deleteShift(s.id)} className="ml-1 opacity-60 hover:opacity-100" title="Slett">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Ledere
            </CardTitle>
            <CardDescription>Dra inn i matrisen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Søk..." value={leaderSearch} onChange={(e) => setLeaderSearch(e.target.value)} className="h-8" />
            {loading ? (
              <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                {filteredLeaders.map((l) => {
                  const total = stats.totals.get(l.id) || 0;
                  const restCount = stats.restViolLeaders.get(l.id) || 0;
                  return (
                    <div key={l.id}
                      draggable
                      onDragStart={(e) => onDragStartLeader(e, l.id)}
                      className="group flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:border-primary/40">
                      <div className="truncate flex-1">
                        <div className="font-medium truncate">{l.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {total.toFixed(1)}t total
                          {restCount > 0 && (
                            <span className="ml-1 text-destructive inline-flex items-center gap-0.5">
                              <AlertTriangle className="h-3 w-3" />{restCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => toggleSelected(l.id)} className="opacity-40 hover:opacity-100" title="Skjul">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {selected.size < leaders.length && (
                  <button className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
                    onClick={() => setSelected(new Set(leaders.map((l) => l.id)))}>
                    Vis alle ({leaders.length})
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Vaktoversikt</CardTitle>
                <CardDescription>Dra leder inn i celle. × fjerner. Rødt = brudd på 11 t hvile. Gult = over 8 t/dag.</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {totalRestViol > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> {totalRestViol} hvilebrudd
                  </span>
                )}
                {stats.overCells.size > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> {stats.overCells.size} over 8t
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {shifts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Legg til minst én økt over for å begynne.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background z-20 text-left px-2 py-2 border-b border-r border-border/60 min-w-[140px]">Vakt</th>
                      {Array.from({ length: days }, (_, d) => (
                        <th key={d} className="text-left px-2 py-2 border-b border-border/60 min-w-[140px]">
                          <div className="font-medium">Dag {d + 1}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((row) => {
                      const dur = durationHours(row.start_time, row.end_time);
                      return (
                        <tr key={row.id} className="align-top">
                          <td className="sticky left-0 bg-background z-10 px-2 py-1.5 border-b border-r border-border/40">
                            <div className="font-medium">{row.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)} · {dur}t
                            </div>
                          </td>
                          {Array.from({ length: days }, (_, d) => {
                            const key = `${row.id}|${d}`;
                            const items = cellMap.get(key) || [];
                            const usedIds = new Set(items.map((i) => i.leader_id));
                            return (
                              <td key={d}
                                onDragOver={onDragOverCell}
                                onDrop={(e) => onDropCell(e, row.id, d)}
                                className="px-1.5 py-1 border-b border-border/40 align-top">
                                <div className="min-h-[40px] flex flex-wrap gap-1 items-start">
                                  {items.map((a) => {
                                    const l = leaderById.get(a.leader_id);
                                    const rest = stats.restViolCells.has(`${a.leader_id}|${row.id}|${d}`);
                                    const over = stats.overCells.has(`${a.leader_id}|${d}`);
                                    return (
                                      <span key={a.id}
                                        draggable
                                        onDragStart={(e) => onDragStartAssignment(e, a)}
                                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 cursor-grab active:cursor-grabbing ${
                                          rest ? 'border-destructive/60 bg-destructive/10 text-destructive'
                                            : over ? 'border-amber-500/60 bg-amber-500/10 text-amber-700'
                                            : 'border-border/60 bg-muted/40'
                                        }`}>
                                        {(rest || over) && <AlertTriangle className="h-3 w-3" />}
                                        <span className="max-w-[100px] truncate">{l?.name || '?'}</span>
                                        <button onClick={() => removeAssignment(a.id)} className="opacity-60 hover:opacity-100">
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                  <Popover open={openCell === key} onOpenChange={(o) => setOpenCell(o ? key : null)}>
                                    <PopoverTrigger asChild>
                                      <button className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-border/60 px-1.5 py-0.5 text-muted-foreground hover:border-primary/60 hover:text-foreground">
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-56" align="start">
                                      <Command>
                                        <CommandInput placeholder="Legg til leder..." />
                                        <CommandList>
                                          <CommandEmpty>Ingen treff</CommandEmpty>
                                          <CommandGroup>
                                            {leaders.filter((l) => !usedIds.has(l.id)).map((l) => (
                                              <CommandItem key={l.id} value={l.name}
                                                onSelect={() => assignLeader(row.id, d, l.id)}>
                                                {l.name}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
