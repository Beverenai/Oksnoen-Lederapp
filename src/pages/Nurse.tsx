import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Heart, 
  Plus, 
  Clock, 
  FileText, 
  AlertCircle,
  User,
  Save,
  Loader2,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Participant = Tables<'participants'>;

interface HealthNote {
  id: string;
  participant_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface HealthEvent {
  id: string;
  participant_id: string;
  event_type: string;
  description: string;
  severity: string | null;
  created_by: string | null;
  created_at: string;
}

interface ParticipantWithHealth extends Participant {
  healthNotes: HealthNote[];
  healthEvents: HealthEvent[];
  cabin?: { name: string } | null;
}

const eventTypes = [
  { value: 'medication', label: 'Medisinering' },
  { value: 'injury', label: 'Skade' },
  { value: 'illness', label: 'Sykdom' },
  { value: 'allergy', label: 'Allergi' },
  { value: 'observation', label: 'Observasjon' },
  { value: 'other', label: 'Annet' },
];

const severityLevels = [
  { value: 'low', label: 'Lav', color: 'bg-success/20 text-success' },
  { value: 'medium', label: 'Medium', color: 'bg-warning/20 text-warning' },
  { value: 'high', label: 'Høy', color: 'bg-destructive/20 text-destructive' },
];

export default function Nurse() {
  const { leader, isAdmin, isNurse } = useAuth();
  const [participants, setParticipants] = useState<ParticipantWithHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithHealth | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Form states
  const [newNote, setNewNote] = useState('');
  const [newEventType, setNewEventType] = useState('observation');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventSeverity, setNewEventSeverity] = useState('low');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from('participants')
        .select('*, cabins(name)')
        .order('name');

      if (error) throw error;

      // Load health notes and events for all participants
      const participantIds = participantsData?.map(p => p.id) || [];
      
      const [notesRes, eventsRes] = await Promise.all([
        supabase.from('participant_health_notes').select('*').in('participant_id', participantIds),
        supabase.from('participant_health_events').select('*').in('participant_id', participantIds).order('created_at', { ascending: false }),
      ]);

      const participantsWithHealth: ParticipantWithHealth[] = (participantsData || []).map(p => ({
        ...p,
        cabin: p.cabins,
        healthNotes: (notesRes.data || []).filter(n => n.participant_id === p.id),
        healthEvents: (eventsRes.data || []).filter(e => e.participant_id === p.id),
      }));

      setParticipants(participantsWithHealth);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast.error('Kunne ikke laste deltakere');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipantDetails = async (participant: ParticipantWithHealth) => {
    const [notesRes, eventsRes] = await Promise.all([
      supabase.from('participant_health_notes').select('*').eq('participant_id', participant.id),
      supabase.from('participant_health_events').select('*').eq('participant_id', participant.id).order('created_at', { ascending: false }),
    ]);

    setSelectedParticipant({
      ...participant,
      healthNotes: notesRes.data || [],
      healthEvents: eventsRes.data || [],
    });
  };

  const openParticipantDetail = async (participant: ParticipantWithHealth) => {
    await loadParticipantDetails(participant);
    setIsDetailOpen(true);
  };

  const saveHealthNote = async () => {
    if (!selectedParticipant || !newNote.trim()) {
      toast.error('Skriv inn et notat');
      return;
    }

    setIsSaving(true);
    try {
      // Check if there's an existing note
      const existingNote = selectedParticipant.healthNotes[0];
      
      if (existingNote) {
        await supabase
          .from('participant_health_notes')
          .update({ content: newNote, created_by: leader?.id })
          .eq('id', existingNote.id);
      } else {
        await supabase
          .from('participant_health_notes')
          .insert({
            participant_id: selectedParticipant.id,
            content: newNote,
            created_by: leader?.id,
          });
      }

      toast.success('Helsenotat lagret');
      await loadParticipantDetails(selectedParticipant);
      loadParticipants();
    } catch (error) {
      console.error('Error saving health note:', error);
      toast.error('Kunne ikke lagre notat');
    } finally {
      setIsSaving(false);
    }
  };

