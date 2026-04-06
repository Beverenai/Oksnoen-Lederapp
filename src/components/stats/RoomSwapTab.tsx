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
import { Separator } from '@/components/ui/separator';
import { Search, Plus, Check, X, ArrowRight, Loader2 } from 'lucide-react';
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
  participant?: Participant;
  from_cabin?: Cabin;
  to_cabin?: Cabin;
}

export function RoomSwapTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [roomCapacity, setRoomCapacity] = useState<RoomCapacity[]>([]);
  const [swaps, setSwaps] = useState<RoomSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [targetCabinId, setTargetCabinId] = useState('');
  const [targetRoom, setTargetRoom] = useState('');
  const [swapReason, setSwapReason] = useState('');
  // Selection state for batch approval
  const [selectedSwapIds, setSelectedSwapIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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

  // Calculate occupancy per room
  const roomOccupancy = useMemo(() => {
    const occupancy: Record<string, number> = {};
    participants.forEach((p) => {
      if (p.cabin_id) {
        const key = `${p.cabin_id}-${p.room || 'null'}`;
        occupancy[key] = (occupancy[key] || 0) + 1;
      }
    });
    return occupancy;
  }, [participants]);

  // Get available beds for a room
  function getAvailableBeds(cabinId: string, room: string | null): { available: number; total: number } {
    const key = `${cabinId}-${room || 'null'}`;
    const capacity = roomCapacity.find(
      (c) => c.cabin_id === cabinId && c.room === room
    );
    const total = capacity?.bed_count || 6;
    const occupied = roomOccupancy[key] || 0;
    return { available: total - occupied, total };
  }

  // Get room options for dropdown
  const roomOptions = useMemo(() => {
    const options: { value: string; label: string; available: number; total: number }[] = [];
    cabins.forEach((cabin) => {
      ['høyre', 'venstre'].forEach((room) => {
        const { available, total } = getAvailableBeds(cabin.id, room);
        options.push({
          value: `${cabin.id}|${room}`,
          label: `${cabin.name} ${room}`,
          available,
          total,
        });
      });
    });
    return options;
  }, [cabins, roomCapacity, roomOccupancy]);

  // Filter participants by search (name or cabin name)
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return participants
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const cabinName = getCabinName(p.cabin_id).toLowerCase();
        const cabinMatch = cabinName.includes(query);
        return nameMatch || cabinMatch;
      })
      .slice(0, 10);
  }, [participants, searchQuery, cabins]);

  // Get cabin name by id
  function getCabinName(cabinId: string | null): string {
    if (!cabinId) return 'Ukjent';
    return cabins.find((c) => c.id === cabinId)?.name || 'Ukjent';
  }

  // Add swap to pending list
  async function handleAddSwap() {
    if (!selectedParticipant || !targetCabinId) {
      showError('Velg deltaker og nytt rom');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('room_swaps').insert({
        participant_id: selectedParticipant.id,
        from_cabin_id: selectedParticipant.cabin_id,
        from_room: selectedParticipant.room,
        to_cabin_id: targetCabinId,
        to_room: targetRoom || null,
        status: 'pending',
        reason: swapReason.trim() || null,
      });

      if (error) throw error;

      showSuccess('Rombytte lagt til');
      setSelectedParticipant(null);
      setSearchQuery('');
      setTargetCabinId('');
      setTargetRoom('');
      setSwapReason('');
      loadData();
    } catch (error) {
      console.error('Error adding swap:', error);
      showError('Kunne ikke legge til rombytte');
    } finally {
      setSubmitting(false);
    }
  }

  // Approve selected swaps
  async function handleApproveSwaps() {
    if (selectedSwapIds.length === 0) {
      showError('Velg rombytter å godkjenne');
      return;
    }

    setSubmitting(true);
    try {
      // Get the swaps to approve
      const swapsToApprove = swaps.filter(
        (s) => selectedSwapIds.includes(s.id) && s.status === 'pending'
      );

      // Update participant rooms and swap status
      for (const swap of swapsToApprove) {
        // Update participant
        await supabase
          .from('participants')
          .update({ cabin_id: swap.to_cabin_id, room: swap.to_room })
          .eq('id', swap.participant_id);

        // Update swap status
        await supabase
          .from('room_swaps')
          .update({ status: 'approved', approved_at: new Date().toISOString() })
          .eq('id', swap.id);
      }

      showSuccess(`${swapsToApprove.length} rombytte(r) godkjent`);
      setSelectedSwapIds([]);
      loadData();
    } catch (error) {
      console.error('Error approving swaps:', error);
      showError('Kunne ikke godkjenne rombytter');
    } finally {
      setSubmitting(false);
    }
  }

  // Cancel selected swaps
  async function handleCancelSwaps() {
    if (selectedSwapIds.length === 0) {
      showError('Velg rombytter å avbryte');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from('room_swaps').delete().in('id', selectedSwapIds);

      showSuccess('Rombytter avbrutt');
      setSelectedSwapIds([]);
      loadData();
    } catch (error) {
      console.error('Error canceling swaps:', error);
      showError('Kunne ikke avbryte rombytter');
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle swap selection
  function toggleSwapSelection(id: string) {
    setSelectedSwapIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const pendingSwaps = swaps.filter((s) => s.status === 'pending');
  const approvedSwaps = swaps.filter((s) => s.status === 'approved');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add new swap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Legg til rombytte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search participant */}
          <div className="space-y-2">
            <Label>Søk deltaker</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Skriv navn..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedParticipant(null);
                }}
                className="pl-10"
              />
            </div>
            {/* Search results */}
            {filteredParticipants.length > 0 && !selectedParticipant && (
              <div className="border rounded-md divide-y bg-background shadow-sm">
                {filteredParticipants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedParticipant(p);
                      setSearchQuery(p.name);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted/50 text-sm flex justify-between items-center"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {getCabinName(p.cabin_id)} {p.room || ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected participant info */}
          {selectedParticipant && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <span className="font-medium">{selectedParticipant.name}</span>
              <Badge variant="secondary">
                {getCabinName(selectedParticipant.cabin_id)} {selectedParticipant.room || ''}
              </Badge>
            </div>
          )}

          {/* Target room */}
          <div className="space-y-2">
            <Label>Nytt rom</Label>
            <Select
              value={targetCabinId && targetRoom ? `${targetCabinId}|${targetRoom}` : ''}
              onValueChange={(val) => {
                const [cabinId, room] = val.split('|');
                setTargetCabinId(cabinId);
                setTargetRoom(room);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg hytte og rom" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{opt.label}</span>
                      <Badge 
                        variant={opt.available > 0 ? 'secondary' : 'destructive'}
                        className="ml-2"
                      >
                        {opt.available}/{opt.total} ledig
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Grunn (valgfritt)</Label>
            <Input
              placeholder="F.eks. ønsker å bo med venner..."
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
            />
          </div>

          <Button
            onClick={handleAddSwap}
            disabled={!selectedParticipant || !targetCabinId || submitting}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Legg til i liste
          </Button>
        </CardContent>
      </Card>

      {/* Pending swaps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">
            Ventende rombytter ({pendingSwaps.length})
          </CardTitle>
          {pendingSwaps.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelSwaps}
                disabled={selectedSwapIds.length === 0 || submitting}
              >
                <X className="h-4 w-4 mr-1" />
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleApproveSwaps}
                disabled={selectedSwapIds.length === 0 || submitting}
              >
                <Check className="h-4 w-4 mr-1" />
                Godkjenn
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {pendingSwaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ingen ventende rombytter
            </p>
          ) : (
            <div className="space-y-2">
              {pendingSwaps.map((swap) => {
                const participant = participants.find((p) => p.id === swap.participant_id);
                return (
                  <div
                    key={swap.id}
                    className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selectedSwapIds.includes(swap.id)}
                      onCheckedChange={() => toggleSwapSelection(swap.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {participant?.name || 'Ukjent'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {getCabinName(swap.from_cabin_id)} {swap.from_room || ''}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-foreground">
                          {getCabinName(swap.to_cabin_id)} {swap.to_room || ''}
                        </span>
                      </div>
                      {swap.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{swap.reason}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved swaps */}
      {approvedSwaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Godkjente rombytter ({approvedSwaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {approvedSwaps.slice(0, 10).map((swap) => {
                const participant = participants.find((p) => p.id === swap.participant_id);
                return (
                  <div
                    key={swap.id}
                    className="flex items-center gap-3 p-3 border rounded-md bg-muted/20"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {participant?.name || 'Ukjent'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {getCabinName(swap.from_cabin_id)} {swap.from_room || ''}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>
                          {getCabinName(swap.to_cabin_id)} {swap.to_room || ''}
                        </span>
                        {swap.approved_at && (
                          <>
                            <span>•</span>
                            <span>
                              {format(new Date(swap.approved_at), 'd. MMM', { locale: nb })}
                            </span>
                          </>
                        )}
                      </div>
                      {swap.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{swap.reason}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
