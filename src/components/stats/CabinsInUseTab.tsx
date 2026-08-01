import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { guessGender } from '@/lib/nameGender';
import { differenceInYears } from 'date-fns';
import { Home, Users, Bed, Loader2, ChevronDown, ChevronRight, UserPlus, X } from 'lucide-react';

interface RoomParticipant {
  id: string;
  name: string;
  age: number | null;
  gender: 'female' | 'male' | 'unknown';
}

interface Row {
  cabinId: string;
  cabinName: string;
  total: number;
  rooms: {
    room: string;
    count: number;
    beds: number | null;
    girls: number;
    boys: number;
    ages: number[];
    participants: RoomParticipant[];
  }[];
  leaders: { id: string; name: string }[];
}

function ageLabel(ages: number[]): string | null {
  if (ages.length === 0) return null;
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  const avg = ages.reduce((s, a) => s + a, 0) / ages.length;
  return min === max ? `${min} år` : `${min}–${max} år (ø ${avg.toFixed(1)})`;
}

export function CabinsInUseTab() {
  const { data: periodId } = useActivePeriodId();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cabins-in-use', periodId ?? 'none'],
    enabled: !!periodId,
    staleTime: 30_000,
    queryFn: async () => {
      const [cabinsRes, partsRes, capRes, leaderCabinsRes, bookingsRes] = await Promise.all([
        supabase.from('cabins').select('id, name').order('sort_order', { ascending: true }),
        supabase
          .from('participants')
          .select('id, name, first_name, birth_date, cabin_id, room, has_arrived')
          .eq('period_id', periodId!)
          .order('name', { ascending: true }),
        supabase.from('room_capacity').select('cabin_id, room, bed_count'),
        supabase.from('leader_cabins').select('cabin_id, leader_id, leaders!inner(id, name, is_active)'),
        supabase.from('participant_bookings').select('participant_id, gender').eq('period_id', periodId!),
      ]);
      if (cabinsRes.error) throw cabinsRes.error;
      if (partsRes.error) throw partsRes.error;
      if (capRes.error) throw capRes.error;
      if (leaderCabinsRes.error) throw leaderCabinsRes.error;
      return {
        cabins: cabinsRes.data ?? [],
        participants: partsRes.data ?? [],
        capacity: capRes.data ?? [],
        bookings: bookingsRes.data ?? [],
        leaderCabins: (leaderCabinsRes.data ?? []) as unknown as {
          cabin_id: string;
          leader_id: string;
          leaders: { id: string; name: string; is_active: boolean | null } | null;
        }[],
      };
    },
  });

  const { data: activeLeaders = [] } = useQuery({
    queryKey: ['active-leaders-simple'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignLeader = useMutation({
    mutationFn: async ({ cabinId, leaderId }: { cabinId: string; leaderId: string }) => {
      const { error } = await supabase.from('leader_cabins').insert({ cabin_id: cabinId, leader_id: leaderId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Hytteleder lagret');
      setAssigning(null);
      queryClient.invalidateQueries({ queryKey: ['cabins-in-use'] });
      queryClient.invalidateQueries({ queryKey: ['leader-cabins-map', 'active-only'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Kunne ikke lagre hytteleder'),
  });

  const removeLeader = useMutation({
    mutationFn: async ({ cabinId, leaderId }: { cabinId: string; leaderId: string }) => {
      const { error } = await supabase
        .from('leader_cabins')
        .delete()
        .eq('cabin_id', cabinId)
        .eq('leader_id', leaderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Hytteleder fjernet');
      queryClient.invalidateQueries({ queryKey: ['cabins-in-use'] });
      queryClient.invalidateQueries({ queryKey: ['leader-cabins-map', 'active-only'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Kunne ikke fjerne hytteleder'),
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const genderByParticipant = new Map(
      data.bookings.map((b: any) => [b.participant_id as string, (b.gender ?? '') as string])
    );
    const resolveGender = (p: any): 'female' | 'male' | 'unknown' => {
      const raw = (genderByParticipant.get(p.id) || '').toLowerCase();
      if (raw.startsWith('k') || raw.startsWith('f') || raw.startsWith('j')) return 'female';
      if (raw.startsWith('m') || raw.startsWith('g')) return 'male';
      return guessGender(p.first_name || p.name);
    };
    return data.cabins
      .map((c) => {
        const parts = data.participants.filter((p) => p.cabin_id === c.id);
        if (parts.length === 0) return null;
        const roomMap = new Map<string, RoomParticipant[]>();
        parts.forEach((p: any) => {
          const key = (p.room || 'Enkeltrom').toLowerCase();
          const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : null;
          const list = roomMap.get(key) || [];
          list.push({ id: p.id, name: p.name, age, gender: resolveGender(p) });
          roomMap.set(key, list);
        });
        const rooms = [...roomMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([room, list]) => ({
            room,
            count: list.length,
            participants: list,
            girls: list.filter((p) => p.gender === 'female').length,
            boys: list.filter((p) => p.gender === 'male').length,
            ages: list.map((p) => p.age).filter((a): a is number => a != null),
            beds:
              data.capacity.find(
                (cap) => cap.cabin_id === c.id && (cap.room || 'enkeltrom').toLowerCase() === room
              )?.bed_count ?? null,
          }));
        const leaders = data.leaderCabins
          .filter((lc) => lc.cabin_id === c.id && lc.leaders?.is_active)
          .map((lc) => ({ id: lc.leader_id, name: lc.leaders!.name }));
        return { cabinId: c.id, cabinName: c.name, total: parts.length, rooms, leaders };
      })
      .filter(Boolean) as Row[];
  }, [data]);

  const totals = useMemo(
    () => ({
      cabins: rows.length,
      participants: rows.reduce((s, r) => s + r.total, 0),
    }),
    [rows]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        Ingen hytter er i bruk i denne perioden ennå.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-around py-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{totals.cabins}</p>
            <p className="text-xs text-muted-foreground">hytter i bruk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totals.participants}</p>
            <p className="text-xs text-muted-foreground">deltakere plassert</p>
          </div>
        </CardContent>
      </Card>

      {rows.map((row) => (
        <Card key={row.cabinId}>
          <CardHeader
            className="pb-2 cursor-pointer select-none"
            onClick={() => toggle(row.cabinId)}
          >
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                {expanded.has(row.cabinId) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Home className="h-4 w-4 text-muted-foreground" />
                {row.cabinName}
              </span>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {row.total}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {row.rooms.map((r) => (
                <div key={r.room} className="rounded-md bg-muted/30 px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{r.room}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bed className="h-3 w-3" />
                      {r.count}
                      {r.beds != null ? ` / ${r.beds}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {ageLabel(r.ages) && (
                      <Badge variant="outline" className="text-[11px]">
                        {ageLabel(r.ages)}
                      </Badge>
                    )}
                    {r.girls > 0 && (
                      <Badge variant="outline" className="text-[11px]">
                        {r.girls} jenter
                      </Badge>
                    )}
                    {r.boys > 0 && (
                      <Badge variant="outline" className="text-[11px]">
                        {r.boys} gutter
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Hytteledere */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {row.leaders.map((l) => (
                <Badge key={l.id} variant="outline" className="text-xs gap-1">
                  {l.name}
                  <button
                    type="button"
                    aria-label={`Fjern ${l.name}`}
                    onClick={() => removeLeader.mutate({ cabinId: row.cabinId, leaderId: l.id })}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {assigning === row.cabinId ? (
                <Select
                  onValueChange={(leaderId) => assignLeader.mutate({ cabinId: row.cabinId, leaderId })}
                >
                  <SelectTrigger className="h-8 w-full sm:w-56 text-xs">
                    <SelectValue placeholder="Velg hytteleder" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLeaders
                      .filter((l) => !row.leaders.some((rl) => rl.id === l.id))
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setAssigning(row.cabinId)}
                >
                  <UserPlus className="h-3 w-3" />
                  Hytteleder
                </Button>
              )}
            </div>

            {/* Deltakerliste */}
            {expanded.has(row.cabinId) && (
              <div className="space-y-3 pt-1">
                {row.rooms.map((r) => (
                  <div key={`list-${r.room}`} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                      {r.room}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {r.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-md border px-3 py-1.5"
                        >
                          <span className="text-sm truncate">{p.name}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {p.age != null && (
                              <Badge variant="secondary" className="text-[11px]">
                                {p.age} år
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[11px]">
                              {p.gender === 'female' ? 'Jente' : p.gender === 'male' ? 'Gutt' : '—'}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
