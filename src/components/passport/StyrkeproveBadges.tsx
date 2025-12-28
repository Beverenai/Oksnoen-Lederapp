import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';
import { hasStoreStyrkprove, hasLilleStyrkprove, getCompletedCount, getTotalActivities } from '@/lib/activityUtils';

interface StyrkeproveBadgesProps {
  completedActivities: string[];
  showCount?: boolean;
  className?: string;
}

export function StyrkeproveBadges({
  completedActivities,
  showCount = false,
  className = '',
}: StyrkeproveBadgesProps) {
  const hasStore = hasStoreStyrkprove(completedActivities);
  const hasLille = hasLilleStyrkprove(completedActivities);
  const count = getCompletedCount(completedActivities);
  const total = getTotalActivities();

  if (!hasStore && !hasLille && !showCount) return null;

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