  const addHealthEvent = async () => {
    if (!selectedParticipant || !newEventDescription.trim()) {
      toast.error('Skriv inn en beskrivelse');
      return;
    }

    setIsSaving(true);
    try {
      await supabase.from('participant_health_events').insert({
        participant_id: selectedParticipant.id,
        event_type: newEventType,
        description: newEventDescription,
        severity: newEventSeverity,
        created_by: leader?.id,
      });

      toast.success('Hendelse registrert');
      setNewEventDescription('');
      setNewEventType('observation');
      setNewEventSeverity('low');
      await loadParticipantDetails(selectedParticipant);
      loadParticipants();
    } catch (error) {
      console.error('Error adding health event:', error);
      toast.error('Kunne ikke registrere hendelse');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasAccess = isAdmin || isNurse;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">Ingen tilgang</h2>
            <p className="text-muted-foreground mt-2">
              Du har ikke tilgang til sykepleier-siden.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full max-w-md" />
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <Heart className="w-8 h-8 text-destructive" />
          Sykepleier
        </h1>
        <p className="text-muted-foreground mt-1">
          Helsenotater og hendelseslogg for deltakere
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter deltaker..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Participants grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredParticipants.map((participant) => {
          const hasNotes = participant.healthNotes.length > 0;
          const hasEvents = participant.healthEvents.length > 0;
          const latestEvent = participant.healthEvents[0];
          const highSeverity = participant.healthEvents.some(e => e.severity === 'high');
          
          return (
            <Card 
              key={participant.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${highSeverity ? 'border-destructive/50' : ''}`}
              onClick={() => openParticipantDetail(participant)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{participant.name}</p>
                      {participant.cabin && (
                        <p className="text-sm text-muted-foreground">{participant.cabin.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {hasNotes && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" />
                        Notat
                      </Badge>
                    )}
                    {highSeverity && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </div>
                {hasEvents && latestEvent && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {format(new Date(latestEvent.created_at), 'dd. MMM HH:mm', { locale: nb })}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {eventTypes.find(t => t.value === latestEvent.event_type)?.label || latestEvent.event_type}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredParticipants.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen deltakere funnet</h3>
            <p className="text-muted-foreground mt-1">
              Prøv å søke med et annet navn
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participant Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-destructive" />
              {selectedParticipant?.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="notes" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="w-4 h-4" />
                Helsenotater
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <Clock className="w-4 h-4" />
                Hendelseslogg
              </TabsTrigger>
            </TabsList>

            {/* Health Notes Tab */}
            <TabsContent value="notes" className="flex-1 space-y-4 overflow-auto">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Generelle helsenotater</CardTitle>
                  <CardDescription>
                    Allergier, medisiner, spesielle behov, etc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Skriv helsenotater her..."
                    value={newNote || selectedParticipant?.healthNotes[0]?.content || ''}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[150px]"
                  />
                  <Button onClick={saveHealthNote} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lagre notat
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="flex-1 space-y-4 min-h-0 flex flex-col">
              {/* Add new event */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Registrer hendelse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newEventType} onValueChange={setNewEventType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Alvorlighetsgrad</Label>
                      <Select value={newEventSeverity} onValueChange={setNewEventSeverity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {severityLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Beskrivelse</Label>
                    <Textarea
                      placeholder="Beskriv hendelsen..."
                      value={newEventDescription}
                      onChange={(e) => setNewEventDescription(e.target.value)}
                    />
                  </div>
                  <Button onClick={addHealthEvent} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Registrer
                  </Button>
                </CardContent>
              </Card>

              {/* Events list */}
              <Card className="flex-1 min-h-0 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Hendelseslogg</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {selectedParticipant?.healthEvents.map((event) => {
                        const severity = severityLevels.find(s => s.value === event.severity);
                        const eventType = eventTypes.find(t => t.value === event.event_type);
                        
                        return (
                          <div 
                            key={event.id} 
                            className="p-3 rounded-lg bg-muted/50 border border-border"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{eventType?.label || event.event_type}</Badge>
                                <Badge className={severity?.color || 'bg-muted'}>
                                  {severity?.label || event.severity}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.created_at), 'dd. MMM yyyy HH:mm', { locale: nb })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{event.description}</p>
                          </div>
                        );
                      })}
                      {(!selectedParticipant?.healthEvents || selectedParticipant.healthEvents.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">
                          Ingen hendelser registrert
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
