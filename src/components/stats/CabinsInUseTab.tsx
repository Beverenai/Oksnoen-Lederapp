import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Users, Bed, Loader2 } from 'lucide-react';

interface Row {
  cabinId: string;
  cabinName: string;
  total: number;
  rooms: { room: string; count: number; beds: number | null }[];
  leaders: string[];
}

export function CabinsInUseTab() {
  const { data: periodId } = useActivePeriodId();

  const { data, isLoading } = useQuery({
    queryKey: ['cabins-in-use', periodId ?? 'none'],
    enabled: !!periodId,
    staleTime: 30_000,
    queryFn: async () => {
      const [cabinsRes, partsRes, capRes, leaderCabinsRes] = await Promise.all([
        supabase.from('cabins').select('id, name').order('sort_order', { ascending: true }),
        supabase.from('participants').select('id, cabin_id, room, has_arrived').eq('period_id', periodId!),
        supabase.from('room_capacity').select('cabin_id, room, bed_count'),
        supabase.from('leader_cabins').select('cabin_id, leaders!inner(name, is_active)'),
      ]);
      if (cabinsRes.error) throw cabinsRes.error;
      if (partsRes.error) throw partsRes.error;
      if (capRes.error) throw capRes.error;
      if (leaderCabinsRes.error) throw leaderCabinsRes.error;
      return {
        cabins: cabinsRes.data ?? [],
        participants: partsRes.data ?? [],
        capacity: capRes.data ?? [],
        leaderCabins: (leaderCabinsRes.data ?? []) as unknown as {
          cabin_id: string;
          leaders: { name: string; is_active: boolean | null } | null;
        }[],
      };
    },
  });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.cabins
      .map((c) => {
        const parts = data.participants.filter((p) => p.cabin_id === c.id);
        if (parts.length === 0) return null;
        const roomMap = new Map<string, number>();
        parts.forEach((p) => {
          const key = (p.room || 'Enkeltrom').toLowerCase();
          roomMap.set(key, (roomMap.get(key) || 0) + 1);
        });
        const rooms = [...roomMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([room, count]) => ({
            room,
            count,
            beds:
              data.capacity.find(
                (cap) => cap.cabin_id === c.id && (cap.room || 'enkeltrom').toLowerCase() === room
              )?.bed_count ?? null,
          }));
        const leaders = data.leaderCabins
          .filter((lc) => lc.cabin_id === c.id && lc.leaders?.is_active)
          .map((lc) => lc.leaders!.name);
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
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                {row.cabinName}
              </span>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {row.total}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {row.rooms.map((r) => (
                <div
                  key={r.room}
                  className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm font-medium capitalize">{r.room}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Bed className="h-3 w-3" />
                    {r.count}
                    {r.beds != null ? ` / ${r.beds}` : ''}
                  </span>
                </div>
              ))}
            </div>
            {row.leaders.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {row.leaders.map((name) => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
