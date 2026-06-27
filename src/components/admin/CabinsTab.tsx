import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Home, 
  Plus, 
  Trash2,
  Loader2,
  GripVertical,
  Bed,
  Users,
  Save
} from 'lucide-react';

interface Cabin {
  id: string;
  name: string;
  sort_order: number | null;
  created_at: string | null;
}

interface RoomCapacity {
  id: string;
  cabin_id: string;
  room: string | null;
  bed_count: number;
}

interface Participant {
  id: string;
  cabin_id: string | null;
  room: string | null;
}

export function CabinsTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [roomCapacity, setRoomCapacity] = useState<RoomCapacity[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCabinName, setNewCabinName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingBeds, setEditingBeds] = useState<Record<string, number>>({});
  const [savingBeds, setSavingBeds] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [addingRoomCabinId, setAddingRoomCabinId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cabinsRes, capacityRes, participantsRes] = await Promise.all([
        supabase.from('cabins').select('*').order('sort_order', { ascending: true }),
        supabase.from('room_capacity').select('*'),
        supabase.from('participants').select('id, cabin_id, room'),
      ]);

      if (cabinsRes.error) throw cabinsRes.error;
      if (capacityRes.error) throw capacityRes.error;
      if (participantsRes.error) throw participantsRes.error;

      setCabins(cabinsRes.data || []);
      setRoomCapacity(capacityRes.data || []);
      setParticipants(participantsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

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

  // Get occupancy for a specific room
  function getOccupancy(cabinId: string, room: string | null): number {
    const key = `${cabinId}-${room || 'null'}`;
    return roomOccupancy[key] || 0;
  }

  // Get rooms for a cabin (from room_capacity)
  function getRoomsForCabin(cabinId: string): RoomCapacity[] {
    return roomCapacity
      .filter((c) => c.cabin_id === cabinId)
      .sort((a, b) => (a.room || '').localeCompare(b.room || ''));
  }

  const addCabin = async () => {
    if (!newCabinName.trim()) {
      showError('Skriv inn et hyttenavn');
      return;
    }

    setIsAdding(true);
    try {
      const maxSortOrder = cabins.length > 0 
        ? Math.max(...cabins.map(c => c.sort_order || 0)) 
        : 0;

      const { data: newCabin, error } = await supabase
        .from('cabins')
        .insert({ 
          name: newCabinName.trim(),
          sort_order: maxSortOrder + 1
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          showError('Denne hytten finnes allerede');
        } else {
          throw error;
        }
        return;
      }

      // Create default room capacity entries
      if (newCabin) {
        await supabase.from('room_capacity').insert([
          { cabin_id: newCabin.id, room: 'høyre', bed_count: 6 },
          { cabin_id: newCabin.id, room: 'venstre', bed_count: 6 },
        ]);
      }

      setNewCabinName('');
      loadData();
      showSuccess('Hytte lagt til!');
    } catch (error) {
      console.error('Error adding cabin:', error);
      showError('Kunne ikke legge til hytte');
    } finally {
      setIsAdding(false);
    }
  };

  const deleteCabin = async (cabin: Cabin) => {
    // Check if cabin has participants
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('cabin_id', cabin.id);

    if (count && count > 0) {
      showError(`Kan ikke slette - ${count} deltaker(e) er tilknyttet denne hytten`);
      return;
    }

    if (!confirm(`Er du sikker på at du vil slette "${cabin.name}"?`)) return;

    setDeletingId(cabin.id);
    try {
      // Delete room capacity first
      await supabase.from('room_capacity').delete().eq('cabin_id', cabin.id);
      
      const { error } = await supabase
        .from('cabins')
        .delete()
        .eq('id', cabin.id);

      if (error) throw error;
      
      loadData();
      showSuccess('Hytte slettet');
    } catch (error) {
      console.error('Error deleting cabin:', error);
      showError('Kunne ikke slette hytte');
    } finally {
      setDeletingId(null);
    }
  };

  const updateBedCount = async (cabinId: string, room: string | null) => {
    const key = `${cabinId}-${room || 'null'}`;
    const newCount = editingBeds[key];
    
    if (newCount === undefined) return;

    setSavingBeds(key);
    try {
      const existing = roomCapacity.find(
        (c) => c.cabin_id === cabinId && (c.room || null) === (room || null)
      );

      if (existing) {
        await supabase
          .from('room_capacity')
          .update({ bed_count: newCount })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('room_capacity')
          .insert({ cabin_id: cabinId, room, bed_count: newCount });
      }

      showSuccess('Sengeplasser oppdatert');
      loadData();
      setEditingBeds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      console.error('Error updating bed count:', error);
      showError('Kunne ikke oppdatere sengeplasser');
    } finally {
      setSavingBeds(null);
    }
  };

  const deleteRoom = async (capacity: RoomCapacity) => {
    const occupancy = getOccupancy(capacity.cabin_id, capacity.room);
    if (occupancy > 0) {
      showError(`Kan ikke slette - ${occupancy} beboere er tilknyttet dette rommet`);
      return;
    }
    if (!confirm(`Slette rom "${capacity.room || 'enkeltrom'}"?`)) return;
    setDeletingRoomId(capacity.id);
    try {
      const { error } = await supabase.from('room_capacity').delete().eq('id', capacity.id);
      if (error) throw error;
      showSuccess('Rom slettet');
      loadData();
    } catch (error) {
      console.error('Error deleting room:', error);
      showError('Kunne ikke slette rom');
    } finally {
      setDeletingRoomId(null);
    }
  };

  const addRoom = async (cabinId: string) => {
    const name = newRoomName.trim().toLowerCase();
    if (!name) {
      showError('Skriv inn et romnavn');
      return;
    }
    const existing = getRoomsForCabin(cabinId).find((r) => (r.room || '').toLowerCase() === name);
    if (existing) {
      showError('Dette rommet finnes allerede');
      return;
    }
    try {
      const { error } = await supabase
        .from('room_capacity')
        .insert({ cabin_id: cabinId, room: name, bed_count: 6 });
      if (error) throw error;
      setNewRoomName('');
      setAddingRoomCabinId(null);
      loadData();
      showSuccess('Rom lagt til');
    } catch (error) {
      console.error('Error adding room:', error);
      showError('Kunne ikke legge til rom');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabin List with Room Capacity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Hytter ({cabins.length})
          </CardTitle>
          <CardDescription>
            Administrer hytter og sengeplasser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cabins.map((cabin) => {
            const rooms = getRoomsForCabin(cabin.id);
            return (
              <div
                key={cabin.id}
                className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-lg">{cabin.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCabin(cabin)}
                    disabled={deletingId === cabin.id}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === cabin.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* Room capacity rows */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                  {rooms.length === 0 && (
                    <p className="text-xs text-muted-foreground italic col-span-full">
                      Ingen rom definert. Legg til et rom nedenfor.
                    </p>
                  )}
                  {rooms.map((cap) => {
                    const room = cap.room;
                    const key = `${cabin.id}-${room || 'null'}`;
                    const currentBeds = cap.bed_count;
                    const occupancy = getOccupancy(cabin.id, room);
                    const isEditing = editingBeds[key] !== undefined;
                    const editValue = editingBeds[key] ?? currentBeds;

                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-md"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">{room || 'Enkeltrom'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{occupancy} beboere</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={editValue}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setEditingBeds((prev) => ({
                                ...prev,
                                [key]: Math.min(Math.max(val, 1), 20),
                              }));
                            }}
                            className="w-16 h-8 text-center"
                          />
                          {isEditing && editValue !== currentBeds && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => updateBedCount(cabin.id, room)}
                              disabled={savingBeds === key}
                            >
                              {savingBeds === key ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRoom(cap)}
                            disabled={deletingRoomId === cap.id}
                            title="Slett rom"
                          >
                            {deletingRoomId === cap.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add room */}
                {addingRoomCabinId === cabin.id ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Romnavn (f.eks. waikiki, høyre)"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addRoom(cabin.id);
                        if (e.key === 'Escape') {
                          setAddingRoomCabinId(null);
                          setNewRoomName('');
                        }
                      }}
                      className="h-8"
                    />
                    <Button size="sm" onClick={() => addRoom(cabin.id)}>Legg til</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingRoomCabinId(null); setNewRoomName(''); }}>
                      Avbryt
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => { setAddingRoomCabinId(cabin.id); setNewRoomName(''); }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Legg til rom
                  </Button>
                )}
              </div>
            );
          })}

          {cabins.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Ingen hytter registrert enda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Cabin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Legg til ny hytte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Hyttenavn (f.eks. Marcusbu bak)"
              value={newCabinName}
              onChange={(e) => setNewCabinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCabin()}
              className="flex-1"
            />
            <Button onClick={addCabin} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Nye hytter får automatisk 6 sengeplasser per rom (høyre/venstre)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
