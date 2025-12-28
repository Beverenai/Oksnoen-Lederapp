import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertTriangle, Edit, MapPin, FileText } from 'lucide-react';
import { LeaderContentSheet } from './LeaderContentSheet';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

type ExtraFieldConfig = {
  id: string;
  field_key: string;
  title: string;
  icon: string;
  is_visible: boolean | null;
  sort_order: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
}

// Team color mapping - consistent with Leaders page
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-500 text-white border-slate-500';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getFirstName = (fullName: string) => fullName.split(' ')[0];

interface LeaderDashboardProps {
  leaders: Leader[];
  extraFieldsConfig: ExtraFieldConfig[];
  onLeaderUpdated: () => void;
  onScheduleAutoExport: () => void;
}

export function LeaderDashboard({ leaders, extraFieldsConfig, onLeaderUpdated, onScheduleAutoExport }: LeaderDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [leadersWithContent, setLeadersWithContent] = useState<LeaderWithContent[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminNurseIds, setAdminNurseIds] = useState<Set<string>>(new Set());

  const activeLeaders = leaders.filter(l => l.is_active !== false && l.phone !== '12345678');

  // Fetch all leader content and roles
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*');

      // Fetch admin and nurse roles to know who should always be "green"
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('leader_id, role')
        .in('role', ['admin', 'nurse']);

      const adminNurseSet = new Set(rolesData?.map(r => r.leader_id) || []);
      setAdminNurseIds(adminNurseSet);

      const leadersMap = activeLeaders.map(leader => ({
        ...leader,
        content: contentData?.find(c => c.leader_id === leader.id) || null
      }));

      setLeadersWithContent(leadersMap);
      setLoading(false);
    };

    fetchContent();
  }, [leaders]);

  // Filter leaders based on search
  const filteredLeaders = leadersWithContent.filter(leader =>
    leader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    leader.ministerpost?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    leader.team?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    leader.cabin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (leader: LeaderWithContent) => {
    setSelectedLeader(leader);
    setIsSheetOpen(true);
  };

  const handleContentSaved = () => {
    onLeaderUpdated();
    onScheduleAutoExport();
    // Refresh content
    const fetchContent = async () => {
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*');

      const leadersMap = activeLeaders.map(leader => ({
        ...leader,
        content: contentData?.find(c => c.leader_id === leader.id) || null
      }));

      setLeadersWithContent(leadersMap);
      
      // Update selected leader with new content
      if (selectedLeader) {
        const updatedLeader = leadersMap.find(l => l.id === selectedLeader.id);
        if (updatedLeader) {
          setSelectedLeader(updatedLeader);
        }
      }
    };
    fetchContent();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter leder, team, ministerpost..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>{filteredLeaders.length} av {activeLeaders.length} ledere</span>
        {searchQuery && <span>· Søk: "{searchQuery}"</span>}
      </div>

      {/* Leader Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredLeaders.map(leader => {
          const content = leader.content;
          const hasObs = !!content?.obs_message;
          const hasActivity = !!content?.current_activity;
          const hasNotes = !!content?.personal_notes;
          
          // Border color logic: FRI=blue, Admin/Nurse/Kjøkken=always green, has_read=green, else red
          const isFri = content?.current_activity?.toLowerCase().includes('fri');
          const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
          const isAlwaysGreen = adminNurseIds.has(leader.id) || isKitchen;
          
          const getBorderClass = () => {
            if (isFri) return 'ring-blue-500';
            if (isAlwaysGreen || content?.has_read) return 'ring-green-500';
            return 'ring-red-500';
          };

          return (
            <Card 
              key={leader.id} 
              className={cn(
                'relative overflow-hidden transition-all hover:shadow-md cursor-pointer min-h-[220px] ring-2',
                getBorderClass(),
                hasObs && 'ring-destructive/50'
              )}
              onClick={() => handleEditClick(leader)}
            >
              <CardContent className="p-4 h-full flex flex-col">
                {/* Header with avatar and name */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    {leader.profile_image_url && (
                      <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {getFirstName(leader.name)}
                    </h3>
                    {leader.ministerpost && (
                      <p className="text-xs text-muted-foreground truncate">
                        {leader.ministerpost}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(leader);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {leader.team && (
                    <Badge className={`text-xs ${getTeamStyles(leader.team)}`}>
                      {leader.team}
                    </Badge>
                  )}
                  {leader.cabin && (
                    <Badge variant="outline" className="text-xs">
                      {leader.cabin}
                    </Badge>
                  )}
                </div>

                {/* Content section - flex-1 to push content evenly */}
                <div className="flex-1 space-y-2">
                  {/* Activity - first priority */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className={`text-sm ${hasActivity ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {hasActivity ? content?.current_activity : 'Ingen aktivitet'}
                    </p>
                  </div>

                  {/* Notes - second priority */}
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className={`text-sm line-clamp-2 ${hasNotes ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {hasNotes ? content?.personal_notes : 'Ingen notater'}
                    </p>
                  </div>
                </div>

                {/* OBS Message - at bottom, only if exists */}
                {hasObs && (
                  <Alert variant="destructive" className="mt-3 py-2 px-3">
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription className="text-xs line-clamp-2">
                      {content?.obs_message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLeaders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Ingen ledere funnet{searchQuery ? ` for "${searchQuery}"` : ''}</p>
        </div>
      )}

      {/* Edit Sheet */}
      <LeaderContentSheet
        leader={selectedLeader}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        extraFieldsConfig={extraFieldsConfig}
        onSaved={handleContentSaved}
      />
    </div>
  );
}
