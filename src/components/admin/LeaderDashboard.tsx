import { useState, useMemo, useDeferredValue } from 'react';
import { LeaderContentSheet } from './LeaderContentSheet';
import { LeaderFilters } from './LeaderFilters';
import { LeaderCard } from './LeaderCard';
import { useLeaderDashboardData, type LeaderWithContent } from '@/hooks/useLeaderDashboardData';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Leader = Tables<'leaders'>;

type HomeScreenConfigItem = {
  id: string;
  element_key: string;
  label: string;
  title: string | null;
  icon: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
};

interface LeaderDashboardProps {
  leaders: Leader[];
  homeConfig: HomeScreenConfigItem[];
  onLeaderUpdated: () => void;
  onScheduleAutoExport?: () => void;
}

export function LeaderDashboard({ leaders, homeConfig, onLeaderUpdated }: LeaderDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { leadersWithContent, activeLeaders, isLoading, refetchContent, filterAndSort } = useLeaderDashboardData(leaders);

  const sortedLeaders = useMemo(
    () => filterAndSort(leadersWithContent, deferredSearch, activeTeamFilter, showUnreadOnly),
    [leadersWithContent, deferredSearch, activeTeamFilter, showUnreadOnly, filterAndSort]
  );

  const handleEditClick = (leader: LeaderWithContent) => {
    setSelectedLeader(leader);
    setIsSheetOpen(true);
  };

  const handleContentSaved = () => {
    onLeaderUpdated();
    refetchContent();
  };

  const handleResetAllUnread = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase
        .from('leader_content')
        .update({ has_read: false })
        .eq('has_read', true);
      if (error) throw error;
      toast.success('Alle ledere er markert som ulest');
      refetchContent();
    } catch (err: any) {
      toast.error('Kunne ikke nullstille', { description: err?.message });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LeaderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTeamFilter={activeTeamFilter}
        onTeamFilterChange={setActiveTeamFilter}
        showUnreadOnly={showUnreadOnly}
        onUnreadFilterChange={setShowUnreadOnly}
        totalCount={activeLeaders.length}
        filteredCount={sortedLeaders.length}
      />

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isResetting} className="gap-1.5">
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Marker alle som ulest
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nullstill Hajolo for alle?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle ledere får rød Hajolo-knapp igjen og må bekrefte på nytt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllUnread}>
                Nullstill
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
        {sortedLeaders.map(leader => (
          <LeaderCard key={leader.id} leader={leader} onEdit={handleEditClick} />
        ))}
      </div>

      {sortedLeaders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Ingen ledere funnet{searchQuery ? ` for "${searchQuery}"` : ''}</p>
        </div>
      )}

      <LeaderContentSheet
        leader={selectedLeader}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        homeConfig={homeConfig}
        onSaved={handleContentSaved}
      />
    </div>
  );
}
