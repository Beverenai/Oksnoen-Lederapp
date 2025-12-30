import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Bell, Phone, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { LeaderContentSheet } from './LeaderContentSheet';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
}

interface HomeScreenConfigItem {
  id: string;
  element_key: string;
  label: string;
  title: string | null;
  icon: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
}

interface LeaderListViewProps {
  leaders: Leader[];
  homeConfig: HomeScreenConfigItem[];
  onLeaderUpdated?: () => void;
}

// Helper functions
const getFirstName = (fullName: string): string => {
  return fullName.split(' ')[0];
};

const getTeamStyles = (team: string | null) => {
  switch (team) {
    case '1':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case '2':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case '3':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case '4':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case '5':
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function LeaderListView({ leaders, homeConfig, onLeaderUpdated }: LeaderListViewProps) {
  const { leader: currentLeader } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [leadersWithContent, setLeadersWithContent] = useState<LeaderWithContent[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [nurseIds, setNurseIds] = useState<string[]>([]);

  // Fetch leader content and roles
  useEffect(() => {
    const fetchContent = async () => {
      // Fetch leader content
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*');

      // Fetch admin and nurse roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('leader_id, role');

      const admins = rolesData?.filter(r => r.role === 'admin').map(r => r.leader_id) || [];
      const nurses = rolesData?.filter(r => r.role === 'nurse').map(r => r.leader_id) || [];
      setAdminIds(admins);
      setNurseIds(nurses);

      // Merge content with leaders
      const merged = leaders.map(leader => {
        const content = contentData?.find(c => c.leader_id === leader.id);
        return {
          ...leader,
          content,
          isAdmin: admins.includes(leader.id),
          isNurse: nurses.includes(leader.id),
        };
      });

      setLeadersWithContent(merged);
    };

    fetchContent();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leader-list-content')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leader_content' },
        () => fetchContent()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leaders]);

  // Filter leaders
  const filteredLeaders = leadersWithContent.filter(leader =>
    leader.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: Admin first, then Nurse, then by team
  const sortedLeaders = [...filteredLeaders].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    if (a.isNurse && !b.isNurse) return -1;
    if (!a.isNurse && b.isNurse) return 1;
    
    const teamOrder = ['1', '2', '3', '4', '5', null];
    const aIndex = teamOrder.indexOf(a.team);
    const bIndex = teamOrder.indexOf(b.team);
    if (aIndex !== bIndex) return aIndex - bIndex;
    
    return a.name.localeCompare(b.name, 'nb');
  });

  // Send notification to single leader
  const handleSendNotification = async (e: React.MouseEvent, leader: LeaderWithContent) => {
    e.stopPropagation();
    
    if (!currentLeader) {
      toast.error('Du må være logget inn');
      return;
    }

    setSendingNotification(leader.id);

    try {
      const { error } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Melding fra admin',
          message: 'Sjekk appen for oppdateringer',
          url: '/',
          target_leader_ids: [leader.id],
          sender_leader_id: currentLeader.id,
        },
      });

      if (error) throw error;
      toast.success(`Varsling sendt til ${getFirstName(leader.name)}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Kunne ikke sende varsling');
    } finally {
      setSendingNotification(null);
    }
  };

  // Handle call
  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  // Open leader detail
  const handleRowClick = (leader: LeaderWithContent) => {
    setSelectedLeader(leader);
    setSheetOpen(true);
  };

  // Get avatar border class
  const getAvatarBorderClass = (leader: LeaderWithContent) => {
    if (leader.isAdmin) return 'ring-2 ring-green-500';
    if (leader.isNurse) return 'ring-2 ring-green-500';
    return '';
  };

  // Truncate text
  const truncate = (text: string | null | undefined, maxLength: number) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Søk etter leder..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Navn</TableHead>
              <TableHead>Aktivitet</TableHead>
              <TableHead>Ekstra aktivitet</TableHead>
              <TableHead>Notater</TableHead>
              <TableHead>OBS</TableHead>
              <TableHead className="w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaders.map((leader) => (
              <TableRow
                key={leader.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(leader)}
              >
                <TableCell>
                  <Avatar className={`h-8 w-8 ${getAvatarBorderClass(leader)}`}>
                    <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
                    <AvatarFallback className="text-xs">
                      {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getFirstName(leader.name)}</span>
                    {leader.team && (
                      <Badge variant="secondary" className={`text-xs ${getTeamStyles(leader.team)}`}>
                        {leader.team}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {leader.content?.current_activity || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {leader.content?.extra_activity || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[150px]">
                  {truncate(leader.content?.personal_notes, 30)}
                </TableCell>
                <TableCell>
                  {leader.content?.obs_message ? (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs">{truncate(leader.content.obs_message, 20)}</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleSendNotification(e, leader)}
                      disabled={sendingNotification === leader.id}
                    >
                      <Bell className={`h-4 w-4 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleCall(e, leader.phone)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden space-y-2">
        {sortedLeaders.map((leader) => (
          <div
            key={leader.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleRowClick(leader)}
          >
            <Avatar className={`h-10 w-10 ${getAvatarBorderClass(leader)}`}>
              <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
              <AvatarFallback>
                {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{getFirstName(leader.name)}</span>
                {leader.team && (
                  <Badge variant="secondary" className={`text-xs shrink-0 ${getTeamStyles(leader.team)}`}>
                    {leader.team}
                  </Badge>
                )}
                {leader.content?.obs_message && (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {leader.content?.current_activity || 'Ingen aktivitet'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => handleSendNotification(e, leader)}
                disabled={sendingNotification === leader.id}
              >
                <Bell className={`h-4 w-4 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => handleCall(e, leader.phone)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {sortedLeaders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Ingen ledere funnet
        </div>
      )}

      {/* Leader Content Sheet */}
      {selectedLeader && (
        <LeaderContentSheet
          leader={selectedLeader}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          homeConfig={homeConfig}
          onSaved={() => {
            onLeaderUpdated?.();
          }}
        />
      )}
    </div>
  );
}
