import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  CheckCircle2, 
  Circle,
  User,
  Home,
  Sparkles
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { CheckoutDetailDialog } from '@/components/checkout/CheckoutDetailDialog';

type Participant = Tables<'participants'>;
type Cabin = Tables<'cabins'>;

interface ParticipantWithCabin extends Participant {
  cabins?: Cabin | null;
}

const calculateAge = (birthDate: string): number => {
  return differenceInYears(new Date(), new Date(birthDate));
};

export default function Checkout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCabin, setFilterCabin] = useState<string>('all');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch participants directly from Supabase
  const { data: participantsData, isLoading, refetch } = useQuery({
    queryKey: ['checkout-participants'],
    queryFn: async () => {
      const [participantsRes, cabinsRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, cabins(*)')
          .order('name', { ascending: true }),
        supabase.from('cabins').select('*').order('name', { ascending: true })
      ]);

      return {
        participants: (participantsRes.data || []) as ParticipantWithCabin[],
        cabins: cabinsRes.data || []
      };
    },
    staleTime: 30000,
  });

  const participants = participantsData?.participants || [];
  const cabins = participantsData?.cabins || [];

  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setIsDetailDialogOpen(true);
  };

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(query);
      const cabinName = p.cabins?.name?.toLowerCase() || '';
      const matchesCabinSearch = cabinName.includes(query);
      const matchesSearch = matchesName || matchesCabinSearch;
      const matchesCabin = filterCabin === 'all' || p.cabin_id === filterCabin;
      
      return matchesSearch && matchesCabin;
    });
  }, [participants, searchQuery, filterCabin]);

  // Split into needs pass and pass written
  const needsPass = filteredParticipants.filter(p => !p.pass_written);
  const passWritten = filteredParticipants.filter(p => p.pass_written);

  const writtenCount = participants.filter(p => p.pass_written).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Utsjekk
          </h1>
          <p className="text-muted-foreground mt-1">
            {writtenCount} av {participants.length} pass skrevet
          </p>
        </div>
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
      </div>

      {/* Needs Pass Section */}
      {needsPass.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Circle className="w-4 h-4 text-muted-foreground" />
            Trenger pass ({needsPass.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {needsPass.map((participant) => (
              <div
                key={participant.id}
                className="p-3 rounded-lg border bg-card cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                onClick={() => handleParticipantClick(participant.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={participant.image_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">
                      {participant.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {participant.birth_date && (
                        <Badge variant="outline" className="text-xs">
                          {calculateAge(participant.birth_date)} år
                        </Badge>
                      )}
                      {participant.cabins && (
                        <Badge variant="secondary" className="text-xs">
                          {participant.cabins.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pass Written Section */}
      {passWritten.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Pass skrevet ({passWritten.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {passWritten.map((participant) => (
              <div
                key={participant.id}
                className="p-3 rounded-lg border border-success/30 bg-success/5 cursor-pointer transition-all hover:shadow-md opacity-70"
                onClick={() => handleParticipantClick(participant.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={participant.image_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate text-sm">
                        {participant.name}
                      </p>
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {participant.birth_date && (
                        <Badge variant="outline" className="text-xs">
                          {calculateAge(participant.birth_date)} år
                        </Badge>
                      )}
                      {participant.cabins && (
                        <Badge variant="secondary" className="text-xs">
                          {participant.cabins.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsPass.length === 0 && passWritten.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Ingen deltakere funnet</p>
        </div>
      )}

      {/* Checkout Detail Dialog */}
      <CheckoutDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onComplete={refetch}
      />
    </div>
  );
}
