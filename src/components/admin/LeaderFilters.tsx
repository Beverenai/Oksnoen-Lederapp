import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, X } from 'lucide-react';
import { TEAM_FILTERS } from '@/lib/teamUtils';
import { cn } from '@/lib/utils';

interface LeaderFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTeamFilter: string | null;
  onTeamFilterChange: (filter: string | null) => void;
  showUnreadOnly: boolean;
  onUnreadFilterChange: (show: boolean) => void;
  totalCount: number;
  filteredCount: number;
  compact?: boolean;
}

export function LeaderFilters({
  searchQuery,
  onSearchChange,
  activeTeamFilter,
  onTeamFilterChange,
  showUnreadOnly,
  onUnreadFilterChange,
  totalCount,
  filteredCount,
  compact,
}: LeaderFiltersProps) {
  const [showTeamFilters, setShowTeamFilters] = useState(false);

  const getActiveFilterLabel = () => {
    if (!activeTeamFilter) return 'Alle';
    const filter = TEAM_FILTERS.find(f => f.value === activeTeamFilter);
    return filter?.label || 'Alle';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={compact ? "Søk..." : "Søk på navn, aktivitet, hytte, team..."}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn("pl-8", compact && "h-9 text-sm")}
          />
        </div>

        <Button
          variant={activeTeamFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTeamFilters(!showTeamFilters)}
          className={cn("gap-1 shrink-0", compact && "h-9 px-2 sm:px-3")}
        >
          <span className={compact ? "text-xs sm:text-sm" : undefined}>{getActiveFilterLabel()}</span>
          {activeTeamFilter && compact ? (
            <X className="h-3 w-3" onClick={(e) => { e.stopPropagation(); onTeamFilterChange(null); }} />
          ) : (
            <ChevronDown className={cn("h-4 w-4 transition-transform", showTeamFilters && "rotate-180")} />
          )}
        </Button>

        <Button
          variant={showUnreadOnly ? "destructive" : "outline"}
          size="sm"
          onClick={() => onUnreadFilterChange(!showUnreadOnly)}
          className={cn("gap-1.5 shrink-0", compact && "h-9 px-2 sm:px-3")}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className={compact ? "hidden sm:inline text-sm" : undefined}>Ikke lest</span>
          {showUnreadOnly && <X className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {showTeamFilters && (
        <div className="flex flex-wrap gap-1">
          {TEAM_FILTERS.map(filter => (
            <Button
              key={filter.value}
              variant="outline"
              size="sm"
              onClick={() => {
                onTeamFilterChange(activeTeamFilter === filter.value ? null : filter.value);
                if (compact) setShowTeamFilters(false);
              }}
              className={cn(
                "text-xs border-transparent hover:opacity-80",
                filter.color,
                activeTeamFilter === filter.value && "ring-2 ring-offset-1 ring-foreground"
              )}
            >
              {filter.label}
            </Button>
          ))}
          {activeTeamFilter && !compact && (
            <Button variant="ghost" size="sm" onClick={() => onTeamFilterChange(null)} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>{filteredCount} av {totalCount} ledere</span>
        {searchQuery && <span>· Søk: &quot;{searchQuery}&quot;</span>}
        {activeTeamFilter && <span>· Filter: {getActiveFilterLabel()}</span>}
      </div>
    </div>
  );
}
