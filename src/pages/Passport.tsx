import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Search, 
  Plus, 
  CheckCircle2, 
  Circle,
  Upload,
  User,
  Calendar,
  Home,
  X,
  Loader2,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;
type ParticipantActivity = Tables<'participant_activities'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
  participant_activities?: ParticipantActivity[];
}

export default function Passport() {
  const [participants, setParticipants] = useState<ParticipantWithCabin[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCabin, setFilterCabin] = useState<string>('all');
  const [filterArrival, setFilterArrival] = useState<string>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithCabin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New participant form
  const [newName, setNewName] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newCabin, setNewCabin] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // New cabin form
  const [newCabinName, setNewCabinName] = useState('');

  // New activity form
  const [newActivity, setNewActivity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [participantsRes, cabinsRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, cabins(*), participant_activities(*)')
          .order('name'),
        supabase.from('cabins').select('*').order('name'),
      ]);

      setParticipants(participantsRes.data || []);
      setCabins(cabinsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipant = async (id: string) => {
    const { data } = await supabase
      .from('participants')
      .select('*, cabins(*), participant_activities(*)')
      .eq('id', id)
      .single();
    
    if (data) {
      setSelectedParticipant(data);
    }
  };

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCabin = filterCabin === 'all' || p.cabin_id === filterCabin;
    const matchesArrival = 
      filterArrival === 'all' ||
      (filterArrival === 'arrived' && p.has_arrived) ||
      (filterArrival === 'not-arrived' && !p.has_arrived);
    
    return matchesSearch && matchesCabin && matchesArrival;
  });

  const arrivedCount = participants.filter((p) => p.has_arrived).length;

  const addParticipant = async () => {
    if (!newName.trim()) {
      toast.error('Skriv inn et navn');
      return;
    }

    try {
      await supabase.from('participants').insert({
        name: newName.trim(),
        birth_date: newBirthDate || null,
        cabin_id: newCabin || null,
        notes: newNotes || null,
      });

      setNewName('');
      setNewBirthDate('');
      setNewCabin('');
      setNewNotes('');
      setIsAddDialogOpen(false);
      loadData();
      toast.success('Deltaker lagt til!');
    } catch (error) {
      console.error('Error adding participant:', error);
      toast.error('Kunne ikke legge til deltaker');
    }
  };

  const addCabin = async () => {
    if (!newCabinName.trim()) return;

    try {
      await supabase.from('cabins').insert({ name: newCabinName.trim() });
      setNewCabinName('');
      loadData();
      toast.success('Hytte lagt til!');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Denne hytten finnes allerede');
      } else {
        toast.error('Kunne ikke legge til hytte');
      }
    }
  };

  const toggleArrival = async (participant: ParticipantWithCabin) => {
    try {
      await supabase
        .from('participants')
        .update({ has_arrived: !participant.has_arrived })
        .eq('id', participant.id);
      
      loadData();
      toast.success(participant.has_arrived ? 'Ankomst fjernet' : 'Markert som ankommet!');
    } catch (error) {
      toast.error('Kunne ikke oppdatere status');
    }
  };

  const uploadImage = async (participantId: string, file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${participantId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('participant-images')
        .getPublicUrl(fileName);

      await supabase
        .from('participants')
        .update({ image_url: urlData.publicUrl })
        .eq('id', participantId);

      loadData();
      if (selectedParticipant?.id === participantId) {
        loadParticipant(participantId);
      }
      toast.success('Bilde lastet opp!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  const addActivity = async () => {
    if (!selectedParticipant || !newActivity.trim()) return;

    try {
      await supabase.from('participant_activities').insert({
        participant_id: selectedParticipant.id,
        activity: newActivity.trim(),
      });

      setNewActivity('');
      loadParticipant(selectedParticipant.id);
      toast.success('Aktivitet lagt til!');
    } catch (error) {
      toast.error('Kunne ikke legge til aktivitet');
    }
  };

  const updateNotes = async (notes: string) => {
    if (!selectedParticipant) return;

    try {
      await supabase
        .from('participants')
        .update({ notes })
        .eq('id', selectedParticipant.id);
      
      setSelectedParticipant({ ...selectedParticipant, notes });
    } catch (error) {
      toast.error('Kunne ikke oppdatere notater');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Passkontroll
          </h1>
          <p className="text-muted-foreground mt-1">
            {arrivedCount} av {participants.length} deltakere har ankommet
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Legg til deltaker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Legg til ny deltaker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Navn *</Label>
                <Input
                  placeholder="Fullt navn"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fødselsdato</Label>
                <Input
                  type="date"
                  value={newBirthDate}
                  onChange={(e) => setNewBirthDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hytte</Label>
                <Select value={newCabin} onValueChange={setNewCabin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg hytte" />
                  </SelectTrigger>
                  <SelectContent>
                    {cabins.map((cabin) => (
                      <SelectItem key={cabin.id} value={cabin.id}>
                        {cabin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Eller legg til ny hytte"
                    value={newCabinName}
                    onChange={(e) => setNewCabinName(e.target.value)}
                  />
                  <Button variant="secondary" size="icon" onClick={addCabin}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notater</Label>
                <Textarea
                  placeholder="Allergier, viktig info, etc."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
              <Button onClick={addParticipant} className="w-full">
                Legg til deltaker
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Søk etter navn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCabin} onValueChange={setFilterCabin}>
          <SelectTrigger className="w-full sm:w-40">
            <Home className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle hytter</SelectItem>
            {cabins.map((cabin) => (
              <SelectItem key={cabin.id} value={cabin.id}>
                {cabin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterArrival} onValueChange={setFilterArrival}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="arrived">Ankommet</SelectItem>
            <SelectItem value="not-arrived">Ikke ankommet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Participants Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredParticipants.map((participant) => (
          <Card 
            key={participant.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              participant.has_arrived ? 'border-success/50 bg-success/5' : ''
            }`}
            onClick={() => {
              setSelectedParticipant(participant);
              setIsDetailDialogOpen(true);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage src={participant.image_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {participant.name}
                    </p>
                    {participant.has_arrived ? (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {participant.cabins && (
                    <Badge variant="secondary" className="mt-1">
                      {participant.cabins.name}
                    </Badge>
                  )}
                  {participant.birth_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(participant.birth_date), 'd. MMMM yyyy', { locale: nb })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredParticipants.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen deltakere funnet</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery ? 'Prøv et annet søk' : 'Legg til deltakere for å komme i gang'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participant Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedParticipant && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={selectedParticipant.image_url || undefined} />
                    <AvatarFallback className="bg-muted">
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{selectedParticipant.name}</span>
                    {selectedParticipant.cabins && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedParticipant.cabins.name}
                      </Badge>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Upload image */}
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadImage(selectedParticipant.id, file);
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Last opp bilde
                  </Button>

                  <Button
                    variant={selectedParticipant.has_arrived ? 'secondary' : 'default'}
                    onClick={() => toggleArrival(selectedParticipant)}
                  >
                    {selectedParticipant.has_arrived ? (
                      <>
                        <X className="w-4 h-4 mr-2" />
                        Fjern ankomst
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Har ankommet
                      </>
                    )}
                  </Button>
                </div>

                {/* Birth date */}
                {selectedParticipant.birth_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Født {format(new Date(selectedParticipant.birth_date), 'd. MMMM yyyy', { locale: nb })}
                    </span>
                  </div>
                )}

                {/* Activities */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Aktiviteter denne uken</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Legg til aktivitet..."
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addActivity()}
                    />
                    <Button onClick={addActivity} size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedParticipant.participant_activities?.map((activity) => (
                      <Badge key={activity.id} variant="secondary">
                        {activity.activity}
                      </Badge>
                    ))}
                    {(!selectedParticipant.participant_activities || 
                      selectedParticipant.participant_activities.length === 0) && (
                      <p className="text-sm text-muted-foreground">Ingen aktiviteter registrert</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Notater</Label>
                  <Textarea
                    placeholder="Allergier, viktig info, etc."
                    value={selectedParticipant.notes || ''}
                    onChange={(e) => updateNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
