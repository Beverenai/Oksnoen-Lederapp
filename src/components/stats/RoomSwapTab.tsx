import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Check, X, ArrowRight, ArrowLeftRight, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface Participant {
  id: string;
  name: string;
  cabin_id: string | null;
  room: string | null;
}

interface Cabin {
  id: string;
  name: string;
}

interface RoomCapacity {
  cabin_id: string;
  room: string | null;
  bed_count: number;
}

interface RoomSwap {
  id: string;
  participant_id: string;
  from_cabin_id: string | null;
  from_room: string | null;
  to_cabin_id: string;
  to_room: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  reason: string | null;
}

interface SwapGroup {
  type: 'single' | 'mutual';
  swaps: RoomSwap[];
  participants: (Participant | undefined)[];
}

export function RoomSwapTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [roomCapacity, setRoomCapacity] = useState<RoomCapacity[]>([]);
  const [swaps, setSwaps] = useState<RoomSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);
  const [targetCabinId, setTargetCabinId] = useState('');
  const [targetRoom, setTargetRoom] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [selectedSwapIds, setSelectedSwapIds] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [participantsRes, cabinsRes, capacityRes, swapsRes] = await Promise.all([
        supabase.from('participants').select('id, name, cabin_id, room'),
        supabase.from('cabins').select('id, name').order('sort_order'),
        supabase.from('room_capacity').select('cabin_id, room, bed_count'),
        supabase.from('room_swaps').select('*').order('created_at', { ascending: false }),
      ]);
      if (participantsRes.data) setParticipants(participantsRes.data);
      if (cabinsRes.data) setCabins(cabinsRes.data);
      if (capacityRes.data) setRoomCapacity(capacityRes.data);
      if (swapsRes.data) setSwaps(swapsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  }

  const roomOccupancy = useMemo(() => {
    const occupancy: Record<string, number> = {};
    participants.forEach((p) => {
      if (p.cabin_id) {
        const key = `${p.cabin_id}-${p.room || '__none__'}`;
        occupancy[key] = (occupancy[key] || 0) + 1;
      }
    });
    return occupancy;
  }, [participants]);

  const cabinRooms = useMemo(() => {
    const map: Record<string, Set<string | null>> = {};
    participants.forEach((p) => {
      if (p.cabin_id) {
        if (!map[p.cabin_id]) map[p.cabin_id] = new Set();
        map[p.cabin_id].add(p.room || null);
      }
    });
    roomCapacity.forEach((rc) => {
      if (!map[rc.cabin_id]) map[rc.cabin_id] = new Set();
      map[rc.cabin_id].add(rc.room || null);
    });
    return map;
  }, [participants, roomCapacity]);

  function getOccupancy(cabinId: string, room: string | null) {
    const key = `${cabinId}-${room || '__none__'}`;
    const capacity = roomCapacity.find(
      (c) => c.cabin_id === cabinId && (c.room || null) === room
    );
    return { occupied: roomOccupancy[key] || 0, total: capacity?.bed_count || 6 };
  }

  function getResidents(cabinId: string, room: string | null) {
    return participants.filter(
      (p) => p.cabin_id === cabinId && (p.room || null) === (room || null)
    );
  }

  function getCabinName(cabinId: string | null): string {
    if (!cabinId) return 'Ukjent';
    return cabins.find((c) => c.id === cabinId)?.name || 'Ukjent';
  }

  function getRoomLabel(cabinId: string | null, room: string | null): string {
    const cabin = getCabinName(cabinId);
    return room ? `${cabin} – ${room}` : cabin;
  }

  const roomOptions = useMemo(() => {
    const options: { value: string; label: string; occupied: number; total: number }[] = [];
    cabins.forEach((cabin) => {
      const rooms = cabinRooms[cabin.id];
      if (!rooms || (rooms.size === 1 && rooms.has(null))) {
        const { occupied, total } = getOccupancy(cabin.id, null);
        options.push({ value: `${cabin.id}|`, label: cabin.name, occupied, total });
      } else {
        const sortedRooms = Array.from(rooms).filter((r) => r !== null).sort() as string[];
        sortedRooms.forEach((room) => {
          const { occupied, total } = getOccupancy(cabin.id, room);
          options.push({ value: `${cabin.id}|${room}`, label: `${cabin.name} – ${room}`, occupied, total });
        });
      }
    });
    return options;
  }, [cabins, cabinRooms, roomCapacity, roomOccupancy]);

  // Target room residents
  const targetResidents = useMemo(() => {
    if (!targetCabinId) return [];
    return getResidents(targetCabinId, targetRoom || null);
  }, [targetCabinId, targetRoom, participants]);

  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const selectedIds = new Set(selectedParticipants.map((p) => p.id));
    return participants
      .filter((p) => {
        if (selectedIds.has(p.id)) return false;
        return p.name.toLowerCase().includes(query) || getCabinName(p.cabin_id).toLowerCase().includes(query);
      })
      .slice(0, 10);
  }, [participants, searchQuery, cabins, selectedParticipants]);

  function handleSelectParticipant(p: Participant) {
    setSelectedParticipants((prev) => [...prev, p]);
    setSearchQuery('');
  }

  function handleRemoveParticipant(id: string) {
    setSelectedParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleAddSwaps() {
    if (selectedParticipants.length === 0 || !targetCabinId) {
      showError('Velg deltakere og nytt rom');
      return;
    }
    setSubmitting(true);
    try {
      const rows = selectedParticipants.map((p) => ({
        participant_id: p.id,
        from_cabin_id: p.cabin_id,
        from_room: p.room,
        to_cabin_id: targetCabinId,
        to_room: targetRoom || null,
        status: 'pending',
        reason: swapReason.trim() || null,
      }));
      const { error } = await supabase.from('room_swaps').insert(rows);
      if (error) throw error;
      showSuccess(`${rows.length} rombytte(r) lagt til`);
      setSelectedParticipants([]);
      setSearchQuery('');
      setTargetCabinId('');
      setTargetRoom('');
      setSwapReason('');
      loadData();
    } catch (error) {
      console.error('Error adding swaps:', error);
      showError('Kunne ikke legge til rombytter');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveSwaps() {
    if (selectedSwapIds.length === 0) return;
    setSubmitting(true);
    try {
      const toApprove = swaps.filter((s) => selectedSwapIds.includes(s.id) && s.status === 'pending');
      for (const swap of toApprove) {
        await supabase.from('participants').update({ cabin_id: swap.to_cabin_id, room: swap.to_room }).eq('id', swap.participant_id);
        await supabase.from('room_swaps').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', swap.id);
      }
      showSuccess(`${toApprove.length} rombytte(r) godkjent`);
      setSelectedSwapIds([]);
      loadData();
    } catch (error) {
      showError('Kunne ikke godkjenne rombytter');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSwaps() {
    if (selectedSwapIds.length === 0) return;
    setSubmitting(true);
    try {
      await supabase.from('room_swaps').delete().in('id', selectedSwapIds);
      showSuccess('Rombytter avbrutt');
      setSelectedSwapIds([]);
      loadData();
    } catch (error) {
      showError('Kunne ikke avbryte rombytter');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSwapSelection(id: string) {
    setSelectedSwapIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  // Group swaps into singles and mutual pairs
  function groupSwaps(swapList: RoomSwap[]): SwapGroup[] {
    const used = new Set<string>();
    const groups: SwapGroup[] = [];

    for (const s of swapList) {
      if (used.has(s.id)) continue;
      const p = participants.find((pp) => pp.id === s.participant_id);
      // Find mutual swap
      const mutual = swapList.find((other) => {
        if (other.id === s.id || used.has(other.id)) return false;
        const otherP = participants.find((pp) => pp.id === other.participant_id);
        if (!otherP || !p) return false;
        // A goes to B's current location, B goes to A's current location
        return (
          other.to_cabin_id === s.from_cabin_id &&
          (other.to_room || null) === (s.from_room || null) &&
          s.to_cabin_id === other.from_cabin_id &&
          (s.to_room || null) === (other.from_room || null)
        );
      });

      if (mutual) {
        used.add(s.id);
        used.add(mutual.id);
        const mutualP = participants.find((pp) => pp.id === mutual.participant_id);
        groups.push({ type: 'mutual', swaps: [s, mutual], participants: [p, mutualP] });
      } else {
        used.add(s.id);
        groups.push({ type: 'single', swaps: [s], participants: [p] });
      }
    }
    return groups;
  }

  const pendingSwaps = swaps.filter((s) => s.status === 'pending');
  const approvedSwaps = swaps.filter((s) => s.status === 'approved');
  const pendingGroups = useMemo(() => groupSwaps(pendingSwaps), [pendingSwaps, participants]);
  const approvedGroups = useMemo(() => groupSwaps(approvedSwaps), [approvedSwaps, participants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add new swaps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Legg til rombytte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Søk deltaker(e)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Skriv navn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {filteredParticipants.length > 0 && (
              <div className="border rounded-md divide-y bg-background shadow-sm max-h-48 overflow-y-auto">
                {filteredParticipants.map((p) => (
                  <button key={p.id} onClick={() => handleSelectParticipant(p)} className="w-full px-3 py-2 text-left hover:bg-muted/50 text-sm flex justify-between items-center">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs">{getCabinName(p.cabin_id)} {p.room || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedParticipants.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valgte deltakere ({selectedParticipants.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedParticipants.map((p) => (
                  <Badge key={p.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-[10px]">({getCabinName(p.cabin_id)} {p.room || ''})</span>
                    <button onClick={() => handleRemoveParticipant(p.id)} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nytt rom</Label>
            <Select
              value={targetCabinId ? `${targetCabinId}|${targetRoom}` : ''}
              onValueChange={(val) => { const [c, r] = val.split('|'); setTargetCabinId(c); setTargetRoom(r); }}
            >
              <SelectTrigger><SelectValue placeholder="Velg hytte og rom" /></SelectTrigger>
              <SelectContent>
                {roomOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{opt.label}</span>
                      <Badge variant={opt.occupied < opt.total ? 'secondary' : 'destructive'} className="ml-2">
                        {opt.occupied}/{opt.total} opptatt
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Residents of selected target room */}
          {targetCabinId && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Nåværende beboere ({targetResidents.length})
              </div>
              {targetResidents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Ingen beboere</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {targetResidents.map((r) => (
                    <Badge key={r.id} variant="outline" className="text-xs font-normal">{r.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Grunn (valgfritt)</Label>
            <Input placeholder="F.eks. ønsker å bo med venner..." value={swapReason} onChange={(e) => setSwapReason(e.target.value)} />
          </div>

          <Button onClick={handleAddSwaps} disabled={selectedParticipants.length === 0 || !targetCabinId || submitting} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Legg til {selectedParticipants.length > 1 ? `${selectedParticipants.length} rombytter` : 'i liste'}
          </Button>
        </CardContent>
      </Card>

      {/* Pending swaps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Ventende rombytter ({pendingSwaps.length})</CardTitle>
          {pendingSwaps.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancelSwaps} disabled={selectedSwapIds.length === 0 || submitting}>
                <X className="h-4 w-4 mr-1" />Avbryt
              </Button>
              <Button size="sm" onClick={handleApproveSwaps} disabled={selectedSwapIds.length === 0 || submitting}>
                <Check className="h-4 w-4 mr-1" />Godkjenn
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {pendingGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Ingen ventende rombytter</p>
          ) : (
            <div className="space-y-3">
              {pendingGroups.map((group) => (
                <SwapGroupCard
                  key={group.swaps.map((s) => s.id).join('-')}
                  group={group}
                  selectedSwapIds={selectedSwapIds}
                  toggleSwapSelection={toggleSwapSelection}
                  getCabinName={getCabinName}
                  getRoomLabel={getRoomLabel}
                  getResidents={getResidents}
                  variant="pending"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved swaps */}
      {approvedGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Godkjente rombytter ({approvedSwaps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvedGroups.slice(0, 10).map((group) => (
                <SwapGroupCard
                  key={group.swaps.map((s) => s.id).join('-')}
                  group={group}
                  selectedSwapIds={[]}
                  toggleSwapSelection={() => {}}
                  getCabinName={getCabinName}
                  getRoomLabel={getRoomLabel}
                  getResidents={getResidents}
                  variant="approved"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Sub-component for visual swap card ---

function SwapGroupCard({
  group,
  selectedSwapIds,
  toggleSwapSelection,
  getCabinName,
  getRoomLabel,
  getResidents,
  variant,
}: {
  group: SwapGroup;
  selectedSwapIds: string[];
  toggleSwapSelection: (id: string) => void;
  getCabinName: (id: string | null) => string;
  getRoomLabel: (cabinId: string | null, room: string | null) => string;
  getResidents: (cabinId: string, room: string | null) => Participant[];
  variant: 'pending' | 'approved';
}) {
  if (group.type === 'mutual') {
    const [swapA, swapB] = group.swaps;
    const [pA, pB] = group.participants;
    const allSelected = group.swaps.every((s) => selectedSwapIds.includes(s.id));

    return (
      <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
        <div className="flex items-center gap-2">
          {variant === 'pending' && (
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => group.swaps.forEach((s) => toggleSwapSelection(s.id))}
            />
          )}
          {variant === 'approved' && <Check className="h-4 w-4 text-green-600 shrink-0" />}
          <Badge variant="outline" className="text-xs gap-1">
            <ArrowLeftRight className="h-3 w-3" /> Gjensidig bytte
          </Badge>
          {swapA.reason && <span className="text-xs text-muted-foreground italic ml-auto">"{swapA.reason}"</span>}
        </div>
        {/* Visual swap */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
          <MiniRoomCard label={getRoomLabel(swapA.from_cabin_id, swapA.from_room)} residents={swapA.from_cabin_id ? getResidents(swapA.from_cabin_id, swapA.from_room) : []} highlight={pA?.name} colorClass="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30" />
          <div className="flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <MiniRoomCard label={getRoomLabel(swapA.to_cabin_id, swapA.to_room)} residents={getResidents(swapA.to_cabin_id, swapA.to_room)} highlight={pB?.name} colorClass="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30" />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {pA?.name} ⇄ {pB?.name}
        </p>
      </div>
    );
  }

  // Single swap
  const swap = group.swaps[0];
  const participant = group.participants[0];

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {variant === 'pending' && (
          <Checkbox checked={selectedSwapIds.includes(swap.id)} onCheckedChange={() => toggleSwapSelection(swap.id)} />
        )}
        {variant === 'approved' && <Check className="h-4 w-4 text-green-600 shrink-0" />}
        <span className="font-medium text-sm truncate">{participant?.name || 'Ukjent'}</span>
        {swap.reason && <span className="text-xs text-muted-foreground italic ml-auto">"{swap.reason}"</span>}
        {variant === 'approved' && swap.approved_at && (
          <span className="text-xs text-muted-foreground ml-auto">
            {format(new Date(swap.approved_at), 'd. MMM', { locale: nb })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        <MiniRoomCard
          label={getRoomLabel(swap.from_cabin_id, swap.from_room)}
          residents={swap.from_cabin_id ? getResidents(swap.from_cabin_id, swap.from_room) : []}
          highlight={participant?.name}
          colorClass="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
        />
        <div className="flex items-center justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <MiniRoomCard
          label={getRoomLabel(swap.to_cabin_id, swap.to_room)}
          residents={getResidents(swap.to_cabin_id, swap.to_room)}
          colorClass="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
        />
      </div>
    </div>
  );
}

function MiniRoomCard({
  label,
  residents,
  highlight,
  colorClass,
}: {
  label: string;
  residents: Participant[];
  highlight?: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-md border p-2 ${colorClass} space-y-1`}>
      <p className="text-xs font-medium truncate">{label}</p>
      {residents.length > 0 ? (
        <div className="space-y-0.5">
          {residents.slice(0, 6).map((r) => (
            <p key={r.id} className={`text-[11px] truncate ${r.name === highlight ? 'font-semibold' : 'text-muted-foreground'}`}>
              {r.name}
            </p>
          ))}
          {residents.length > 6 && (
            <p className="text-[10px] text-muted-foreground">+{residents.length - 6} til</p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Tomt</p>
      )}
    </div>
  );
}
