import { useState, useMemo, useDeferredValue } from 'react';
import { LeaderContentSheet } from './LeaderContentSheet';
import { LeaderFilters } from './LeaderFilters';
import { LeaderCard } from './LeaderCard';
import { useLeaderDashboardData, type LeaderWithContent } from '@/hooks/useLeaderDashboardData';
import type { Tables } from '@/integrations/supabase/types';

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
  onScheduleAutoExport: () => void;
}

export function LeaderDashboard({ leaders, homeConfig, onLeaderUpdated, onScheduleAutoExport }: LeaderDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTeamFilter, setActiveTeamFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

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
    onScheduleAutoExport();
    refetchContent();
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
