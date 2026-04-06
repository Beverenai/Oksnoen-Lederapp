import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

interface Cabin {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  birth_date: string | null;
  cabin_id: string | null;
  room: string | null;
  times_attended: number | null;
  notes: string | null;
  has_arrived: boolean | null;
  cabin?: { id: string; name: string } | null;
}

interface ParticipantEditDialogProps {
  participant: Participant | null;
  cabins: Cabin[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ParticipantEditDialog({
  participant,
  cabins,
  open,
  onOpenChange,
  onSaved,
}: ParticipantEditDialogProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cabinId, setCabinId] = useState<string>('none');
  const [room, setRoom] = useState<string>('none');
  const [timesAttended, setTimesAttended] = useState(0);
  const [notes, setNotes] = useState('');
  const [hasArrived, setHasArrived] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (participant) {
      setFirstName(participant.first_name || '');
      setLastName(participant.last_name || '');
      setBirthDate(participant.birth_date || '');
      setCabinId(participant.cabin_id || 'none');
      setRoom(participant.room || 'none');
      setTimesAttended(participant.times_attended || 0);
      setNotes(participant.notes || '');
      setHasArrived(participant.has_arrived || false);
    }
  }, [participant]);

  const handleSave = async () => {
    if (!participant) return;

    setIsSaving(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      
      const { error } = await supabase
        .from('participants')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          name: fullName || participant.name,
          birth_date: birthDate || null,
          cabin_id: cabinId === 'none' ? null : cabinId,
          room: room === 'none' ? null : room,
          times_attended: timesAttended,
          notes: notes || null,
          has_arrived: hasArrived,
        })
        .eq('id', participant.id);

      if (error) throw error;

      showSuccess('Deltaker oppdatert');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving participant:', error);
      showError('Kunne ikke lagre endringer');
    } finally {
      setIsSaving(false);
    }
  };

  const age = calculateAge(birthDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <DialogTitle>Rediger deltaker</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Fornavn</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Fornavn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Etternavn</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Etternavn"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fødselsdato {age !== null && <span className="text-muted-foreground">({age} år)</span>}
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cabin">Hytte</Label>
                <Select value={cabinId} onValueChange={setCabinId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg hytte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen hytte</SelectItem>
                    {cabins.map((cabin) => (
                      <SelectItem key={cabin.id} value={cabin.id}>
                        {cabin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">Rom</Label>
                <Select value={room} onValueChange={setRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg rom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ikke spesifisert</SelectItem>
                    <SelectItem value="venstre">Venstre</SelectItem>
                    <SelectItem value="høyre">Høyre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timesAttended">Ganger deltatt</Label>
              <Input
                id="timesAttended"
                type="number"
                min={0}
                value={timesAttended}
                onChange={(e) => setTimesAttended(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notater</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Generelle notater om deltakeren..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="hasArrived">Har ankommet</Label>
              <Switch
                id="hasArrived"
                checked={hasArrived}
                onCheckedChange={setHasArrived}
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="bottom-bar flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Lagre
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
