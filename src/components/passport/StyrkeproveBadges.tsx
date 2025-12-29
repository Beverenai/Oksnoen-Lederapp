import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { hasStoreStyrkprove, hasLilleStyrkprove, getUniqueCompletedCount, getTotalActivities } from '@/lib/activityUtils';

interface StyrkeproveBadgesProps {
  completedActivities: string[];
  showCount?: boolean;
  compact?: boolean;
  className?: string;
}

export function StyrkeproveBadges({
  completedActivities,
  showCount = false,
  compact = false,
  className = '',
}: StyrkeproveBadgesProps) {
  const hasStore = hasStoreStyrkprove(completedActivities);
  const hasLille = hasLilleStyrkprove(completedActivities);
  // Use unique count - each activity only counts once
  const count = getUniqueCompletedCount(completedActivities);
  const total = getTotalActivities();

  if (!hasStore && !hasLille && !showCount) return null;

  // Compact mode - show only icons with tooltips
  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        {hasStore && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Store Styrkeprøven</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {hasLille && !hasStore && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-400/20">
                  <Medal className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lille Styrkeprøven</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {showCount && count > 0 && (
          <Badge variant="outline" className="text-xs">
            {count}/{total}
          </Badge>
        )}
      </div>
    );
  }

  // Full mode - show badges with text
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {hasStore && (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
          <Trophy className="w-3 h-3" />
          Store Styrkeprøven
        </Badge>
      )}
      {hasLille && !hasStore && (
        <Badge className="bg-slate-400 hover:bg-slate-500 text-white gap-1">
          <Medal className="w-3 h-3" />
          Lille Styrkeprøven
        </Badge>
      )}
      {showCount && count > 0 && (
        <Badge variant="outline" className="text-xs">
          {count}/{total} aktiviteter
        </Badge>
      )}
    </div>
  );
}
