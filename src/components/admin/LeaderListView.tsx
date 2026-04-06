import { useState, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Bell, Phone, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { LeaderContentSheet } from './LeaderContentSheet';
import { LeaderFilters } from './LeaderFilters';
import { useLeaderDashboardData, type LeaderWithContent } from '@/hooks/useLeaderDashboardData';
import { getTeamStyles, formatTeamDisplay, formatTeamDisplayMobile, getFirstName } from '@/lib/teamUtils';

type Leader = Tables<'leaders'>;

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

export function LeaderListView({ leaders, homeConfig, onLeaderUpdated }: LeaderListViewProps) {
  const { leader: currentLeader, setViewAsLeader } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { leadersWithContent, activeLeaders, isLoading, filterAndSort } = useLeaderDashboardData(leaders);

  const sortedLeaders = useMemo(
    () => filterAndSort(leadersWithContent, deferredSearch, activeTeamFilter, showUnreadOnly),
    [leadersWithContent, deferredSearch, activeTeamFilter, showUnreadOnly, filterAndSort]
  );

  const handleSendNotification = async (e: React.MouseEvent, leader: LeaderWithContent) => {
    e.stopPropagation();
    if (!currentLeader) { toast.error('Du må være logget inn'); return; }
    setSendingNotification(leader.id);
    try {
      const { error } = await supabase.functions.invoke('push-send', {
        body: { title: 'Melding fra admin', message: 'Sjekk appen for oppdateringer', url: '/', single_leader_id: leader.id, sender_leader_id: currentLeader.id },
      });
      if (error) throw error;
      toast.success(`Varsling sendt til ${getFirstName(leader.name)}`);
    } catch { toast.error('Kunne ikke sende varsling'); } finally { setSendingNotification(null); }
  };

  const handleCall = (e: React.MouseEvent, phone: string) => { e.stopPropagation(); window.location.href = `tel:${phone}`; };
  const handleRowClick = (leader: LeaderWithContent) => { setSelectedLeader(leader); setSheetOpen(true); };

  const getAvatarBorderClass = (leader: LeaderWithContent) => {
    const isKitchen = leader.team?.toLowerCase() === 'kjokken' || leader.team?.toLowerCase() === 'kjøkken';
    const hasFriActivity = leader.content?.current_activity?.toLowerCase().includes('fri') || leader.content?.extra_activity?.toLowerCase().includes('fri');
    if (leader.isAdmin || leader.isNurse) return 'ring-2 ring-green-500';
    if (isKitchen) return 'ring-2 ring-purple-500';
    if (hasFriActivity) return 'ring-2 ring-blue-500';
    if (leader.content?.has_read) return 'ring-2 ring-green-500';
    return 'ring-2 ring-red-500';
  };

  const truncate = (text: string | null | undefined, maxLength: number) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      <LeaderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTeamFilter={activeTeamFilter}
        onTeamFilterChange={setActiveTeamFilter}
        showUnreadOnly={showUnreadOnly}
        onUnreadFilterChange={setShowUnreadOnly}
        totalCount={activeLeaders.length}
        filteredCount={sortedLeaders.length}
        compact
      />

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-28">Navn</TableHead>
              <TableHead className="w-24">Team</TableHead>
              <TableHead>Aktivitet</TableHead>
              <TableHead>Ekstra aktivitet</TableHead>
              <TableHead>Notater</TableHead>
              <TableHead>OBS</TableHead>
              <TableHead className="w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaders.map((leader) => (
              <TableRow key={leader.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(leader)}>
                <TableCell>
                  <Avatar className={`h-8 w-8 ${getAvatarBorderClass(leader)}`}>
                    <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} loading="lazy" />
                    <AvatarFallback className="text-xs">{leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell><span className="font-medium">{getFirstName(leader.name)}</span></TableCell>
                <TableCell>
                  {leader.team && <Badge variant="secondary" className={`text-xs w-20 justify-center ${getTeamStyles(leader.team)}`}>{formatTeamDisplay(leader.team)}</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{leader.content?.current_activity || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{leader.content?.extra_activity || '-'}</TableCell>
                <TableCell className="text-muted-foreground max-w-[150px]">{truncate(leader.content?.personal_notes, 30)}</TableCell>
                <TableCell>
                  {leader.content?.obs_message ? (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs">{truncate(leader.content.obs_message, 20)}</span>
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleSendNotification(e, leader)} disabled={sendingNotification === leader.id}>
                      <Bell className={`h-4 w-4 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleCall(e, leader.phone)}>
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Table View */}
      <div className="md:hidden rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2"></TableHead>
              <TableHead className="px-2">Navn</TableHead>
              <TableHead className="px-2">Team</TableHead>
              <TableHead className="px-2">Aktivitet</TableHead>
              <TableHead className="w-20 px-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaders.map((leader) => (
              <TableRow key={leader.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(leader)}>
                <TableCell className="px-2">
                  <Avatar className={`h-8 w-8 ${getAvatarBorderClass(leader)}`}>
                    <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} loading="lazy" />
                    <AvatarFallback className="text-xs">{leader.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="px-2">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm">{getFirstName(leader.name)}</span>
                    {leader.content?.obs_message && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <Badge variant="secondary" className={`text-xs w-8 justify-center ${getTeamStyles(leader.team)}`}>
                    {formatTeamDisplayMobile(leader.team, leader.isAdmin, leader.isNurse)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 text-xs text-muted-foreground truncate max-w-[100px]">{leader.content?.current_activity || '-'}</TableCell>
                <TableCell className="px-2">
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleSendNotification(e, leader)} disabled={sendingNotification === leader.id}>
                      <Bell className={`h-3.5 w-3.5 ${sendingNotification === leader.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleCall(e, leader.phone)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sortedLeaders.length === 0 && <div className="text-center py-8 text-muted-foreground">Ingen ledere funnet</div>}

      {selectedLeader && (
        <LeaderContentSheet
          leader={selectedLeader}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          homeConfig={homeConfig}
          onSaved={() => onLeaderUpdated?.()}
        />
      )}
    </div>
  );
}
