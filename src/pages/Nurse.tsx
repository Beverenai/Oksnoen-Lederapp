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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StyrkeproveBadges } from '@/components/passport/StyrkeproveBadges';
import { 
  Search, 
  Heart, 
  Plus, 
  Clock, 
  FileText, 
  AlertCircle,
  Save,
  Loader2,
  Shield,
  Activity,
  MessageSquare,
  User,
  Home,
  Eye
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

interface ParticipantActivity {
  id: string;
  participant_id: string;
  activity: string;
  completed_at: string | null;
}

interface ParticipantWithHealth extends Participant {
  healthNotes: HealthNote[];
  healthEvents: HealthEvent[];
  cabin?: { name: string } | null;
  healthInfo?: { info: string } | null;
  activities?: ParticipantActivity[];
  publicHealthNote?: string | null;
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
  const [cabinFilter, setCabinFilter] = useState<string>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithHealth | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  
  // Form states
  const [newNote, setNewNote] = useState('');
  const [publicNote, setPublicNote] = useState('');
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

      // Load health notes, events, and health info for all participants
      const participantIds = participantsData?.map(p => p.id) || [];
      
      const [notesRes, eventsRes, healthInfoRes, activitiesRes] = await Promise.all([
        supabase.from('participant_health_notes').select('*').in('participant_id', participantIds),
        supabase.from('participant_health_events').select('*').in('participant_id', participantIds).order('created_at', { ascending: false }),
        supabase.from('participant_health_info').select('*').in('participant_id', participantIds),
        supabase.from('participant_activities').select('*').in('participant_id', participantIds),
      ]);

      const participantsWithHealth: ParticipantWithHealth[] = (participantsData || []).map(p => {
        const healthInfo = (healthInfoRes.data || []).find(h => h.participant_id === p.id);
        return {
          ...p,
          cabin: p.cabins,
          healthNotes: (notesRes.data || []).filter(n => n.participant_id === p.id),
          healthEvents: (eventsRes.data || []).filter(e => e.participant_id === p.id),
          healthInfo: healthInfo || null,
          activities: (activitiesRes.data || []).filter(a => a.participant_id === p.id),
          publicHealthNote: healthInfo?.info || null,
        };
      });

      setParticipants(participantsWithHealth);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast.error('Kunne ikke laste deltakere');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipantDetails = async (participant: ParticipantWithHealth) => {
    const [notesRes, eventsRes, activitiesRes, healthInfoRes] = await Promise.all([
      supabase.from('participant_health_notes').select('*').eq('participant_id', participant.id),
      supabase.from('participant_health_events').select('*').eq('participant_id', participant.id).order('created_at', { ascending: false }),
      supabase.from('participant_activities').select('*').eq('participant_id', participant.id),
      supabase.from('participant_health_info').select('*').eq('participant_id', participant.id).maybeSingle(),
    ]);

    const updatedParticipant = {
      ...participant,
      healthNotes: notesRes.data || [],
      healthEvents: eventsRes.data || [],
      activities: activitiesRes.data || [],
      healthInfo: healthInfoRes.data || null,
      publicHealthNote: healthInfoRes.data?.info || null,
    };

    setSelectedParticipant(updatedParticipant);
    setNewNote(notesRes.data?.[0]?.content || '');
    setPublicNote(healthInfoRes.data?.info || '');
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

  const savePublicHealthNote = async () => {
    if (!selectedParticipant) return;

    setIsSaving(true);
    try {
      // Check if there's existing health info
      const { data: existingInfo } = await supabase
        .from('participant_health_info')
        .select('*')
        .eq('participant_id', selectedParticipant.id)
        .maybeSingle();
      
      if (existingInfo) {
        await supabase
          .from('participant_health_info')
          .update({ info: publicNote })
          .eq('id', existingInfo.id);
      } else if (publicNote.trim()) {
        await supabase
          .from('participant_health_info')
          .insert({
            participant_id: selectedParticipant.id,
            info: publicNote,
          });
      }

      toast.success('Info for ledere lagret');
      await loadParticipantDetails(selectedParticipant);
      loadParticipants();
    } catch (error) {
      console.error('Error saving public health note:', error);
      toast.error('Kunne ikke lagre info');
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

  // Get unique cabins for filter
  const uniqueCabins = Array.from(
    new Set(participants.filter(p => p.cabin?.name).map(p => p.cabin!.name))
  ).sort();

  // Filter participants by search query and cabin
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.cabin?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCabin = cabinFilter === 'all' || p.cabin?.name === cabinFilter;
    return matchesSearch && matchesCabin;
  });

  // Separate participants with health info from others
  const participantsWithHealthInfo = filteredParticipants.filter(p => 
    p.healthNotes.length > 0 || p.healthEvents.length > 0 || !!p.healthInfo?.info
  );
  const participantsWithoutHealthInfo = filteredParticipants.filter(p => 
    p.healthNotes.length === 0 && p.healthEvents.length === 0 && !p.healthInfo?.info
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
              Du har ikke tilgang til Nurse-siden.
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

  const ParticipantCard = ({ participant }: { participant: ParticipantWithHealth }) => {
    const hasNotes = participant.healthNotes.length > 0;
    const hasEvents = participant.healthEvents.length > 0;
    const hasHealthInfo = !!participant.healthInfo?.info;
    const latestEvent = participant.healthEvents[0];
    const highSeverity = participant.healthEvents.some(e => e.severity === 'high');
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${highSeverity ? 'border-destructive/50' : ''}`}
        onClick={() => openParticipantDetail(participant)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={participant.image_url || undefined} alt={participant.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{participant.name}</p>
                {participant.cabin && (
                  <p className="text-sm text-muted-foreground">{participant.cabin.name}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {hasHealthInfo && (
                <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800">
                  <Heart className="w-3 h-3 mr-1" />
                  Info
                </Badge>
              )}
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
          {hasHealthInfo && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {participant.healthInfo?.info}
              </p>
            </div>
          )}
          {hasEvents && latestEvent && !hasHealthInfo && (
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
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <Heart className="w-8 h-8 text-destructive" />
          Nurse
        </h1>
        <p className="text-muted-foreground mt-1">
          Helsenotater og hendelseslogg for deltakere
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Søk etter deltaker eller hytte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={cabinFilter} onValueChange={setCabinFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Home className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Velg hytte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle hytter</SelectItem>
            {uniqueCabins.map((cabin) => (
              <SelectItem key={cabin} value={cabin}>
                {cabin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Participants with health info - shown at top */}
      {participantsWithHealthInfo.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">
              Deltakere med helseinfo ({participantsWithHealthInfo.length})
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {participantsWithHealthInfo.map((participant) => (
              <ParticipantCard key={participant.id} participant={participant} />
            ))}
          </div>
        </div>
      )}

      {/* All other participants */}
      {participantsWithoutHealthInfo.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Alle deltakere ({participantsWithoutHealthInfo.length})
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {participantsWithoutHealthInfo.map((participant) => (
              <ParticipantCard key={participant.id} participant={participant} />
            ))}
          </div>
        </div>
      )}

      {filteredParticipants.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen deltakere funnet</h3>
            <p className="text-muted-foreground mt-1">
              Prøv å søke med et annet navn eller velg en annen hytte
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participant Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div 
                className="cursor-pointer"
                onClick={() => setIsImageOpen(true)}
              >
                <Avatar className="w-16 h-16 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                  <AvatarImage src={selectedParticipant?.image_url || undefined} alt={selectedParticipant?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {selectedParticipant?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <span>{selectedParticipant?.name}</span>
                {selectedParticipant?.cabin && (
                  <p className="text-sm font-normal text-muted-foreground">{selectedParticipant.cabin.name}</p>
                )}
                <p className="text-xs font-normal text-muted-foreground flex items-center gap-1 mt-1">
                  <Eye className="w-3 h-3" />
                  Klikk på bildet for å forstørre
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="notes" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Helse</span>
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Logg</span>
              </TabsTrigger>
              <TabsTrigger value="activities" className="gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Aktiviteter</span>
              </TabsTrigger>
              <TabsTrigger value="leader-notes" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Notater</span>
              </TabsTrigger>
            </TabsList>

            {/* Health Notes Tab */}
            <TabsContent value="notes" className="flex-1 space-y-4 overflow-auto">
              {/* Public Health Info for Leaders */}
              <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Eye className="w-4 h-4" />
                    Info synlig for ledere
                  </CardTitle>
                  <CardDescription>
                    Denne informasjonen vises for ledere når de ser på deltakeren
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Skriv info som ledere skal kunne se..."
                    value={publicNote}
                    onChange={(e) => setPublicNote(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button onClick={savePublicHealthNote} disabled={isSaving} variant="outline">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lagre info for ledere
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Interne helsenotater</CardTitle>
                  <CardDescription>
                    Kun synlig for sykepleiere - allergier, medisiner, spesielle behov, etc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Skriv helsenotater her..."
                    value={newNote}
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

            {/* Activities Tab */}
            <TabsContent value="activities" className="flex-1 space-y-4 overflow-auto">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fullførte aktiviteter
                  </CardTitle>
                  <CardDescription>
                    Aktiviteter deltakeren har gjennomført
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedParticipant?.activities && selectedParticipant.activities.length > 0 ? (
                    <div className="space-y-4">
                      <StyrkeproveBadges 
                        completedActivities={selectedParticipant.activities.map(a => a.activity)} 
                        showCount 
                      />
                      <div className="mt-4 space-y-2">
                        {selectedParticipant.activities.map((activity) => (
                          <div 
                            key={activity.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border"
                          >
                            <span className="text-sm font-medium">{activity.activity}</span>
                            {activity.completed_at && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(activity.completed_at), 'dd. MMM yyyy', { locale: nb })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Ingen aktiviteter registrert
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Leader Notes Tab */}
            <TabsContent value="leader-notes" className="flex-1 space-y-4 overflow-auto">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Leder-notater
                  </CardTitle>
                  <CardDescription>
                    Kommentarer fra ledere
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedParticipant?.notes ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {selectedParticipant.notes}
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Ingen notater fra ledere
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Large Image Dialog */}
      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent className="max-w-lg p-2">
          <div className="relative w-full aspect-square">
            {selectedParticipant?.image_url ? (
              <img 
                src={selectedParticipant.image_url} 
                alt={selectedParticipant.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
                <User className="w-24 h-24 text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-center font-medium text-foreground mt-2">
            {selectedParticipant?.name}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
